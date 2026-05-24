import { execFile } from "child_process";
import { promisify } from "util";
import * as path from "path";
import type { ToolExecutionContext, ToolExecutionResult } from "./executor";

const execFileAsync = promisify(execFile);

const MAX_MATCHES = 200;
const SEARCH_TIMEOUT_MS = 15_000;

type GrepMatch = {
  file: string;
  line: number;
  content: string;
  context_before?: string[];
  context_after?: string[];
};

type RgMessage =
  | {
      type: "match";
      data: {
        path: { text: string };
        line_number: number;
        lines: { text: string };
      };
    }
  | {
      type: "context";
      data: {
        path: { text: string };
        line_number: number;
        lines: { text: string };
      };
    }
  | { type: "begin" | "end" | "summary"; data: unknown };

export async function handleGrepTool(
  args: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const pattern = typeof args.pattern === "string" ? args.pattern.trim() : "";
  if (!pattern) {
    return { ok: false, name: "Grep", error: 'Missing required "pattern" string.' };
  }

  const searchPath = typeof args.path === "string" ? args.path : context.projectRoot;
  const include = typeof args.include === "string" ? args.include : undefined;
  const caseSensitive = args.case_sensitive === true;
  const contextLines = typeof args.context_lines === "number" ? Math.min(Math.max(0, args.context_lines), 10) : 0;

  const rgArgs: string[] = ["--json", "--max-filesize", "1M"];

  if (!caseSensitive) rgArgs.push("--ignore-case");
  if (contextLines > 0) rgArgs.push("--context", String(contextLines));
  if (include) rgArgs.push("--glob", include);
  rgArgs.push("--", pattern, searchPath);

  let stdout: string;
  try {
    const result = await execFileAsync("rg", rgArgs, {
      maxBuffer: 10 * 1024 * 1024,
      timeout: SEARCH_TIMEOUT_MS,
    });
    stdout = result.stdout;
  } catch (err: unknown) {
    const e = err as NodeJS.ErrnoException & { code?: number; stdout?: string };
    // rg exits with code 1 when no matches found — not an error
    if (e.code === 1) {
      stdout = e.stdout ?? "";
    } else if (e.code === "ENOENT") {
      return {
        ok: false,
        name: "Grep",
        error: "ripgrep (rg) is not installed. Run: sudo apt install ripgrep  OR  brew install ripgrep",
      };
    } else {
      return { ok: false, name: "Grep", error: e.message ?? String(err) };
    }
  }

  const matches = parseRgOutput(stdout, context.projectRoot);
  const truncated = matches.length > MAX_MATCHES;
  const displayed = truncated ? matches.slice(0, MAX_MATCHES) : matches;

  return {
    ok: true,
    name: "Grep",
    output: JSON.stringify({ matches: displayed, total_count: matches.length, truncated }, null, 2),
    metadata: { total_count: matches.length, truncated },
  };
}

function parseRgOutput(stdout: string, projectRoot: string): GrepMatch[] {
  const lines = stdout.split("\n").filter(Boolean);
  const matches: GrepMatch[] = [];
  // Context lines accumulate between match messages
  const pendingContextBefore: string[] = [];

  for (const raw of lines) {
    let msg: RgMessage;
    try {
      msg = JSON.parse(raw) as RgMessage;
    } catch {
      continue;
    }

    if (msg.type === "match") {
      const relFile = path.relative(projectRoot, msg.data.path.text);
      const match: GrepMatch = {
        file: relFile,
        line: msg.data.line_number,
        content: msg.data.lines.text.trimEnd(),
      };
      if (pendingContextBefore.length > 0) {
        match.context_before = [...pendingContextBefore];
        pendingContextBefore.length = 0;
      }
      matches.push(match);
    } else if (msg.type === "context") {
      const contextLine = msg.data.lines.text.trimEnd();
      const contextLineNum = msg.data.line_number;
      const lastMatch = matches[matches.length - 1];

      if (lastMatch && contextLineNum > lastMatch.line) {
        // After the last match — attach as context_after
        lastMatch.context_after ??= [];
        lastMatch.context_after.push(contextLine);
      } else {
        // Before any match in this group — buffer for next match
        pendingContextBefore.push(contextLine);
      }
    } else if (msg.type === "begin") {
      pendingContextBefore.length = 0;
    }
  }

  return matches;
}
