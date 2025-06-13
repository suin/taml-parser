/**
 * Tests for TAML tokenizer
 */

import { describe, expect, test } from "bun:test";
import {
  BACKGROUND_COLORS,
  BRIGHT_COLORS,
  STANDARD_COLORS,
  TEXT_STYLES,
} from "@taml/ast";
import {
  InvalidTagError,
  MalformedTagError,
  UnexpectedEndOfInputError,
} from "./errors.js";
import {
  TamlTokenizer,
  isCloseTagToken,
  isEofToken,
  isOpenTagToken,
  isTextToken,
  tokenize,
} from "./tokenizer.js";

describe("Token generation for all tag types", () => {
  test("tokenizes opening tags correctly", () => {
    const tokens = tokenize("<red>");

    expect(tokens).toHaveLength(2); // open tag + EOF

    const [openTag, eof] = tokens;
    expect(openTag).toBeDefined();
    expect(eof).toBeDefined();

    if (openTag && isOpenTagToken(openTag)) {
      expect(openTag.tagName).toBe("red");
      expect(openTag.value).toBe("<red>");
      expect(openTag.start).toBe(0);
      expect(openTag.end).toBe(5);
      expect(openTag.line).toBe(1);
      expect(openTag.column).toBe(1);
    }

    if (eof) {
      expect(isEofToken(eof)).toBe(true);
    }
  });

  test("tokenizes closing tags correctly", () => {
    const tokens = tokenize("</blue>");

    expect(tokens).toHaveLength(2); // close tag + EOF

    const [closeTag, eof] = tokens;
    expect(closeTag).toBeDefined();
    expect(eof).toBeDefined();

    if (closeTag && isCloseTagToken(closeTag)) {
      expect(closeTag.tagName).toBe("blue");
      expect(closeTag.value).toBe("</blue>");
      expect(closeTag.start).toBe(0);
      expect(closeTag.end).toBe(7);
      expect(closeTag.line).toBe(1);
      expect(closeTag.column).toBe(1);
    }
  });

  test("tokenizes text content correctly", () => {
    const tokens = tokenize("Hello World");

    expect(tokens).toHaveLength(2); // text + EOF

    const [text, eof] = tokens;
    expect(text).toBeDefined();
    expect(eof).toBeDefined();

    if (text && isTextToken(text)) {
      expect(text.content).toBe("Hello World");
      expect(text.value).toBe("Hello World");
      expect(text.start).toBe(0);
      expect(text.end).toBe(11);
      expect(text.line).toBe(1);
      expect(text.column).toBe(1);
    }
  });

  test("tokenizes all valid TAML tags", () => {
    const validTags = [
      ...STANDARD_COLORS,
      ...BRIGHT_COLORS,
      ...BACKGROUND_COLORS,
      ...TEXT_STYLES,
    ] as const;

    for (const tag of validTags) {
      const openTokens = tokenize(`<${tag}>`);
      const closeTokens = tokenize(`</${tag}>`);

      expect(openTokens).toHaveLength(2);
      expect(closeTokens).toHaveLength(2);

      const [openTag] = openTokens;
      const [closeTag] = closeTokens;

      if (openTag && isOpenTagToken(openTag)) {
        expect(openTag.tagName).toBe(tag);
      }
      if (closeTag && isCloseTagToken(closeTag)) {
        expect(closeTag.tagName).toBe(tag);
      }
    }
  });

  test("tokenizes mixed content correctly", () => {
    const tokens = tokenize("<red>Hello</red> World");

    expect(tokens).toHaveLength(5); // open tag, text, close tag, text, EOF

    const [openTag, text1, closeTag, text2, eof] = tokens;

    expect(openTag && isOpenTagToken(openTag)).toBe(true);
    expect(text1 && isTextToken(text1)).toBe(true);
    expect(closeTag && isCloseTagToken(closeTag)).toBe(true);
    expect(text2 && isTextToken(text2)).toBe(true);
    expect(eof && isEofToken(eof)).toBe(true);

    if (openTag && isOpenTagToken(openTag)) {
      expect(openTag.tagName).toBe("red");
    }
    if (text1 && isTextToken(text1)) {
      expect(text1.content).toBe("Hello");
    }
    if (closeTag && isCloseTagToken(closeTag)) {
      expect(closeTag.tagName).toBe("red");
    }
    if (text2 && isTextToken(text2)) {
      expect(text2.content).toBe(" World");
    }
  });
});

