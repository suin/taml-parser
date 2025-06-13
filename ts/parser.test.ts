/**
 * Integration tests for TAML parser
 */

import { describe, expect, test } from "bun:test";
import {
  BACKGROUND_COLORS,
  BRIGHT_COLORS,
  type ElementNode,
  STANDARD_COLORS,
  TEXT_STYLES,
  type TextNode,
  getAllText,
  getElementsWithTag,
  isDocumentNode,
  isElementNode,
  isTextNode,
} from "@taml/ast";
import {
  InvalidTagError,
  MalformedTagError,
  MismatchedTagError,
  TamlParser,
  UnclosedTagError,
  parseTaml,
  parseTamlSafe,
  validateTaml,
} from "./index.js";

describe("Basic parsing scenarios", () => {
  test("parses simple text without tags", () => {
    const ast = parseTaml("Hello World");

    expect(isDocumentNode(ast)).toBe(true);
    expect(ast.children).toHaveLength(1);

    const textNode = ast.children[0] as TextNode;
    expect(isTextNode(textNode)).toBe(true);
    expect(textNode.content).toBe("Hello World");
    expect(textNode.start).toBe(0);
    expect(textNode.end).toBe(11);
  });

  test("parses simple color tag", () => {
    const ast = parseTaml("<red>Hello</red>");

    expect(ast.children).toHaveLength(1);

    const element = ast.children[0] as ElementNode;
    expect(isElementNode(element)).toBe(true);
    expect(element.tagName).toBe("red");
    expect(element.children).toHaveLength(1);
    expect(element.start).toBe(0);
    expect(element.end).toBe(16);

    const text = element.children[0] as TextNode;
    expect(isTextNode(text)).toBe(true);
    expect(text.content).toBe("Hello");
  });

  test("parses multiple tags in sequence", () => {
    const ast = parseTaml("<red>Hello</red> <blue>World</blue>");

    expect(ast.children).toHaveLength(3); // red element, space text, blue element

    const redElement = ast.children[0] as ElementNode;
    expect(redElement.tagName).toBe("red");
    expect((redElement.children[0] as TextNode).content).toBe("Hello");

    const spaceText = ast.children[1] as TextNode;
    expect(spaceText.content).toBe(" ");

    const blueElement = ast.children[2] as ElementNode;
    expect(blueElement.tagName).toBe("blue");
    expect((blueElement.children[0] as TextNode).content).toBe("World");
  });

  test("parses nested tags", () => {
    const ast = parseTaml("<red><bold>Hello</bold></red>");

    const redElement = ast.children[0] as ElementNode;
    expect(redElement.tagName).toBe("red");
    expect(redElement.children).toHaveLength(1);

    const boldElement = redElement.children[0] as ElementNode;
    expect(boldElement.tagName).toBe("bold");
    expect(boldElement.children).toHaveLength(1);

    const text = boldElement.children[0] as TextNode;
    expect(text.content).toBe("Hello");
  });

  test("parses mixed content with text and tags", () => {
    const ast = parseTaml("Hello <red>beautiful</red> world!");

    expect(ast.children).toHaveLength(3);

    expect((ast.children[0] as TextNode).content).toBe("Hello ");
    expect((ast.children[1] as ElementNode).tagName).toBe("red");
    expect((ast.children[2] as TextNode).content).toBe(" world!");
  });

  test("parses empty tags", () => {
    const ast = parseTaml("<red></red>");

    const element = ast.children[0] as ElementNode;
    expect(element.tagName).toBe("red");
    expect(element.children).toHaveLength(0);
  });

  test("parses all valid TAML tags", () => {
    const validTags = [
      ...STANDARD_COLORS,
      ...BRIGHT_COLORS,
      ...BACKGROUND_COLORS,
      ...TEXT_STYLES,
    ] as const;

    for (const tag of validTags) {
      const ast = parseTaml(`<${tag}>test</${tag}>`);
      const element = ast.children[0] as ElementNode;
      expect(element.tagName).toBe(tag);
    }
  });
});

