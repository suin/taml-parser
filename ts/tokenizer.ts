/**
 * Tokenizer for TAML parser
 */

import { isValidTag } from "@taml/ast";
import {
  InvalidTagError,
  MalformedTagError,
  UnexpectedEndOfInputError,
  calculatePosition,
} from "./errors.js";

/**
 * Token types produced by the tokenizer
 */
export type TokenType = "open-tag" | "close-tag" | "text" | "eof";

/**
 * Base token interface
 */
export interface Token {
  type: TokenType;
  value: string;
  start: number;
  end: number;
  line: number;
  column: number;
}

/**
 * Opening tag token (e.g., '<red>')
 */
export interface OpenTagToken extends Token {
  type: "open-tag";
  tagName: string;
}

/**
 * Closing tag token (e.g., '</red>')
 */
export interface CloseTagToken extends Token {
  type: "close-tag";
  tagName: string;
}

/**
 * Text content token
 */
export interface TextToken extends Token {
  type: "text";
  content: string;
}

/**
 * End of file token
 */
export interface EofToken extends Token {
  type: "eof";
}

/**
 * Union type of all token types
 */
export type TamlToken = OpenTagToken | CloseTagToken | TextToken | EofToken;

/**
 * Tokenizer class for TAML source text
 */
export class TamlTokenizer {
  private position = 0;
  private tokens: TamlToken[] = [];

  constructor(private readonly source: string) {}

  /**
   * Tokenize the entire source text
   */
  tokenize(): TamlToken[] {
    this.position = 0;
    this.tokens = [];

    while (this.position < this.source.length) {
      this.tokenizeNext();
    }

    // Add EOF token
    const { line, column } = calculatePosition(this.source, this.position);
    this.tokens.push({
      type: "eof",
      value: "",
      start: this.position,
      end: this.position,
      line,
      column,
    });

    return this.tokens;
  }

  /**
   * Tokenize the next token from current position
   */
  private tokenizeNext(): void {
    if (this.position >= this.source.length) {
      return;
    }

    const char = this.source[this.position];

    if (char === "<") {
      this.tokenizeTag();
    } else {
      this.tokenizeText();
    }
  }

  /**
   * Tokenize a tag (opening or closing)
   */
  private tokenizeTag(): void {
    const start = this.position;
    const startPos = calculatePosition(this.source, start);

    // Must start with '<'
    if (this.source[this.position] !== "<") {
      throw new MalformedTagError(
        this.source[this.position] ?? "",
        this.position,
        startPos.line,
        startPos.column,
        this.source,
      );
    }

    this.position++; // Skip '<'

    // Check for closing tag
    const isClosing = this.source[this.position] === "/";
    if (isClosing) {
      this.position++; // Skip '/'
    }

    // Read tag name
    const tagNameStart = this.position;
    while (
      this.position < this.source.length &&
      this.source[this.position] !== ">" &&
      this.source[this.position]
    ) {
      this.position++;
    }

    const tagName = this.source.slice(tagNameStart, this.position);

    // Validate tag name is not empty
    if (tagName === "") {
      throw new MalformedTagError(
        this.source.slice(start, this.position + 1),
        start,
        startPos.line,
        startPos.column,
        this.source,
      );
    }

    // Validate tag name contains only letters
    if (!/^[a-zA-Z]+$/.test(tagName)) {
      throw new MalformedTagError(
        this.source.slice(start, this.position + 1),
        start,
        startPos.line,
        startPos.column,
        this.source,
      );
    }

    // Check for closing '>'
    if (
      this.position >= this.source.length ||
      this.source[this.position] !== ">"
    ) {
      throw new UnexpectedEndOfInputError(
        this.position,
        startPos.line,
        startPos.column,
        this.source,
        "parsing tag",
      );
    }

    this.position++; // Skip '>'

    const end = this.position;
    const value = this.source.slice(start, end);

    // Validate tag name is valid TAML tag
    if (!isValidTag(tagName)) {
      throw new InvalidTagError(
        tagName,
        start,
        startPos.line,
        startPos.column,
        this.source,
      );
    }

    const token: OpenTagToken | CloseTagToken = {
      type: isClosing ? "close-tag" : "open-tag",
      value,
      tagName,
      start,
      end,
      line: startPos.line,
      column: startPos.column,
    };

    this.tokens.push(token);
  }

  /**
   * Tokenize text content
   */
  private tokenizeText(): void {
    const start = this.position;
    const startPos = calculatePosition(this.source, start);
    let content = "";

    while (
      this.position < this.source.length &&
      this.source[this.position] !== "<"
    ) {
      if (this.source[this.position] === "&") {
        if (this.source.slice(this.position, this.position + 4) === "&lt;") {
          content += "<";
          this.position += 4;
          continue;
        }
        if (this.source.slice(this.position, this.position + 5) === "&amp;") {
          content += "&";
          this.position += 5;
          continue;
        }
      }

      content += this.source[this.position];
      this.position++;
    }

    const end = this.position;
    const value = this.source.slice(start, end);

    const token: TextToken = {
      type: "text",
      value,
      content,
      start,
      end,
      line: startPos.line,
      column: startPos.column,
    };

    this.tokens.push(token);
  }

  /**
   * Get current position info for debugging
   */
  getPositionInfo(): { position: number; line: number; column: number } {
    const { line, column } = calculatePosition(this.source, this.position);
    return { position: this.position, line, column };
  }
}

/**
 * Convenience function to tokenize TAML source
 */
export function tokenize(source: string): TamlToken[] {
  const tokenizer = new TamlTokenizer(source);
  return tokenizer.tokenize();
}

/**
 * Type guards for token types
 */
export function isOpenTagToken(token: TamlToken): token is OpenTagToken {
  return token.type === "open-tag";
}

export function isCloseTagToken(token: TamlToken): token is CloseTagToken {
  return token.type === "close-tag";
}

export function isTextToken(token: TamlToken): token is TextToken {
  return token.type === "text";
}

export function isEofToken(token: TamlToken): token is EofToken {
  return token.type === "eof";
}