describe("Text content tokenization", () => {
  test("handles empty text", () => {
    const tokens = tokenize("");

    expect(tokens).toHaveLength(1); // Only EOF
    const [eof] = tokens;
    expect(eof && isEofToken(eof)).toBe(true);
  });

  test("handles whitespace-only text", () => {
    const tokens = tokenize("   \n\t  ");

    expect(tokens).toHaveLength(2); // text + EOF

    const [text] = tokens;
    if (text && isTextToken(text)) {
      expect(text.content).toBe("   \n\t  ");
    }
  });

  test("handles special characters", () => {
    const special = "!@#$%^&*()_+-=[]{}|;':\",./?";
    const tokens = tokenize(special);

    expect(tokens).toHaveLength(2);

    const [text] = tokens;
    if (text && isTextToken(text)) {
      expect(text.content).toBe(special);
    }
  });

  test("handles Unicode characters", () => {
    const unicode = "🌟 ñáéíóú 中文 العربية";
    const tokens = tokenize(unicode);

    expect(tokens).toHaveLength(2);

    const [text] = tokens;
    if (text && isTextToken(text)) {
      expect(text.content).toBe(unicode);
    }
  });

  test("stops at tag boundaries", () => {
    const tokens = tokenize("Before<red>After");

    expect(tokens).toHaveLength(4); // text, open tag, text, EOF

    const [text1, , text2] = tokens;

    if (text1 && isTextToken(text1)) {
      expect(text1.content).toBe("Before");
    }
    if (text2 && isTextToken(text2)) {
      expect(text2.content).toBe("After");
    }
  });
});

describe("Position tracking accuracy", () => {
  test("tracks single line positions correctly", () => {
    const tokens = tokenize("<red>Hello</red>");

    const [openTag, text, closeTag] = tokens;

    if (openTag) {
      expect(openTag.start).toBe(0);
      expect(openTag.end).toBe(5);
      expect(openTag.line).toBe(1);
      expect(openTag.column).toBe(1);
    }

    if (text) {
      expect(text.start).toBe(5);
      expect(text.end).toBe(10);
      expect(text.line).toBe(1);
      expect(text.column).toBe(6);
    }

    if (closeTag) {
      expect(closeTag.start).toBe(10);
      expect(closeTag.end).toBe(16);
      expect(closeTag.line).toBe(1);
      expect(closeTag.column).toBe(11);
    }
  });

  test("tracks multiline positions correctly", () => {
    const source = "Line 1\n<red>Line 2\nLine 3</red>";
    const tokens = tokenize(source);

    const [text1, openTag, text2, closeTag] = tokens;

    if (text1) {
      expect(text1.line).toBe(1);
      expect(text1.column).toBe(1);
    }

    if (openTag) {
      expect(openTag.line).toBe(2);
      expect(openTag.column).toBe(1);
    }

    if (text2) {
      expect(text2.line).toBe(2);
      expect(text2.column).toBe(6);
    }

    if (closeTag) {
      expect(closeTag.line).toBe(3);
      expect(closeTag.column).toBe(7);
    }
  });
});

describe("Edge cases", () => {
  test("handles malformed tags", () => {
    expect(() => tokenize("<>")).toThrow(MalformedTagError);
    expect(() => tokenize("</>")).toThrow(MalformedTagError);
    expect(() => tokenize("<123>")).toThrow(MalformedTagError);
    expect(() => tokenize("<red-invalid>")).toThrow(MalformedTagError);
  });

  test("handles unclosed tags", () => {
    expect(() => tokenize("<red")).toThrow(UnexpectedEndOfInputError);
    expect(() => tokenize("</red")).toThrow(UnexpectedEndOfInputError);
  });

  test("handles invalid tag names", () => {
    expect(() => tokenize("<invalidTag>")).toThrow(InvalidTagError);
    expect(() => tokenize("<notValid>")).toThrow(InvalidTagError);
  });

  test("handles very long content", () => {
    const longContent = "x".repeat(10000);
    const tokens = tokenize(longContent);

    expect(tokens).toHaveLength(2);

    const [text] = tokens;
    if (text && isTextToken(text)) {
      expect(text.content.length).toBe(10000);
    }
  });
});

describe("Unicode handling", () => {
  test("handles emoji in text content", () => {
    const tokens = tokenize("Hello 🌟 World");

    expect(tokens).toHaveLength(2);

    const [text] = tokens;
    if (text && isTextToken(text)) {
      expect(text.content).toBe("Hello 🌟 World");
    }
  });

  test("handles emoji in tag context", () => {
    const tokens = tokenize("<red>🎉</red>");

    expect(tokens).toHaveLength(4);

    const [, text] = tokens;
    if (text && isTextToken(text)) {
      expect(text.content).toBe("🎉");
    }
  });
});

