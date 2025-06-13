/**
 * Validator for TAML tokens and syntax
 */

import { type TamlTag, isValidTag } from "@taml/ast";
import {
  InvalidTagError,
  MismatchedTagError,
  UnclosedTagError,
} from "./errors.js";
import {
  type TamlToken,
  isCloseTagToken,
  isEofToken,
  isOpenTagToken,
  isTextToken,
} from "./tokenizer.js";

/**
 * Validation context for tracking state during validation
 */
interface ValidationContext {
  tokens: TamlToken[];
  position: number;
  source: string;
  tagStack: Array<{ tagName: TamlTag; token: TamlToken }>;
  errors: Error[];
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: Error[];
}

/**
 * TAML Validator class
 */
export class TamlValidator {
  constructor(private readonly source: string) {}

  /**
   * Validate a sequence of tokens
   */
  validateTokens(tokens: TamlToken[]): ValidationResult {
    const context: ValidationContext = {
      tokens,
      position: 0,
      source: this.source,
      tagStack: [],
      errors: [],
    };

    try {
      this.validateTokenSequence(context);

      // Check for unclosed tags at the end
      if (context.tagStack.length > 0) {
        const unclosedTag = context.tagStack[context.tagStack.length - 1];
        if (unclosedTag) {
          const error = new UnclosedTagError(
            unclosedTag.tagName,
            unclosedTag.token.start,
            unclosedTag.token.line,
            unclosedTag.token.column,
            this.source,
          );
          context.errors.push(error);
        }
      }

      return {
        valid: context.errors.length === 0,
        errors: context.errors,
      };
    } catch (error) {
      if (error instanceof Error) {
        context.errors.push(error);
      }
      return {
        valid: false,
        errors: context.errors,
      };
    }
  }

  /**
   * Validate the sequence of tokens
   */
  private validateTokenSequence(context: ValidationContext): void {
    while (context.position < context.tokens.length) {
      const token = context.tokens[context.position];

      if (!token) {
        break;
      }

      if (isEofToken(token)) {
        break;
      }

      if (isOpenTagToken(token)) {
        this.validateOpenTag(context, token);
      } else if (isCloseTagToken(token)) {
        this.validateCloseTag(context, token);
      } else if (isTextToken(token)) {
        // Text tokens are always valid
        context.position++;
      } else {
        // Skip unexpected tokens
        context.position++;
      }
    }
  }

  /**
   * Validate an opening tag token
   */
  private validateOpenTag(context: ValidationContext, token: TamlToken): void {
    if (!isOpenTagToken(token)) {
      context.position++;
      return;
    }

    // Validate tag name against TAML specification
    if (!isValidTag(token.tagName)) {
      const error = new InvalidTagError(
        token.tagName,
        token.start,
        token.line,
        token.column,
        this.source,
      );
      context.errors.push(error);
      context.position++;
      return;
    }

    // Push tag onto stack for tracking
    context.tagStack.push({
      tagName: token.tagName as TamlTag,
      token,
    });

    context.position++;
  }

  /**
   * Validate a closing tag token
   */
  private validateCloseTag(context: ValidationContext, token: TamlToken): void {
    if (!isCloseTagToken(token)) {
      context.position++;
      return;
    }

    // Validate tag name against TAML specification
    if (!isValidTag(token.tagName)) {
      const error = new InvalidTagError(
        token.tagName,
        token.start,
        token.line,
        token.column,
        this.source,
      );
      context.errors.push(error);
      context.position++;
      return;
    }

    // Check if there's a matching opening tag
    if (context.tagStack.length === 0) {
      // No opening tag to match - this is an extra closing tag
      const error = new MismatchedTagError(
        "(none)",
        token.tagName,
        token.start,
        token.line,
        token.column,
        this.source,
      );
      context.errors.push(error);
      context.position++;
      return;
    }

    // Check if the closing tag matches the most recent opening tag
    const lastOpenTag = context.tagStack[context.tagStack.length - 1];
    if (lastOpenTag && lastOpenTag.tagName !== token.tagName) {
      const error = new MismatchedTagError(
        lastOpenTag.tagName,
        token.tagName,
        token.start,
        token.line,
        token.column,
        this.source,
      );
      context.errors.push(error);
      context.position++;
      return;
    }

    // Valid closing tag - pop from stack
    context.tagStack.pop();
    context.position++;
  }

