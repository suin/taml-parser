/**
 * TAML Parser - Parse TAML (Terminal ANSI Markup Language) source text into AST
 *
 * This package provides a complete parser for TAML that converts source text
 * into a well-typed Abstract Syntax Tree (AST) with comprehensive error handling.
 */

// Main parser functions and classes
export {
  TamlParser,
  parseTaml,
  parseTamlSafe,
  validateTaml,
  type ParseOptions,
} from "./parser.js";

// Validator exports
export {
  TamlValidator,
  validateTamlTokens,
  validateTagName,
  validateNesting,
  validateTagClosure,
  type ValidationResult,
} from "./validator.js";

// Tokenizer exports for advanced usage
export {
  TamlTokenizer,
  tokenize,
  isOpenTagToken,
  isCloseTagToken,
  isTextToken,
  isEofToken,
  type TamlToken,
  type OpenTagToken,
  type CloseTagToken,
  type TextToken,
  type EofToken,
  type TokenType,
  type Token,
} from "./tokenizer.js";

// Error classes and utilities
export {
  TamlParseError,
  InvalidTagError,
  UnclosedTagError,
  MismatchedTagError,
  MalformedTagError,
  UnexpectedEndOfInputError,
  UnexpectedCharacterError,
  calculatePosition,
  createErrorAtPosition,
} from "./errors.js";
