import * as fs from "fs";
import * as path from "path";
import { createOpenAIClient } from "./common/openai-client";
import { RunLogger } from "./common/run-logger";
import { setShellIfWindows } from "./common/shell-utils";
import { SessionManager, type SessionEntry, type SessionMessage, type SessionStatus } from "./session";
import { resolveCurrentSettings } from "./ui/App";
import pkg from "../package.json";

export type ExecOptions = {
  prompt: string;
  cwd: string;
  nonInteractive: boolean;
  timeoutSec?: number;
  maxTurns?: number;
  enableMcp?: boolean;
  outputPath?: string;
};

export type ExecParseResult =
  | { ok: true; options: ExecOptions; help?: false }
  | { ok: false; error: string; exitCode: number }
  | { ok: true; help: true };

export function printExecHelp(): void {
  process.stdout.write(
    [
      "doku exec — run one agent task without the interactive TUI",
      "",
      "Usage:",
      "  doku exec --prompt <text> [options]",
      "  doku exec -p <text> [options]",
      "",
      "Options:",
      "  --prompt, -p <text>       Task instruction (required)",
      "  --non-interactive         Required for headless runs (implicit with exec)",
      "  --cwd <path>              Working directory (default: current directory)",
      "  --timeout-sec <seconds>   Abort the run after this many seconds",
      "  --max-turns <count>       Limit model turns (default: unlimited in exec)",
      "  --mcp                     Enable MCP servers from settings (disabled by default)",
      "  --output <path>           Write JSONL run events to this file",
      "  --help, -h                Show this help",
      "",
      "Environment:",
      "  DOKU_*                    Same settings as the interactive CLI",
      "",
      "Exit codes:",
      "  0   Session completed",
      "  1   Session failed, interrupted, or waiting for user input",
      "  2   Invalid arguments or configuration",
    ].join("\n") + "\n"
  );
}

export function parseExecArgs(args: string[]): ExecParseResult {
  if (args.includes("--help") || args.includes("-h")) {
    return { ok: true, help: true };
  }

  let prompt: string | undefined;
  let cwd: string | undefined;
  let timeoutSec: number | undefined;
  let maxTurns: number | undefined;
  let enableMcp = false;
  let outputPath: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--prompt" || arg === "-p") {
      const value = args[index + 1];
      if (!value || value.startsWith("-")) {
        return { ok: false, error: "Missing value for --prompt.", exitCode: 2 };
      }
      prompt = value;
      index += 1;
      continue;
    }
    if (arg === "--cwd") {
      const value = args[index + 1];
      if (!value || value.startsWith("-")) {
        return { ok: false, error: "Missing value for --cwd.", exitCode: 2 };
      }
      cwd = value;
      index += 1;
      continue;
    }
    if (arg === "--timeout-sec") {
      const value = args[index + 1];
      if (!value || value.startsWith("-")) {
        return { ok: false, error: "Missing value for --timeout-sec.", exitCode: 2 };
      }
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return { ok: false, error: "--timeout-sec must be a positive number.", exitCode: 2 };
      }
      timeoutSec = parsed;
      index += 1;
      continue;
    }
    if (arg === "--non-interactive") {
      continue;
    }
    if (arg === "--mcp") {
      enableMcp = true;
      continue;
    }
    if (arg === "--output") {
      const value = args[index + 1];
      if (!value || value.startsWith("-")) {
        return { ok: false, error: "Missing value for --output.", exitCode: 2 };
      }
      outputPath = path.resolve(value);
      index += 1;
      continue;
    }
    if (arg === "--max-turns") {
      const value = args[index + 1];
      if (!value || value.startsWith("-")) {
        return { ok: false, error: "Missing value for --max-turns.", exitCode: 2 };
      }
      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        return { ok: false, error: "--max-turns must be a positive integer.", exitCode: 2 };
      }
      maxTurns = parsed;
      index += 1;
      continue;
    }
    return { ok: false, error: `Unknown argument: ${arg}`, exitCode: 2 };
  }

  if (!prompt?.trim()) {
    return { ok: false, error: "--prompt is required.", exitCode: 2 };
  }

  const resolvedCwd = cwd ? path.resolve(cwd) : process.cwd();
  if (!fs.existsSync(resolvedCwd)) {
    return { ok: false, error: `--cwd does not exist: ${resolvedCwd}`, exitCode: 2 };
  }
  if (!fs.statSync(resolvedCwd).isDirectory()) {
    return { ok: false, error: `--cwd is not a directory: ${resolvedCwd}`, exitCode: 2 };
  }

  return {
    ok: true,
    options: {
      prompt: prompt.trim(),
      cwd: resolvedCwd,
      nonInteractive: true,
      timeoutSec,
      maxTurns,
      enableMcp,
      outputPath,
    },
  };
}

