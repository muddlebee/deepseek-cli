import { test } from "node:test";
import assert from "node:assert/strict";
import { renderMarkdown } from "../ui";

function stripAnsi(text: string): string {
  return text.replace(/\[[0-9;]*m/g, "");
}

test("renderMarkdown returns empty string for empty input", () => {
  assert.equal(renderMarkdown(""), "");
});

test("renderMarkdown preserves heading text without # prefix", () => {
  const result = stripAnsi(renderMarkdown("# Title"));
  assert.equal(result.includes("Title"), true);
  assert.equal(result.includes("#"), false, "# prefix should be hidden");
});

test("renderMarkdown preserves code fences with language tag", () => {
  const result = stripAnsi(renderMarkdown("```js\nconsole.log(1);\n```"));
  assert.equal(result.includes("[js]"), true);
  assert.equal(result.includes("console.log(1);"), true);
});

test("renderMarkdown styles inline code without removing it", () => {
  const result = stripAnsi(renderMarkdown("Use `npm install` first."));
  assert.equal(result.includes("npm install"), true);
});

test("renderMarkdown keeps bullet markers", () => {
  const result = stripAnsi(renderMarkdown("- item one\n- item two"));
  assert.equal(result.includes("- item one"), true);
  assert.equal(result.includes("- item two"), true);
});

test("renderMarkdown handles plain text unchanged in stripped form", () => {
  const text = "hello world\nthis is a sentence";
  const result = stripAnsi(renderMarkdown(text));
  assert.equal(result, text);
});

test("renderMarkdown renders tables with box-drawing borders", () => {
  const table = "| File | What |\n|------|------|\n| foo.ts | bar |";
  const result = stripAnsi(renderMarkdown(table));
  assert.ok(result.includes("┌"), "top-left corner");
  assert.ok(result.includes("┐"), "top-right corner");
  assert.ok(result.includes("└"), "bottom-left corner");
  assert.ok(result.includes("┘"), "bottom-right corner");
  assert.ok(result.includes("├"), "mid-left separator");
  assert.ok(result.includes("┼"), "mid cross");
  assert.ok(result.includes("File"), "header cell preserved");
  assert.ok(result.includes("foo.ts"), "data cell preserved");
});

test("renderMarkdown table columns are padded to equal width", () => {
  const table = "| A | Longer header |\n|---|---------------|\n| x | y |";
  const lines = stripAnsi(renderMarkdown(table)).split("\n");
  const lengths = lines.map((l) => l.length);
  assert.ok(
    lengths.every((l) => l === lengths[0]),
    `unequal line lengths: ${lengths.join(", ")}`
  );
});

test("renderMarkdown table has dashed dividers between data rows", () => {
  const table = "| A | B |\n|---|---|\n| r1 | r1 |\n| r2 | r2 |";
  const result = stripAnsi(renderMarkdown(table));
  assert.ok(result.includes("╌"), "dashed row divider between data rows");
});

test("renderMarkdown table header row uses solid separator from data", () => {
  const table = "| H1 | H2 |\n|----|----|\n| d1 | d2 |";
  const lines = stripAnsi(renderMarkdown(table)).split("\n");
  // The solid mid border (├─┼─┤) must appear between header and data
  const hasMid = lines.some((l) => l.includes("├") && l.includes("─") && l.includes("┼"));
  assert.ok(hasMid, "solid ├┼┤ separator between header and data rows");
});

// ── Headings ──────────────────────────────────────────────────────────────────

test("renderMarkdown H1 renders text without # prefix", () => {
  const result = stripAnsi(renderMarkdown("# My Title"));
  assert.ok(result.includes("My Title"), "heading text present");
  assert.ok(!result.includes("#"), "# prefix stripped");
});

test("renderMarkdown H2 renders text without ## prefix", () => {
  const result = stripAnsi(renderMarkdown("## Section"));
  assert.ok(result.includes("Section"));
  assert.ok(!result.includes("#"));
});

test("renderMarkdown H3 renders text without ### prefix", () => {
  const result = stripAnsi(renderMarkdown("### Sub"));
  assert.ok(result.includes("Sub"));
  assert.ok(!result.includes("#"));
});

// ── Horizontal rule ───────────────────────────────────────────────────────────

test("renderMarkdown renders --- as a dim rule line of repeated ─", () => {
  const result = stripAnsi(renderMarkdown("---"));
  assert.ok(result.includes("─"), "horizontal rule rendered");
  assert.ok(!result.includes("-"), "raw dashes replaced");
});

test("renderMarkdown renders *** as a horizontal rule", () => {
  const result = stripAnsi(renderMarkdown("***"));
  assert.ok(result.includes("─"));
  assert.ok(!result.includes("*"));
});

// ── Inline spans ──────────────────────────────────────────────────────────────

test("renderMarkdown renders **bold** text", () => {
  const result = stripAnsi(renderMarkdown("**hello**"));
  assert.ok(result.includes("hello"), "bold text preserved");
  assert.ok(!result.includes("**"), "bold markers removed");
});

test("renderMarkdown renders *italic* text", () => {
  const result = stripAnsi(renderMarkdown("*hello*"));
  assert.ok(result.includes("hello"));
  assert.ok(!result.includes("*"));
});

test("renderMarkdown renders ~~strikethrough~~ text", () => {
  const result = stripAnsi(renderMarkdown("~~gone~~"));
  assert.ok(result.includes("gone"), "strikethrough text preserved");
  assert.ok(!result.includes("~~"), "~~ markers removed");
});

test("renderMarkdown renders [label](url) links", () => {
  const result = stripAnsi(renderMarkdown("[Click here](https://example.com)"));
  assert.ok(result.includes("Click here"), "link label preserved");
  assert.ok(!result.includes("[Click here]"), "brackets removed");
  assert.ok(result.includes("https://example.com"), "URL preserved in output");
});

test("renderMarkdown code spans are protected from inner span processing", () => {
  // The ** inside the code span must NOT be treated as bold markers
  const result = stripAnsi(renderMarkdown("`**not bold**`"));
  assert.ok(result.includes("**not bold**"), "raw content inside code span intact");
});

// ── Blockquote ────────────────────────────────────────────────────────────────

test("renderMarkdown renders blockquote with │ prefix", () => {
  const result = stripAnsi(renderMarkdown("> a quote"));
  assert.ok(result.includes("│"), "blockquote prefix present");
  assert.ok(result.includes("a quote"), "quote text preserved");
  assert.ok(!result.startsWith(">"), "> marker replaced");
});

// ── Numbered list ─────────────────────────────────────────────────────────────

test("renderMarkdown keeps numbered list markers", () => {
  const result = stripAnsi(renderMarkdown("1. first\n2. second"));
  assert.ok(result.includes("1."));
  assert.ok(result.includes("2."));
  assert.ok(result.includes("first"));
  assert.ok(result.includes("second"));
});