describe("TamlTokenizer class", () => {
  test("can be instantiated and used directly", () => {
    const tokenizer = new TamlTokenizer("<blue>Direct usage</blue>");
    const tokens = tokenizer.tokenize();

    expect(tokens).toHaveLength(4); // open, text, close, EOF

    const [openTag, text, closeTag, eof] = tokens;

    expect(openTag && isOpenTagToken(openTag)).toBe(true);
    expect(text && isTextToken(text)).toBe(true);
    expect(closeTag && isCloseTagToken(closeTag)).toBe(true);
    expect(eof && isEofToken(eof)).toBe(true);
  });

  test("provides position information", () => {
    const tokenizer = new TamlTokenizer("test");
    const posInfo = tokenizer.getPositionInfo();

    expect(posInfo.position).toBe(0);
    expect(posInfo.line).toBe(1);
    expect(posInfo.column).toBe(1);
  });
});

describe("Type guards", () => {
  test("type guards work correctly", () => {
    const tokens = tokenize("<red>text</red>");

    const [openTag, text, closeTag, eof] = tokens;

    if (openTag) expect(isOpenTagToken(openTag)).toBe(true);
    if (text) expect(isTextToken(text)).toBe(true);
    if (closeTag) expect(isCloseTagToken(closeTag)).toBe(true);
    if (eof) expect(isEofToken(eof)).toBe(true);

    // Cross-checks
    if (openTag) expect(isTextToken(openTag)).toBe(false);
    if (text) expect(isOpenTagToken(text)).toBe(false);
    if (closeTag) expect(isTextToken(closeTag)).toBe(false);
    if (eof) expect(isOpenTagToken(eof)).toBe(false);
  });
});

describe("Performance considerations", () => {
  test("handles large input efficiently", () => {
    const largeInput = `<red>${"x".repeat(100000)}</red>`;

    const start = performance.now();
    const tokens = tokenize(largeInput);
    const end = performance.now();

    expect(tokens).toHaveLength(4);
    expect(end - start).toBeLessThan(1000); // Should complete within 1 second

    const [, text] = tokens;
    if (text && isTextToken(text)) {
      expect(text.content.length).toBe(100000);
    }
  });

  test("handles many small tokens efficiently", () => {
    let manyTags = "";
    for (let i = 0; i < 1000; i++) {
      manyTags += `<red>${i}</red>`;
    }

    const start = performance.now();
    const tokens = tokenize(manyTags);
    const end = performance.now();

    expect(tokens).toHaveLength(3001); // 1000 * (open + text + close) + EOF
    expect(end - start).toBeLessThan(1000); // Should complete within 1 second
  });
});

describe("Escaping and entities", () => {
  test("decodes &lt; entity", () => {
    const tokens = tokenize("5 &lt; 10");
    const [text] = tokens;
    if (!text || !isTextToken(text)) throw new Error("Text token not found");
    expect(text.content).toBe("5 < 10");
    expect(text.value).toBe("5 &lt; 10");
  });

  test("decodes &amp; entity", () => {
    const tokens = tokenize("AT&amp;T");
    const [text] = tokens;
    if (!text || !isTextToken(text)) throw new Error("Text token not found");
    expect(text.content).toBe("AT&T");
    expect(text.value).toBe("AT&amp;T");
  });

  test("handles literal ampersands", () => {
    const tokens = tokenize("R&D and Q&A");
    const [text] = tokens;
    if (!text || !isTextToken(text)) throw new Error("Text token not found");
    expect(text.content).toBe("R&D and Q&A");
  });

  test("handles mixed entities and literal ampersands", () => {
    const tokens = tokenize("5 &lt; 10 &amp; R&D");
    const [text] = tokens;
    if (!text || !isTextToken(text)) throw new Error("Text token not found");
    expect(text.content).toBe("5 < 10 & R&D");
  });

  test("handles incomplete entities", () => {
    const tokens = tokenize("5 &lt 10 & ampersand");
    const [text] = tokens;
    if (!text || !isTextToken(text)) throw new Error("Text token not found");
    expect(text.content).toBe("5 &lt 10 & ampersand");
  });

  test("handles entities adjacent to tags", () => {
    const tokens = tokenize("<red>&lt;</red>");
    const [_open, text, _close] = tokens;
    if (!text || !isTextToken(text)) throw new Error("Text token not found");
    expect(text.content).toBe("<");
  });
});