export function createExecSessionManager(
  options: ExecOptions,
  hooks?: {
    onMessage?: (message: SessionMessage) => void;
    onSessionEntryUpdated?: (entry: SessionEntry) => void;
  }
): SessionManager {
  const projectRoot = options.cwd;
  return new SessionManager({
    projectRoot,
    createOpenAIClient: () => createOpenAIClient(projectRoot),
    getResolvedSettings: () => {
      const resolved = resolveCurrentSettings(projectRoot);
      if (options.enableMcp) {
        return resolved;
      }
      return {
        ...resolved,
        mcpServers: undefined,
      };
    },
    renderMarkdown: (text) => text,
    onAssistantMessage: (message) => {
      hooks?.onMessage?.(message);
    },
    onSessionEntryUpdated: (entry) => {
      hooks?.onSessionEntryUpdated?.(entry);
    },
    nonInteractive: true,
    maxTurns: options.maxTurns,
  });
}

function logExecMessage(runLogger: RunLogger | null, message: SessionMessage): void {
  if (!runLogger) {
    return;
  }

  if (message.role === "assistant") {
    const toolCalls = (message.messageParams as { tool_calls?: unknown[] } | null)?.tool_calls;
    if (Array.isArray(toolCalls) && toolCalls.length > 0) {
      runLogger.emit({
        type: "tool_call",
        sessionId: message.sessionId,
        toolCalls,
      });
      return;
    }
    if (message.content) {
      runLogger.emit({
        type: "assistant_message",
        sessionId: message.sessionId,
        content: message.content,
      });
    }
    return;
  }

  if (message.role === "tool") {
    runLogger.emit({
      type: "tool_result",
      sessionId: message.sessionId,
      content: message.content,
      function: message.meta?.function,
    });
  }
}

function logExecSessionUpdate(runLogger: RunLogger | null, entry: SessionEntry): void {
  if (!runLogger) {
    return;
  }
  runLogger.emit({
    type: "session_status",
    sessionId: entry.id,
    status: entry.status,
    failReason: entry.failReason,
  });
}

export function getExecExitCodeForStatus(status: SessionStatus | null | undefined): number {
  if (status === "completed") {
    return 0;
  }
  return 1;
}

export async function runExec(options: ExecOptions): Promise<number> {
  const previousCwd = process.cwd();
  if (options.cwd !== previousCwd) {
    process.chdir(options.cwd);
  }

  try {
    process.env.NoDefaultCurrentDirectoryInExePath = "1";
    setShellIfWindows();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`doku exec: ${message}\n`);
    return 2;
  }

  const projectRoot = options.cwd;
  const settings = resolveCurrentSettings(projectRoot);
  if (!settings.apiKey) {
    process.stderr.write(
      "doku exec: API key not found. Configure ~/.doku/settings.json, ./.doku/settings.json, or DOKU_API_KEY.\n"
    );
    return 2;
  }

  const startedAt = Date.now();
  const runLogger = options.outputPath ? new RunLogger(options.outputPath) : null;
  const version = typeof pkg.version === "string" ? pkg.version : "unknown";

  if (runLogger) {
    runLogger.emit({
      type: "session_start",
      prompt: options.prompt,
      cwd: options.cwd,
      model: settings.model,
      version,
      maxTurns: options.maxTurns ?? null,
    });
  }

  const sessionManager = createExecSessionManager(options, {
    onMessage: (message) => logExecMessage(runLogger, message),
    onSessionEntryUpdated: (entry) => logExecSessionUpdate(runLogger, entry),
  });

  let exitCode = 1;

  try {
    if (options.enableMcp) {
      await sessionManager.initMcpServers(settings.mcpServers);
    }
    const runPromise = sessionManager.handleUserPrompt({ text: options.prompt });
    if (options.timeoutSec != null) {
      const timeoutMs = options.timeoutSec * 1000;
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          runPromise,
          new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => {
              sessionManager.interruptActiveSession();
              reject(new Error("timeout"));
            }, timeoutMs);
          }),
        ]);
      } finally {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      }
    } else {
      await runPromise;
    }
  } catch (error) {
    if (error instanceof Error && error.message === "timeout") {
      process.stderr.write("doku exec: timed out.\n");
      exitCode = 1;
    } else {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`doku exec: ${message}\n`);
      exitCode = 1;
    }
  } finally {
    sessionManager.dispose();
    if (options.cwd !== previousCwd) {
      process.chdir(previousCwd);
    }
  }

  const sessionId = sessionManager.getActiveSessionId();
  const session = sessionId ? sessionManager.getSession(sessionId) : null;
  exitCode = getExecExitCodeForStatus(session?.status);

  if (runLogger) {
    runLogger.emit({
      type: "session_end",
      sessionId,
      status: session?.status ?? null,
      exitCode,
      durationMs: Date.now() - startedAt,
      model: settings.model,
      usage: session?.usage ?? null,
      failReason: session?.failReason ?? null,
    });
  }

  return exitCode;
}
