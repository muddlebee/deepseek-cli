import chalk from "chalk";

export function renderMarkdown(text: string): string {
  if (!text) {
    return "";
  }

  const fenceSegments = splitByFences(text);
  return fenceSegments
    .map((segment) => {
      if (segment.kind === "code") {
        const langTag = segment.lang ? chalk.dim(`[${segment.lang}]`) + "\n" : "";
        return langTag + chalk.cyan(segment.body);
      }
      return renderInlineBlock(segment.body);
    })
    .join("");
}

function stripAnsi(s: string): string {
  return s.replace(/\x1B\[[0-9;]*m/g, "");
}

type FenceSegment = { kind: "text"; body: string } | { kind: "code"; lang: string; body: string };

function splitByFences(text: string): FenceSegment[] {
  const segments: FenceSegment[] = [];
  const lines = text.split(/\r?\n/);
  let buffer: string[] = [];
  let inFence = false;
  let fenceLang = "";
  let fenceBody: string[] = [];

  const flushText = () => {
    if (buffer.length === 0) return;
    segments.push({ kind: "text", body: buffer.join("\n") });
    buffer = [];
  };

  for (const line of lines) {
    const fenceMatch = /^\s*```(\w*)\s*$/.exec(line);
    if (fenceMatch) {
      if (!inFence) {
        flushText();
        inFence = true;
        fenceLang = fenceMatch[1] ?? "";
        fenceBody = [];
      } else {
        segments.push({ kind: "code", lang: fenceLang, body: fenceBody.join("\n") });
        inFence = false;
        fenceLang = "";
        fenceBody = [];
      }
      continue;
    }

    if (inFence) {
      fenceBody.push(line);
    } else {
      buffer.push(line);
    }
  }

  if (inFence) {
    segments.push({ kind: "code", lang: fenceLang, body: fenceBody.join("\n") });
  } else {
    flushText();
  }

  return segments;
}

// ─── Table rendering ─────────────────────────────────────────────────────────

const TABLE_ROW_RE = /^\s*\|.*\|\s*$/;
const TABLE_SEP_RE = /^\s*\|[\s|:-]+\|\s*$/;

function parseTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => c.trim());
}

function renderTable(tableLines: string[]): string {
  type RowInfo = { styled: string[]; isHeader: boolean };

  const rows: RowInfo[] = [];
  let foundSeparator = false;
  const pending: string[][] = [];

  for (const line of tableLines) {
    if (TABLE_SEP_RE.test(line)) {
      for (const r of pending) {
        rows.push({
          styled: r.map((cell) => chalk.bold(renderInlineSpans(cell))),
          isHeader: true,
        });
      }
      pending.length = 0;
      foundSeparator = true;
    } else {
      const cells = parseTableRow(line);
      if (!foundSeparator) {
        pending.push(cells);
      } else {
        rows.push({
          styled: cells.map((cell) => renderInlineSpans(cell)),
          isHeader: false,
        });
      }
    }
  }
  for (const r of pending) {
    rows.push({
      styled: r.map((cell) => renderInlineSpans(cell)),
      isHeader: false,
    });
  }

  if (rows.length === 0) return "";

  const colCount = Math.max(...rows.map((r) => r.styled.length));

  const colWidths: number[] = Array(colCount).fill(0);
  for (const { styled } of rows) {
    for (let c = 0; c < styled.length; c++) {
      colWidths[c] = Math.max(colWidths[c], stripAnsi(styled[c]).length + 2);
    }
  }

  const b = chalk.dim;
  const top = b("┌" + colWidths.map((w) => "─".repeat(w)).join("┬") + "┐");
  const mid = b("├" + colWidths.map((w) => "─".repeat(w)).join("┼") + "┤");
  const row_div = b("├" + colWidths.map((w) => "╌".repeat(w)).join("┼") + "┤");
  const bot = b("└" + colWidths.map((w) => "─".repeat(w)).join("┴") + "┘");

  const renderRow = (styled: string[]): string => {
    const cells = styled.map((s, i) => {
      const pad = colWidths[i] - 2 - stripAnsi(s).length;
      return ` ${s}${" ".repeat(Math.max(0, pad))} `;
    });
    for (let i = styled.length; i < colCount; i++) {
      cells.push(" ".repeat(colWidths[i]));
    }
    return b("│") + cells.join(b("│")) + b("│");
  };

  const out: string[] = [top];
  for (let i = 0; i < rows.length; i++) {
    const prev = rows[i - 1];
    if (i > 0) {
      if (!rows[i].isHeader && prev.isHeader) {
        out.push(mid); // bold header ↔ data separator
      } else if (!rows[i].isHeader && !prev.isHeader) {
        out.push(row_div); // light dashed divider between data rows
      }
    }
    out.push(renderRow(rows[i].styled));
  }
  out.push(bot);
  return out.join("\n");
}

// ─── Block rendering ──────────────────────────────────────────────────────────

function renderInlineBlock(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  let tableBuffer: string[] = [];

  const flushTable = () => {
    if (tableBuffer.length > 0) {
      out.push(renderTable(tableBuffer));
      tableBuffer = [];
    }
  };

  for (const line of lines) {
    if (TABLE_ROW_RE.test(line)) {
      tableBuffer.push(line);
    } else {
      flushTable();
      out.push(renderInlineLine(line));
    }
  }
  flushTable();
  return out.join("\n");
}

function renderInlineLine(line: string): string {
  // Horizontal rule — render as a full-width dim line
  if (/^\s*(?:[-]{3,}|[*]{3,}|[_]{3,})\s*$/.test(line)) {
    const width = process.stdout.columns || 80;
    return chalk.dim("─".repeat(width));
  }

  // Headings — drop the ### prefix, use depth for visual weight
  const headingMatch = /^(\s*)(#{1,6})\s+(.*)$/.exec(line);
  if (headingMatch) {
    const [, lead, hashes, content] = headingMatch;
    const depth = hashes.length;
    const rendered = renderInlineSpans(content);
    const styled =
      depth <= 2 ? chalk.bold.cyanBright(rendered) : depth === 3 ? chalk.bold.cyan(rendered) : chalk.cyan(rendered);
    return `${lead}${styled}`;
  }

  const listMatch = /^(\s*)([-*+])\s+(.*)$/.exec(line);
  if (listMatch) {
    const [, lead, bullet, content] = listMatch;
    return `${lead}${chalk.yellow(bullet)} ${renderInlineSpans(content)}`;
  }

  const numListMatch = /^(\s*)(\d+\.)\s+(.*)$/.exec(line);
  if (numListMatch) {
    const [, lead, marker, content] = numListMatch;
    return `${lead}${chalk.yellow(marker)} ${renderInlineSpans(content)}`;
  }

  const quoteMatch = /^(\s*)>\s?(.*)$/.exec(line);
  if (quoteMatch) {
    const [, lead, content] = quoteMatch;
    return `${lead}${chalk.dim("│ ")}${chalk.italic(renderInlineSpans(content))}`;
  }

  return renderInlineSpans(line);
}

// ─── Inline spans ─────────────────────────────────────────────────────────────

function renderInlineSpans(text: string): string {
  if (!text) return text;

  // Protect code spans first so inner syntax isn't processed
  const codeSlots: string[] = [];
  let result = text.replace(/`([^`]+)`/g, (_, inner) => {
    codeSlots.push(chalk.cyan(inner));
    return `\x00CODE${codeSlots.length - 1}\x00`;
  });

  // Links: [label](url) — show label styled, drop URL (keeps output clean)
  result = result.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_, label, url) => chalk.cyan.underline(label) + chalk.dim(` (${url})`)
  );

  // Strikethrough
  result = result.replace(/~~([^~]+)~~/g, (_, inner) => chalk.dim(inner));

  // Bold and italic
  result = result.replace(/\*\*([^*]+)\*\*/g, (_, inner) => chalk.bold(inner));
  result = result.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, (_, inner) => chalk.italic(inner));
  result = result.replace(/_([^_\n]+)_/g, (_, inner) => chalk.italic(inner));

  // Restore code spans
  result = result.replace(/\x00CODE(\d+)\x00/g, (_, i) => codeSlots[Number(i)]);

  return result;
}
