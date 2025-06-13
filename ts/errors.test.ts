/**
 * Tests for TAML parser error handling
 */

import { describe, expect, test } from "bun:test";
import {
  InvalidTagError,
  MalformedTagError,
  MismatchedTagError,
  TamlParseError,
  UnclosedTagError,
  UnexpectedCharacterError,
  UnexpectedEndOfInputError,
  calculatePosition,
  createErrorAtPosition,
} from "./errors.js";

describe("TamlParseError base class", () => {
  test("creates error with basic properties", () => {
    const error = new TamlParseError("Test error", 10, 2, 5, "source text");

    expect(error.message).toBe("Test error");
    expect(error.position).toBe(10);
    expect(error.line).toBe(2);
    expect(error.column).toBe(5);
    expect(error.source).toBe("source text");
    expect(error.name).toBe("TamlParseError");
    expect(error).toBeInstanceOf(Error);
  });

  test("creates error without source", () => {
    const error = new TamlParseError("Test error", 10, 2, 5);

    expect(error.source).toBeUndefined();
  });

  test("getDetailedMessage returns simple message without source", () => {
    const error = new TamlParseError("Test error", 10, 2, 5);

    expect(error.getDetailedMessage()).toBe("Test error");
  });

  test("getDetailedMessage returns detailed message with source", () => {
    const source = "line 1\nline 2 with error\nline 3";
    const error = new TamlParseError("Test error", 15, 2, 8, source);

    const detailed = error.getDetailedMessage();

    expect(detailed).toContain("Test error");
    expect(detailed).toContain("line 2 with error");
    expect(detailed).toContain("       ^"); // pointer at column 8
    expect(detailed).toContain("Position: line 2, column 8");
  });

  test("getDetailedMessage handles edge cases", () => {
    const source = "single line";
    const error = new TamlParseError("Error at start", 0, 1, 1, source);

    const detailed = error.getDetailedMessage();

    expect(detailed).toContain("single line");
    expect(detailed).toContain("^"); // pointer at column 1
  });
});

describe("InvalidTagError", () => {
  test("creates error with tag name", () => {
    const error = new InvalidTagError("invalidTag", 5, 1, 6, "source");

    expect(error.tagName).toBe("invalidTag");
    expect(error.message).toContain("Invalid tag name 'invalidTag'");
    expect(error.message).toContain("line 1, column 6");
    expect(error.message).toContain("37 valid TAML tags");
    expect(error.name).toBe("InvalidTagError");
    expect(error).toBeInstanceOf(TamlParseError);
  });

  test("inherits from TamlParseError", () => {
    const error = new InvalidTagError("bad", 0, 1, 1);

    expect(error).toBeInstanceOf(TamlParseError);
    expect(error).toBeInstanceOf(Error);
  });
});

describe("UnclosedTagError", () => {
  test("creates error with tag name", () => {
    const error = new UnclosedTagError("red", 0, 1, 1, "source");

    expect(error.tagName).toBe("red");
    expect(error.message).toContain("Unclosed tag 'red'");
    expect(error.message).toContain("line 1, column 1");
    expect(error.message).toContain("Expected '</red>'");
    expect(error.name).toBe("UnclosedTagError");
    expect(error).toBeInstanceOf(TamlParseError);
  });

  test("provides helpful error message", () => {
    const error = new UnclosedTagError("bold", 5, 2, 3);

    expect(error.message).toContain("Unclosed tag 'bold' at line 2, column 3");
    expect(error.message).toContain("Expected '</bold>' before end of input");
  });
});

describe("MismatchedTagError", () => {
  test("creates error with expected and actual tags", () => {
    const error = new MismatchedTagError("red", "blue", 10, 2, 5, "source");

    expect(error.expected).toBe("red");
    expect(error.actual).toBe("blue");
    expect(error.message).toContain("Mismatched closing tag");
    expect(error.message).toContain("line 2, column 5");
    expect(error.message).toContain("Expected '</red>'");
    expect(error.message).toContain("found '</blue>'");
    expect(error.name).toBe("MismatchedTagError");
    expect(error).toBeInstanceOf(TamlParseError);
  });

  test("provides clear mismatch information", () => {
    const error = new MismatchedTagError("italic", "bold", 20, 3, 10);

    expect(error.message).toContain("Expected '</italic>' but found '</bold>'");
  });
});