describe("Complex nesting patterns", () => {
  test("handles deep nesting", () => {
    const nested =
      "<bold><red><underline><italic>Text</italic></underline></red></bold>";
    const ast = parseTaml(nested);

    const bold = ast.children[0] as ElementNode;
    const red = bold.children[0] as ElementNode;
    const underline = red.children[0] as ElementNode;
    const italic = underline.children[0] as ElementNode;
    const text = italic.children[0] as TextNode;

    expect(bold.tagName).toBe("bold");
    expect(red.tagName).toBe("red");
    expect(underline.tagName).toBe("underline");
    expect(italic.tagName).toBe("italic");
    expect(text.content).toBe("Text");
  });

  test("handles complex sibling structure", () => {
    const complex =
      "<red>Start</red><bold><blue>Middle</blue></bold><green>End</green>";
    const ast = parseTaml(complex);

    expect(ast.children).toHaveLength(3);

    const red = ast.children[0] as ElementNode;
    const bold = ast.children[1] as ElementNode;
    const green = ast.children[2] as ElementNode;

    expect(red.tagName).toBe("red");
    expect(bold.tagName).toBe("bold");
    expect(green.tagName).toBe("green");

    const blue = bold.children[0] as ElementNode;
    expect(blue.tagName).toBe("blue");
  });

  test("handles mixed content with multiple levels", () => {
    const mixed = "Before <red>red <bold>bold text</bold> more red</red> after";
    const ast = parseTaml(mixed);

    expect(ast.children).toHaveLength(3);
    expect(getAllText(ast)).toBe("Before red bold text more red after");

    const redElements = getElementsWithTag(ast, "red");
    const boldElements = getElementsWithTag(ast, "bold");

    expect(redElements).toHaveLength(1);
    expect(boldElements).toHaveLength(1);
  });

  test("handles adjacent nested tags", () => {
    const adjacent =
      "<red><bold>A</bold><italic>B</italic></red><blue><underline>C</underline></blue>";
    const ast = parseTaml(adjacent);

    expect(ast.children).toHaveLength(2);

    const red = ast.children[0] as ElementNode;
    const blue = ast.children[1] as ElementNode;

    expect(red.children).toHaveLength(2);
    expect(blue.children).toHaveLength(1);

    expect(getAllText(ast)).toBe("ABC");
  });
});

describe("Real-world TAML examples", () => {
  test("parses log level formatting", () => {
    const log =
      "<green>[INFO]</green> <bold>Application started</bold> successfully";
    const ast = parseTaml(log);

    expect(ast.children).toHaveLength(4); // green, space, bold, text
    expect(getAllText(ast)).toBe("[INFO] Application started successfully");

    const greenElements = getElementsWithTag(ast, "green");
    const boldElements = getElementsWithTag(ast, "bold");

    expect(greenElements).toHaveLength(1);
    expect(boldElements).toHaveLength(1);
    expect((greenElements[0]?.children[0] as TextNode)?.content).toBe("[INFO]");
    expect((boldElements[0]?.children[0] as TextNode)?.content).toBe(
      "Application started",
    );
  });

  test("parses git status output", () => {
    const git =
      "<green>M</green> modified.txt\n<red>D</red> deleted.txt\n<blue>A</blue> added.txt";
    const ast = parseTaml(git);

    const elements = getElementsWithTag(ast, "green")
      .concat(getElementsWithTag(ast, "red"))
      .concat(getElementsWithTag(ast, "blue"));

    expect(elements).toHaveLength(3);
    expect(getAllText(ast)).toBe("M modified.txt\nD deleted.txt\nA added.txt");
  });

  test("parses terminal command output", () => {
    const terminal =
      "<bold><blue>$</blue></bold> <green>npm</green> <yellow>install</yellow>\n<dim>Installing dependencies...</dim>";
    const ast = parseTaml(terminal);

    expect(getAllText(ast)).toBe("$ npm install\nInstalling dependencies...");

    const boldElements = getElementsWithTag(ast, "bold");
    const blueElements = getElementsWithTag(ast, "blue");
    const greenElements = getElementsWithTag(ast, "green");
    const yellowElements = getElementsWithTag(ast, "yellow");
    const dimElements = getElementsWithTag(ast, "dim");

    expect(boldElements).toHaveLength(1);
    expect(blueElements).toHaveLength(1);
    expect(greenElements).toHaveLength(1);
    expect(yellowElements).toHaveLength(1);
    expect(dimElements).toHaveLength(1);
  });

  test("parses error message formatting", () => {
    const error =
      "<red><bold>ERROR:</bold></red> <underline>file.js</underline>:<yellow>42</yellow>:<yellow>10</yellow> - <italic>Unexpected token</italic>";
    const ast = parseTaml(error);

    expect(getAllText(ast)).toBe("ERROR: file.js:42:10 - Unexpected token");

    const redElements = getElementsWithTag(ast, "red");
    const boldElements = getElementsWithTag(ast, "bold");
    const underlineElements = getElementsWithTag(ast, "underline");
    const yellowElements = getElementsWithTag(ast, "yellow");
    const italicElements = getElementsWithTag(ast, "italic");

    expect(redElements).toHaveLength(1);
    expect(boldElements).toHaveLength(1);
    expect(underlineElements).toHaveLength(1);
    expect(yellowElements).toHaveLength(2);
    expect(italicElements).toHaveLength(1);
  });
});