  /**
   * Get current validation state for debugging
   */
  getDebugInfo(context: ValidationContext): {
    position: number;
    currentToken: TamlToken | null;
    tagStack: string[];
    errorCount: number;
  } {
    return {
      position: context.position,
      currentToken:
        context.position < context.tokens.length
          ? (context.tokens[context.position] ?? null)
          : null,
      tagStack: context.tagStack.map((entry) => entry.tagName),
      errorCount: context.errors.length,
    };
  }
}

/**
 * Convenience function to validate TAML tokens
 */
export function validateTamlTokens(
  tokens: TamlToken[],
  source: string,
): ValidationResult {
  const validator = new TamlValidator(source);
  return validator.validateTokens(tokens);
}

/**
 * Validate tag name against TAML specification
 */
export function validateTagName(tagName: string): boolean {
  return isValidTag(tagName);
}

/**
 * Check if nesting is valid (stack-based validation)
 */
export function validateNesting(tokens: TamlToken[]): {
  valid: boolean;
  unclosedTags: string[];
  mismatchedTags: Array<{ expected: string; actual: string }>;
} {
  const tagStack: string[] = [];
  const unclosedTags: string[] = [];
  const mismatchedTags: Array<{ expected: string; actual: string }> = [];

  for (const token of tokens) {
    if (isOpenTagToken(token)) {
      if (isValidTag(token.tagName)) {
        tagStack.push(token.tagName);
      }
    } else if (isCloseTagToken(token)) {
      if (isValidTag(token.tagName)) {
        if (tagStack.length === 0) {
          mismatchedTags.push({ expected: "(none)", actual: token.tagName });
        } else {
          const lastTag = tagStack[tagStack.length - 1];
          if (lastTag && lastTag === token.tagName) {
            tagStack.pop();
          } else if (lastTag) {
            mismatchedTags.push({ expected: lastTag, actual: token.tagName });
          }
        }
      }
    }
  }

  // Any remaining tags in stack are unclosed
  unclosedTags.push(...tagStack);

  return {
    valid: unclosedTags.length === 0 && mismatchedTags.length === 0,
    unclosedTags,
    mismatchedTags,
  };
}

/**
 * Validate proper tag closure
 */
export function validateTagClosure(tokens: TamlToken[]): {
  valid: boolean;
  issues: Array<{
    type: "unclosed" | "extra" | "mismatched";
    tagName: string;
    position: number;
  }>;
} {
  const tagStack: Array<{ tagName: string; position: number }> = [];
  const issues: Array<{
    type: "unclosed" | "extra" | "mismatched";
    tagName: string;
    position: number;
  }> = [];

  for (const token of tokens) {
    if (isOpenTagToken(token)) {
      if (isValidTag(token.tagName)) {
        tagStack.push({ tagName: token.tagName, position: token.start });
      }
    } else if (isCloseTagToken(token)) {
      if (isValidTag(token.tagName)) {
        if (tagStack.length === 0) {
          issues.push({
            type: "extra",
            tagName: token.tagName,
            position: token.start,
          });
        } else {
          const lastTag = tagStack[tagStack.length - 1];
          if (lastTag && lastTag.tagName === token.tagName) {
            tagStack.pop();
          } else {
            issues.push({
              type: "mismatched",
              tagName: token.tagName,
              position: token.start,
            });
          }
        }
      }
    }
  }

  // Any remaining tags in stack are unclosed
  for (const unclosedTag of tagStack) {
    issues.push({
      type: "unclosed",
      tagName: unclosedTag.tagName,
      position: unclosedTag.position,
    });
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}