describe("MalformedTagError", () => {
  test("creates error with malformed content", () => {
    const error = new MalformedTagError("<123>", 0, 1, 1, "source");

    expect(error.content).toBe("<123>");
    expect(error.message).toContain("Malformed tag '<123>'");
    expect(error.message).toContain("line 1, column 1");
    expect(error.message).toContain(
      "follow the pattern '<tagName>' or '</tagName>'",
    );
    expect(error.name).toBe("MalformedTagError");
    expect(error).toBeInstanceOf(TamlParseError);
  });

  test("handles various malformed patterns", () => {
    const testCases = [
      "<>",
      "</>",
      "<red-invalid>",
      "<red invalid>",
      "<123red>",
    ];

    for (const content of testCases) {
      const error = new MalformedTagError(content, 0, 1, 1);
      expect(error.content).toBe(content);
      expect(error.message).toContain(`Malformed tag '${content}'`);
    }
  });
});

describe("UnexpectedEndOfInputError", () => {
  test("creates error for unexpected end", () => {
    const error = new UnexpectedEndOfInputError(10, 2, 5, "source");

    expect(error.message).toContain("Unexpected end of input");
    expect(error.message).toContain("line 2, column 5");
    expect(error.name).toBe("UnexpectedEndOfInputError");
    expect(error).toBeInstanceOf(TamlParseError);
  });

  test("includes context when provided", () => {
    const error = new UnexpectedEndOfInputError(
      10,
      2,
      5,
      "source",
      "parsing tag",
    );

    expect(error.message).toContain("while parsing tag");
  });

  test("works without context", () => {
    const error = new UnexpectedEndOfInputError(10, 2, 5, "source");

    expect(error.message).not.toContain("while");
  });
});

describe("UnexpectedCharacterError", () => {
  test("creates error with character", () => {
    const error = new UnexpectedCharacterError("@", 5, 1, 6, "source");

    expect(error.character).toBe("@");
    expect(error.message).toContain("Unexpected character '@'");
    expect(error.message).toContain("line 1, column 6");
    expect(error.name).toBe("UnexpectedCharacterError");
    expect(error).toBeInstanceOf(TamlParseError);
  });

  test("includes expected information when provided", () => {
    const error = new UnexpectedCharacterError(
      "@",
      5,
      1,
      6,
      "source",
      "letter",
    );

    expect(error.message).toContain("Expected letter");
  });

  test("works without expected information", () => {
    const error = new UnexpectedCharacterError("@", 5, 1, 6, "source");

    expect(error.message).not.toContain("Expected");
  });
});