describe("Error conditions", () => {
  test("throws InvalidTagError for unknown tag names", () => {
    expect(() => parseTaml("<invalidTag>text</invalidTag>")).toThrow(
      InvalidTagError,
    );

    expect(() => parseTaml("<notAValidTag>content</notAValidTag>")).toThrow(
      InvalidTagError,
    );
  });

  test("throws UnclosedTagError for unclosed tags", () => {
    expect(() => parseTaml("<red>unclosed text")).toThrow(UnclosedTagError);

    expect(() => parseTaml("<bold><red>nested unclosed")).toThrow(
      UnclosedTagError,
    );

    expect(() => parseTaml("<green>text<blue>more text</green>")).toThrow(
      MismatchedTagError,
    );
  });

  test("throws MismatchedTagError for mismatched tags", () => {
    expect(() => parseTaml("<red>text</blue>")).toThrow(MismatchedTagError);

    expect(() => parseTaml("<bold><italic>text</bold></italic>")).toThrow(
      MismatchedTagError,
    );
  });

  test("throws MalformedTagError for malformed tags", () => {
    expect(() => parseTaml("<>empty tag name</>")).toThrow(MalformedTagError);

    expect(() => parseTaml("<red unclosed")).toThrow();

    expect(() => parseTaml("<123invalid>numeric start</123invalid>")).toThrow(
      MalformedTagError,
    );

    expect(() => parseTaml("<red-invalid>hyphen</red-invalid>")).toThrow(
      MalformedTagError,
    );
  });

  test("provides detailed error information", () => {
    try {
      parseTaml("line1\n<red>line2\nline3</blue>");
      expect.unreachable("Should have thrown an error");
    } catch (error) {
      expect(error).toBeInstanceOf(MismatchedTagError);
      if (error instanceof MismatchedTagError) {
        expect(error.expected).toBe("red");
        expect(error.actual).toBe("blue");
        expect(error.line).toBe(3);
        expect(error.position).toBeGreaterThan(0);
      }
    }
  });
});

describe("Edge cases", () => {
  test("handles empty input", () => {
    const ast = parseTaml("");

    expect(isDocumentNode(ast)).toBe(true);
    expect(ast.children).toHaveLength(0);
  });

  test("handles whitespace-only input", () => {
    const ast = parseTaml("   \n\t  ");

    expect(ast.children).toHaveLength(1);
    const text = ast.children[0] as TextNode;
    expect(text.content).toBe("   \n\t  ");
  });

  test("handles special characters in text content", () => {
    const special = "<red>Special chars: !@#$%^&*()_+-=[]{}|;':\",./</red>";
    const ast = parseTaml(special);

    const element = ast.children[0] as ElementNode;
    const text = element.children[0] as TextNode;
    expect(text.content).toBe("Special chars: !@#$%^&*()_+-=[]{}|;':\",./");
  });

  test("handles Unicode characters", () => {
    const unicode = "<blue>Unicode: 🌟 ñáéíóú 中文 العربية</blue>";
    const ast = parseTaml(unicode);

    const element = ast.children[0] as ElementNode;
    const text = element.children[0] as TextNode;
    expect(text.content).toBe("Unicode: 🌟 ñáéíóú 中文 العربية");
  });

  test("handles newlines and tabs", () => {
    const multiline = "<green>Line 1\nLine 2\n\tIndented</green>";
    const ast = parseTaml(multiline);

    const element = ast.children[0] as ElementNode;
    const text = element.children[0] as TextNode;
    expect(text.content).toBe("Line 1\nLine 2\n\tIndented");
  });

  test("handles very long content", () => {
    const longContent = "x".repeat(10000);
    const ast = parseTaml(`<red>${longContent}</red>`);

    const element = ast.children[0] as ElementNode;
    const text = element.children[0] as TextNode;
    expect(text.content).toBe(longContent);
    expect(text.content.length).toBe(10000);
  });

  test("handles deeply nested structure", () => {
    let nested = "text";
    const tags = ["red", "blue", "bold", "italic", "underline"];

    // Create 50 levels of nesting
    for (let i = 0; i < 50; i++) {
      const tag = tags[i % tags.length];
      nested = `<${tag}>${nested}</${tag}>`;
    }

    const ast = parseTaml(nested);
    expect(getAllText(ast)).toBe("text");
  });
});

