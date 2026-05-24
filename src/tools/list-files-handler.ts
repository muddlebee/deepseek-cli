import * as fs from "fs";
import * as path from "path";
import type { ToolExecutionContext, ToolExecutionResult } from "./executor";

const MAX_ENTRIES = 500;
const DEFAULT_MAX_DEPTH = 5;

type ListFilesResult = {
  files: string[];
  dirs: string[];
  total: number;
  truncated: boolean;
};

export async function handleListFilesTool(
  args: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const targetPath = typeof args.path === "string" ? args.path : context.projectRoot;
  const pattern = typeof args.pattern === "string" ? args.pattern : undefined;
  const recursive = args.recursive !== false; // default true
  const maxDepth = typeof args.max_depth === "number" ? Math.min(Math.max(1, args.max_depth), 20) : DEFAULT_MAX_DEPTH;

  if (!fs.existsSync(targetPath)) {
    return { ok: false, name: "ListFiles", error: `Path does not exist: ${targetPath}` };
  }

  const stat = fs.statSync(targetPath);
  if (!stat.isDirectory()) {
    return { ok: false, name: "ListFiles", error: `Path is not a directory: ${targetPath}` };
  }

  const matcher = pattern ? buildGlobMatcher(pattern) : null;
  const result: ListFilesResult = { files: [], dirs: [], total: 0, truncated: false };

  walk(targetPath, context.projectRoot, recursive ? maxDepth : 1, matcher, result);

  result.files.sort();
  result.dirs.sort();

  return {
    ok: true,
    name: "ListFiles",
    output: JSON.stringify(result),
    metadata: { total: result.total, truncated: result.truncated },
  };
}

function walk(
  dir: string,
  projectRoot: string,
  depthLeft: number,
  matcher: ((name: string) => boolean) | null,
  result: ListFilesResult
): void {
  if (result.truncated) return;

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (result.total >= MAX_ENTRIES) {
      result.truncated = true;
      return;
    }

    // Skip hidden files/dirs and node_modules at any depth
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;

    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(projectRoot, fullPath);

    if (entry.isDirectory()) {
      if (!matcher || matcher(entry.name)) {
        result.dirs.push(relPath);
        result.total++;
      }
      if (depthLeft > 1) {
        walk(fullPath, projectRoot, depthLeft - 1, matcher, result);
      }
    } else if (entry.isFile()) {
      if (!matcher || matcher(entry.name)) {
        result.files.push(relPath);
        result.total++;
      }
    }
  }
}

// Converts a simple glob pattern (*, ?, **) to a RegExp for filename matching.
function buildGlobMatcher(pattern: string): (name: string) => boolean {
  const regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&") // escape special regex chars
    .replace(/\*\*/g, ".+") // ** → match anything including slashes
    .replace(/\*/g, "[^/]*") // * → match within a single segment
    .replace(/\?/g, "[^/]"); // ? → match single char
  const regex = new RegExp(`^${regexStr}$`, "i");
  return (name: string) => regex.test(name);
}