describe("calculatePosition function", () => {
  test("calculates position for single line", () => {
    const source = "hello world";

    expect(calculatePosition(source, 0)).toEqual({ line: 1, column: 1 });
    expect(calculatePosition(source, 5)).toEqual({ line: 1, column: 6 });
    expect(calculatePosition(source, 11)).toEqual({ line: 1, column: 12 });
  });

  test("calculates position for multiple lines", () => {
    const source = "line 1\nline 2\nline 3";

    expect(calculatePosition(source, 0)).toEqual({ line: 1, column: 1 });
    expect(calculatePosition(source, 6)).toEqual({ line: 1, column: 7 }); // newline
    expect(calculatePosition(source, 7)).toEqual({ line: 2, column: 1 }); // start of line 2
    expect(calculatePosition(source, 10)).toEqual({ line: 2, column: 4 }); // 'e' in line 2
    expect(calculatePosition(source, 14)).toEqual({ line: 3, column: 1 }); // start of line 3
  });

  test("handles empty source", () => {
    expect(calculatePosition("", 0)).toEqual({ line: 1, column: 1 });
  });

  test("handles position beyond source length", () => {
    const source = "short";
    expect(calculatePosition(source, 100)).toEqual({ line: 1, column: 6 });
  });

  test("handles various newline scenarios", () => {
    const source = "\n\nhello\n\nworld\n";

    expect(calculatePosition(source, 0)).toEqual({ line: 1, column: 1 }); // first newline
    expect(calculatePosition(source, 1)).toEqual({ line: 2, column: 1 }); // second newline
    expect(calculatePosition(source, 2)).toEqual({ line: 3, column: 1 }); // 'h' in hello
    expect(calculatePosition(source, 7)).toEqual({ line: 3, column: 6 }); // 'o' in hello
    expect(calculatePosition(source, 8)).toEqual({ line: 4, column: 1 }); // newline after hello
  });

  test("handles tabs and special characters", () => {
    const source = "hello\tworld\r\ntest";

    expect(calculatePosition(source, 0)).toEqual({ line: 1, column: 1 }); // 'h'
    expect(calculatePosition(source, 5)).toEqual({ line: 1, column: 6 }); // tab
    expect(calculatePosition(source, 6)).toEqual({ line: 1, column: 7 }); // 'w'
    expect(calculatePosition(source, 11)).toEqual({ line: 1, column: 12 }); // 'd'
    expect(calculatePosition(source, 13)).toEqual({ line: 2, column: 1 }); // 't' after \r\n
  });
});

describe("createErrorAtPosition function", () => {
  test("creates error with calculated position", () => {
    const source = "line 1\nline 2 error here\nline 3";
    const position = 15; // 'r' in 'error'

    const error = createErrorAtPosition(
      InvalidTagError,
      source,
      position,
      "badTag",
    ) as InvalidTagError;

    expect(error).toBeInstanceOf(InvalidTagError);
    expect(error.position).toBe(15);
    expect(error.line).toBe(2);
    expect(error.column).toBe(9);
    expect(error.source).toBe(source);
    expect(error.tagName).toBe("badTag");
  });

  test("works with different error types", () => {
    const source = "test source";

    const unclosedError = createErrorAtPosition(
      UnclosedTagError,
      source,
      5,
      "red",
    ) as UnclosedTagError;

    expect(unclosedError).toBeInstanceOf(UnclosedTagError);
    expect(unclosedError.tagName).toBe("red");

    const mismatchedError = createErrorAtPosition(
      MismatchedTagError,
      source,
      5,
      "red",
      "blue",
    ) as MismatchedTagError;

    expect(mismatchedError).toBeInstanceOf(MismatchedTagError);
    expect(mismatchedError.expected).toBe("red");
    expect(mismatchedError.actual).toBe("blue");
  });

  test("handles edge positions", () => {
    const source = "short";

    const errorAtStart = createErrorAtPosition(
      MalformedTagError,
      source,
      0,
      "<>",
    );

    expect(errorAtStart.line).toBe(1);
    expect(errorAtStart.column).toBe(1);

    const errorAtEnd = createErrorAtPosition(
      MalformedTagError,
      source,
      5,
      "<>",
    );

    expect(errorAtEnd.line).toBe(1);
    expect(errorAtEnd.column).toBe(6);
  });
});

