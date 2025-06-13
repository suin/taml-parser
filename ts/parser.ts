/**
 * Main TAML parser that converts tokens to AST
 */

import {
  type DocumentNode,
  type TamlNode,
  createDocument,
  createElement,
  createText,
  isDocumentNode,
  isElementNode,
  isTextNode,
} from "@taml/ast";

import type { TamlTag } from "@taml/ast";

import {
  type TamlToken,
  isCloseTagToken,
  isEofToken,
  isOpenTagToken,
  isTextToken,
  tokenize,
} from "./tokenizer.js";

import { MismatchedTagError, UnclosedTagError } from "./errors.js";

/**
 * Parser context for tracking state during parsing
 */
interface ParseContext {
  tokens: TamlToken[];
  position: number;
  source: string;
  tagStack: Array<{ tagName: TamlTag; token: TamlToken }>;
}

/**
 * TAML Parser class
 */
export class TamlParser {
  constructor(private readonly source: string) {}

  /**
   * Parse the TAML source into an AST
   */
  parse(): DocumentNode {
    const tokens = tokenize(this.source);
    const context: ParseContext = {
      tokens,
      position: 0,
      source: this.source,
      tagStack: [],
    };

    const children = this.parseNodes(context);

    // Check for unclosed tags
    if (context.tagStack.length > 0) {
      const unclosedTag = context.tagStack[context.tagStack.length - 1];
      if (unclosedTag) {
        throw new UnclosedTagError(
          unclosedTag.tagName,
          unclosedTag.token.start,
          unclosedTag.token.line,
          unclosedTag.token.column,
          this.source,
        );
      }
    }

    return createDocument(children, 0, this.source.length);
  }

  /**
   * Parse with options including depth checking
   */
  parseWithOptions(options: Required<ParseOptions>): DocumentNode {
    const tokens = tokenize(this.source);
    const context: ParseContext = {
      tokens,
      position: 0,
      source: this.source,
      tagStack: [],
    };

    const children = this.parseNodesWithDepth(context, 0, options.maxDepth);

    // Check for unclosed tags
    if (context.tagStack.length > 0) {
      const unclosedTag = context.tagStack[context.tagStack.length - 1];
      if (unclosedTag) {
        throw new UnclosedTagError(
          unclosedTag.tagName,
          unclosedTag.token.start,
          unclosedTag.token.line,
          unclosedTag.token.column,
          this.source,
        );
      }
    }

    return createDocument(children, 0, this.source.length);
  }

  /**
   * Parse nodes with depth checking
   */
  private parseNodesWithDepth(
    context: ParseContext,
    currentDepth: number,
    maxDepth: number,
  ): TamlNode[] {
    if (currentDepth > maxDepth) {
      throw new Error(`Maximum nesting depth of ${maxDepth} exceeded`);
    }

    const nodes: TamlNode[] = [];

    while (context.position < context.tokens.length) {
      const token = context.tokens[context.position];

      if (!token) {
        break;
      }

      if (isEofToken(token)) {
        break;
      }

      if (isCloseTagToken(token)) {
        // This will be handled by the calling context
        break;
      }

      if (isOpenTagToken(token)) {
        const element = this.parseElementWithDepth(
          context,
          currentDepth,
          maxDepth,
        );
        nodes.push(element);
      } else if (isTextToken(token)) {
        const text = this.parseText(context);
        nodes.push(text);
      } else {
        // Skip unexpected tokens
        context.position++;
      }
    }

    return nodes;
  }

  /**
   * Parse an element with depth checking
   */
  private parseElementWithDepth(
    context: ParseContext,
    currentDepth: number,
    maxDepth: number,
  ): TamlNode {
    const openToken = context.tokens[context.position];

    if (!openToken || !isOpenTagToken(openToken)) {
      throw new Error("Expected open tag token");
    }

    context.position++; // Move past opening tag

    // Push tag onto stack for tracking
    context.tagStack.push({
      tagName: openToken.tagName as TamlTag,
      token: openToken,
    });

    // Parse children with incremented depth
    const children = this.parseNodesWithDepth(
      context,
      currentDepth + 1,
      maxDepth,
    );

    // Check for closing tag
    if (context.position >= context.tokens.length) {
      throw new UnclosedTagError(
        openToken.tagName,
        openToken.start,
        openToken.line,
        openToken.column,
        this.source,
      );
    }

    const closeToken = context.tokens[context.position];

    if (!closeToken || !isCloseTagToken(closeToken)) {
      throw new UnclosedTagError(
        openToken.tagName,
        openToken.start,
        openToken.line,
        openToken.column,
        this.source,
      );
    }

    // Verify tag names match
    if (closeToken.tagName !== openToken.tagName) {
      throw new MismatchedTagError(
        openToken.tagName,
        closeToken.tagName,
        closeToken.start,
        closeToken.line,
        closeToken.column,
        this.source,
      );
    }

    context.position++; // Move past closing tag
    context.tagStack.pop(); // Remove from tag stack

    return createElement(
      openToken.tagName as TamlTag,
      children,
      openToken.start,
      closeToken.end,
    );
  }

