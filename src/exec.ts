import * as fs from "fs";
import * as path from "path";
import { createOpenAIClient } from "./common/openai-client";
import { setShellIfWindows } from "./common/shell-utils";
import { SessionManager, type SessionStatus } from "./session";
import { resolveCurrentSettings } from "./ui/App";

export type ExecOptions = {
  prompt: string;
  cwd: string;
  nonInteractive: boolean;
  timeoutSec?: number;
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
    },
  };
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

  const sessionManager = new SessionManager({
    projectRoot,
    createOpenAIClient: () => createOpenAIClient(projectRoot),
    getResolvedSettings: () => resolveCurrentSettings(projectRoot),
    renderMarkdown: (text) => text,
    onAssistantMessage: () => {},
  });

  try {
    await sessionManager.initMcpServers(settings.mcpServers);
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
      return 1;
    }
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`doku exec: ${message}\n`);
    return 1;
  } finally {
    sessionManager.dispose();
    if (options.cwd !== previousCwd) {
      process.chdir(previousCwd);
    }
  }

  const sessionId = sessionManager.getActiveSessionId();
  const status = sessionId ? sessionManager.getSession(sessionId)?.status : null;
  return getExecExitCodeForStatus(status);
}