describe("Error context generation", () => {
  test("detailed messages show context correctly", () => {
    const source =
      "This is line 1\nThis is line 2 with <invalid> tag\nThis is line 3";
    const error = new InvalidTagError("invalid", 35, 2, 22, source);

    const detailed = error.getDetailedMessage();

    expect(detailed).toContain("Invalid tag name 'invalid'");
    expect(detailed).toContain("This is line 2 with <invalid> tag");
    expect(detailed).toContain("                     ^"); // pointer at column 22
    expect(detailed).toContain("Position: line 2, column 22");
  });

  test("handles very long lines gracefully", () => {
    const longLine = "x".repeat(1000);
    const source = `short\n${longLine}\nshort`;
    const error = new MalformedTagError("<>", 1010, 2, 500, source);

    const detailed = error.getDetailedMessage();

    expect(detailed).toContain("Malformed tag '<>'");
    expect(detailed).toContain(longLine);
    expect(detailed).toContain("Position: line 2, column 500");
  });

  test("handles missing lines gracefully", () => {
    const source = "line 1\nline 2";
    const error = new TamlParseError("Test error", 20, 5, 1, source); // line 5 doesn't exist

    const detailed = error.getDetailedMessage();

    expect(detailed).toContain("Test error");
    expect(detailed).toContain("Position: line 5, column 1");
    // Should not crash even though line 5 doesn't exist
  });
});

describe("Error inheritance chain", () => {
  test("all error types inherit correctly", () => {
    const errors = [
      new InvalidTagError("bad", 0, 1, 1),
      new UnclosedTagError("red", 0, 1, 1),
      new MismatchedTagError("red", "blue", 0, 1, 1),
      new MalformedTagError("<>", 0, 1, 1),
      new UnexpectedEndOfInputError(0, 1, 1),
      new UnexpectedCharacterError("@", 0, 1, 1),
    ];

    for (const error of errors) {
      expect(error).toBeInstanceOf(TamlParseError);
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBeTruthy();
      expect(error.message).toBeTruthy();
      expect(error.position).toBe(0);
      expect(error.line).toBe(1);
      expect(error.column).toBe(1);
    }
  });

  test("error names are set correctly", () => {
    expect(new InvalidTagError("bad", 0, 1, 1).name).toBe("InvalidTagError");
    expect(new UnclosedTagError("red", 0, 1, 1).name).toBe("UnclosedTagError");
    expect(new MismatchedTagError("red", "blue", 0, 1, 1).name).toBe(
      "MismatchedTagError",
    );
    expect(new MalformedTagError("<>", 0, 1, 1).name).toBe("MalformedTagError");
    expect(new UnexpectedEndOfInputError(0, 1, 1).name).toBe(
      "UnexpectedEndOfInputError",
    );
    expect(new UnexpectedCharacterError("@", 0, 1, 1).name).toBe(
      "UnexpectedCharacterError",
    );
  });
});

describe("Real-world error scenarios", () => {
  test("provides helpful messages for common mistakes", () => {
    // Unclosed tag
    const unclosed = new UnclosedTagError("red", 0, 1, 1, "<red>Hello world");
    expect(unclosed.message).toContain("Expected '</red>' before end of input");

    // Mismatched tags
    const mismatched = new MismatchedTagError(
      "bold",
      "italic",
      15,
      1,
      16,
      "<bold>text</italic>",
    );
    expect(mismatched.message).toContain(
      "Expected '</bold>' but found '</italic>'",
    );

    // Invalid tag
    const invalid = new InvalidTagError(
      "color",
      1,
      1,
      2,
      "<color>text</color>",
    );
    expect(invalid.message).toContain("37 valid TAML tags");

    // Malformed tag
    const malformed = new MalformedTagError(
      "<red-color>",
      0,
      1,
      1,
      "<red-color>text</red-color>",
    );
    expect(malformed.message).toContain(
      "follow the pattern '<tagName>' or '</tagName>'",
    );
  });

  test("error messages are user-friendly", () => {
    const errors = [
      new InvalidTagError("badtag", 0, 1, 1),
      new UnclosedTagError("red", 0, 1, 1),
      new MismatchedTagError("red", "blue", 0, 1, 1),
      new MalformedTagError("<>", 0, 1, 1),
    ];

    for (const error of errors) {
      expect(error.message).toMatch(/line \d+, column \d+/);
      expect(error.message.length).toBeGreaterThan(20); // Should be descriptive
      expect(error.message).not.toContain("undefined");
      expect(error.message).not.toContain("null");
    }
  });
});