  /**
   * Parse a sequence of nodes until we hit EOF or a closing tag
   */
  private parseNodes(context: ParseContext): TamlNode[] {
    const nodes: TamlNode[] = [];

    while (context.position < context.tokens.length) {
      const token = context.tokens[context.position];

      if (!token) {
        break;
      }

      if (isEofToken(token)) {
        break;
      }

      if (isCloseTagToken(token)) {
        // This will be handled by the calling context
        break;
      }

      if (isOpenTagToken(token)) {
        const element = this.parseElement(context);
        nodes.push(element);
      } else if (isTextToken(token)) {
        const text = this.parseText(context);
        nodes.push(text);
      } else {
        // Skip unexpected tokens
        context.position++;
      }
    }

    return nodes;
  }

  /**
   * Parse an element (opening tag + children + closing tag)
   */
  private parseElement(context: ParseContext): TamlNode {
    const openToken = context.tokens[context.position];

    if (!openToken || !isOpenTagToken(openToken)) {
      throw new Error("Expected open tag token");
    }

    context.position++; // Move past opening tag

    // Push tag onto stack for tracking
    context.tagStack.push({
      tagName: openToken.tagName as TamlTag,
      token: openToken,
    });

    // Parse children
    const children = this.parseNodes(context);

    // Check for closing tag
    if (context.position >= context.tokens.length) {
      throw new UnclosedTagError(
        openToken.tagName,
        openToken.start,
        openToken.line,
        openToken.column,
        this.source,
      );
    }

    const closeToken = context.tokens[context.position];

    if (!closeToken || !isCloseTagToken(closeToken)) {
      throw new UnclosedTagError(
        openToken.tagName,
        openToken.start,
        openToken.line,
        openToken.column,
        this.source,
      );
    }

    // Verify tag names match
    if (closeToken.tagName !== openToken.tagName) {
      throw new MismatchedTagError(
        openToken.tagName,
        closeToken.tagName,
        closeToken.start,
        closeToken.line,
        closeToken.column,
        this.source,
      );
    }

    context.position++; // Move past closing tag
    context.tagStack.pop(); // Remove from tag stack

    return createElement(
      openToken.tagName as TamlTag,
      children,
      openToken.start,
      closeToken.end,
    );
  }

  /**
   * Parse a text node
   */
  private parseText(context: ParseContext): TamlNode {
    const token = context.tokens[context.position];

    if (!token || !isTextToken(token)) {
      throw new Error("Expected text token");
    }

    context.position++;

    return createText(token.content, token.start, token.end);
  }

  /**
   * Get current token without advancing
   */
  private peek(context: ParseContext): TamlToken | null {
    return context.position < context.tokens.length
      ? (context.tokens[context.position] ?? null)
      : null;
  }

  /**
   * Get current parser state for debugging
   */
  getDebugInfo(context: ParseContext): {
    position: number;
    currentToken: TamlToken | null;
    tagStack: string[];
  } {
    return {
      position: context.position,
      currentToken: this.peek(context),
      tagStack: context.tagStack.map((entry) => entry.tagName),
    };
  }
}

/**
 * Parse options for customizing parser behavior
 */
export interface ParseOptions {
  /** Whether to include position information in nodes (default: true) */
  includePositions?: boolean;
  /** Maximum nesting depth to prevent stack overflow (default: 100) */
  maxDepth?: number;
}

/**
 * Convenience function to parse TAML source text
 */
export function parseTaml(
  source: string,
  options?: ParseOptions,
): DocumentNode {
  const parser = new TamlParser(source);

  // Apply default options
  const opts: Required<ParseOptions> = {
    includePositions: true,
    maxDepth: 100,
    ...options,
  };

  // Parse with depth checking and position options
  const ast = parser.parseWithOptions(opts);

  // If position information should be excluded, strip it
  if (!opts.includePositions) {
    return stripPositions(ast);
  }

  return ast;
}

/**
 * Parse TAML and return the AST with error context
 */
export function parseTamlSafe(
  source: string,
  options?: ParseOptions,
):
  | {
      success: true;
      ast: DocumentNode;
      error?: never;
    }
  | {
      success: false;
      ast?: never | DocumentNode;
      error: Error;
    } {
  try {
    const ast = parseTaml(source, options);
    return { success: true, ast };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

/**
 * Validate TAML syntax without building full AST
 */
export function validateTaml(source: string): {
  valid: boolean;
  errors: Error[];
} {
  const errors: Error[] = [];

  try {
    parseTaml(source);
    return { valid: true, errors: [] };
  } catch (error) {
    if (error instanceof Error) {
      errors.push(error);
    }
    return { valid: false, errors };
  }
}

/**
 * Strip position information from AST nodes (for includePositions: false option)
 */
function stripPositions(node: DocumentNode): DocumentNode {
  const strippedChildren = node.children.map((child: TamlNode) =>
    stripPositionsFromNode(child),
  );
  return createDocument(strippedChildren, 0, 0);
}

/**
 * Recursively strip position information from any AST node
 */
function stripPositionsFromNode(node: TamlNode): TamlNode {
  if (isDocumentNode(node)) {
    const strippedChildren = node.children.map((child: TamlNode) =>
      stripPositionsFromNode(child),
    );
    return createDocument(strippedChildren, 0, 0);
  }

  if (isElementNode(node)) {
    const strippedChildren = node.children.map((child: TamlNode) =>
      stripPositionsFromNode(child),
    );
    return createElement(node.tagName, strippedChildren, 0, 0);
  }

  if (isTextNode(node)) {
    return createText(node.content, 0, 0);
  }

  return node;
}