describe("parseTamlSafe function", () => {
  test("returns success result for valid TAML", () => {
    const result = parseTamlSafe("<red>Hello</red>");

    expect(result.success).toBe(true);
    expect(result.ast).toBeDefined();
    expect(result.error).toBeUndefined();

    if (result.ast) {
      expect(getAllText(result.ast)).toBe("Hello");
    }
  });

  test("returns error result for invalid TAML", () => {
    const result = parseTamlSafe("<red>unclosed");

    expect(result.success).toBe(false);
    expect(result.ast).toBeUndefined();
    expect(result.error).toBeDefined();
    expect(result.error).toBeInstanceOf(UnclosedTagError);
  });
});

describe("validateTaml function", () => {
  test("returns valid for correct TAML", () => {
    const result = validateTaml("<red>Hello <bold>World</bold></red>");

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("returns invalid with errors for incorrect TAML", () => {
    const result = validateTaml("<red>unclosed");

    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toBeInstanceOf(UnclosedTagError);
  });
});

describe("TamlParser class", () => {
  test("can be instantiated and used directly", () => {
    const parser = new TamlParser("<blue>Direct usage</blue>");
    const ast = parser.parse();

    expect(getAllText(ast)).toBe("Direct usage");

    const element = ast.children[0] as ElementNode;
    expect(element.tagName).toBe("blue");
  });

  test("handles multiple parse calls on same instance", () => {
    const parser = new TamlParser("<green>Test</green>");

    const ast1 = parser.parse();
    const ast2 = parser.parse();

    expect(getAllText(ast1)).toBe("Test");
    expect(getAllText(ast2)).toBe("Test");
    expect(ast1).not.toBe(ast2); // Should be different instances
  });
});

describe("Position tracking", () => {
  test("tracks positions correctly for simple content", () => {
    const ast = parseTaml("<red>Hello</red>");

    const element = ast.children[0] as ElementNode;
    expect(element.start).toBe(0);
    expect(element.end).toBe(16);

    const text = element.children[0] as TextNode;
    expect(text.start).toBe(5);
    expect(text.end).toBe(10);
  });

  test("tracks positions correctly for mixed content", () => {
    const ast = parseTaml("Before <red>middle</red> after");

    const beforeText = ast.children[0] as TextNode;
    expect(beforeText.start).toBe(0);
    expect(beforeText.end).toBe(7);

    const element = ast.children[1] as ElementNode;
    expect(element.start).toBe(7);
    expect(element.end).toBe(24);

    const afterText = ast.children[2] as TextNode;
    expect(afterText.start).toBe(24);
    expect(afterText.end).toBe(30);
  });

  test("tracks positions correctly for nested content", () => {
    const ast = parseTaml("<red><bold>text</bold></red>");

    const redElement = ast.children[0] as ElementNode;
    expect(redElement.start).toBe(0);
    expect(redElement.end).toBe(28);

    const boldElement = redElement.children[0] as ElementNode;
    expect(boldElement.start).toBe(5);
    expect(boldElement.end).toBe(22);

    const text = boldElement.children[0] as TextNode;
    expect(text.start).toBe(11);
    expect(text.end).toBe(15);
  });
});
