/**
 * Error types for TAML parser
 */

/**
 * Base class for all TAML parsing errors
 */
export class TamlParseError extends Error {
  constructor(
    message: string,
    public readonly position: number,
    public readonly line: number,
    public readonly column: number,
    public readonly source?: string,
  ) {
    super(message);
    this.name = "TamlParseError";
  }

  /**
   * Create a detailed error message with context
   */
  getDetailedMessage(): string {
    if (!this.source) {
      return this.message;
    }

    const lines = this.source.split("\n");
    const errorLine = lines[this.line - 1];
    const pointer = `${" ".repeat(Math.max(0, this.column - 1))}^`;

    return `${this.message}

${this.line} | ${errorLine || ""}
${" ".repeat(String(this.line).length)} | ${pointer}

Position: line ${this.line}, column ${this.column}`;
  }
}

/**
 * Error thrown when an invalid tag name is encountered
 */
export class InvalidTagError extends TamlParseError {
  constructor(
    public readonly tagName: string,
    position: number,
    line: number,
    column: number,
    source?: string,
  ) {
    super(
      `Invalid tag name '${tagName}' at line ${line}, column ${column}. Tag names must be one of the 37 valid TAML tags.`,
      position,
      line,
      column,
      source,
    );
    this.name = "InvalidTagError";
  }
}

/**
 * Error thrown when a tag is not properly closed
 */
export class UnclosedTagError extends TamlParseError {
  constructor(
    public readonly tagName: string,
    position: number,
    line: number,
    column: number,
    source?: string,
  ) {
    super(
      `Unclosed tag '${tagName}' at line ${line}, column ${column}. Expected '</${tagName}>' before end of input.`,
      position,
      line,
      column,
      source,
    );
    this.name = "UnclosedTagError";
  }
}

/**
 * Error thrown when closing tag doesn't match opening tag
 */
export class MismatchedTagError extends TamlParseError {
  constructor(
    public readonly expected: string,
    public readonly actual: string,
    position: number,
    line: number,
    column: number,
    source?: string,
  ) {
    super(
      `Mismatched closing tag at line ${line}, column ${column}. Expected '</${expected}>' but found '</${actual}>'.`,
      position,
      line,
      column,
      source,
    );
    this.name = "MismatchedTagError";
  }
}

/**
 * Error thrown when a tag is malformed (e.g., missing brackets, spaces in tag name)
 */
export class MalformedTagError extends TamlParseError {
  constructor(
    public readonly content: string,
    position: number,
    line: number,
    column: number,
    source?: string,
  ) {
    super(
      `Malformed tag '${content}' at line ${line}, column ${column}. Tags must follow the pattern '<tagName>' or '</tagName>'.`,
      position,
      line,
      column,
      source,
    );
    this.name = "MalformedTagError";
  }
}

/**
 * Error thrown when an unexpected end of input is encountered
 */
export class UnexpectedEndOfInputError extends TamlParseError {
  constructor(
    position: number,
    line: number,
    column: number,
    source?: string,
    context?: string,
  ) {
    const contextMsg = context ? ` while ${context}` : "";
    super(
      `Unexpected end of input at line ${line}, column ${column}${contextMsg}.`,
      position,
      line,
      column,
      source,
    );
    this.name = "UnexpectedEndOfInputError";
  }
}

/**
 * Error thrown when an unexpected character is encountered
 */
export class UnexpectedCharacterError extends TamlParseError {
  constructor(
    public readonly character: string,
    position: number,
    line: number,
    column: number,
    source?: string,
    expected?: string,
  ) {
    const expectedMsg = expected ? ` Expected ${expected}.` : "";
    super(
      `Unexpected character '${character}' at line ${line}, column ${column}.${expectedMsg}`,
      position,
      line,
      column,
      source,
    );
    this.name = "UnexpectedCharacterError";
  }
}

/**
 * Helper function to create position information
 */
export function calculatePosition(
  source: string,
  index: number,
): { line: number; column: number } {
  let line = 1;
  let column = 1;

  for (let i = 0; i < index && i < source.length; i++) {
    if (source[i] === "\n") {
      line++;
      column = 1;
    } else {
      column++;
    }
  }

  return { line, column };
}

/**
 * Helper function to create error with position calculated from source
 */
export function createErrorAtPosition<AdditionalArgs extends unknown[]>(
  ErrorClass: new (
    ...args: [
      ...AdditionalArgs,
      ...[position: number, line: number, column: number, source: string],
    ]
  ) => TamlParseError,
  source: string,
  position: number,
  ...additionalArgs: AdditionalArgs
): TamlParseError {
  const { line, column } = calculatePosition(source, position);
  return new ErrorClass(...additionalArgs, position, line, column, source);
}
