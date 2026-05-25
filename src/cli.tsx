import React from "react";
import { render } from "ink";
import { setShellIfWindows } from "./common/shell-utils";
import { parseExecArgs, printExecHelp, runExec } from "./exec";
import { checkForNpmUpdate, promptForPendingUpdate, type PackageInfo } from "./updateCheck";
import { AppContainer } from "./ui";
import pkg from "../package.json";

const args = process.argv.slice(2);
const packageInfo: PackageInfo = {
  name: typeof pkg.name === "string" ? pkg.name : "doku-deepseek-cli",
  version: typeof pkg.version === "string" ? pkg.version : "",
};

if (args.includes("--version") || args.includes("-v")) {
  process.stdout.write(`${packageInfo.version || "unknown"}\n`);
  process.exit(0);
}

if (args[0] === "exec") {
  void runExecCommand(args.slice(1));
} else if (args.includes("--help") || args.includes("-h")) {
  process.stdout.write(buildMainHelp());
  process.exit(0);
} else {
  void runInteractiveCli();
}

async function runExecCommand(execArgs: string[]): Promise<void> {
  configureWindowsShell();
  const parsed = parseExecArgs(execArgs);
  if (!parsed.ok) {
    process.stderr.write(`doku exec: ${parsed.error}\n`);
    process.exit(parsed.exitCode);
  }
  if (parsed.help) {
    printExecHelp();
    process.exit(0);
  }
  const exitCode = await runExec(parsed.options);
  process.exit(exitCode);
}

async function runInteractiveCli(): Promise<void> {
  if (args.includes("--help") || args.includes("-h")) {
    process.stdout.write(buildMainHelp());
    process.exit(0);
  }

  let initialPrompt = extractInitialPrompt(args);
  const projectRoot = process.cwd();
  configureWindowsShell();

  if (!process.stdin.isTTY) {
    process.stderr.write("doku requires an interactive terminal (TTY). " + "Re-run from a real terminal session.\n");
    process.exit(1);
  }

  const updatePromptResult = await promptForPendingUpdate(packageInfo);

  const restartRef: { current: (() => void) | null } = { current: null };

  function startApp(): void {
    let restarting = false;
    const appInitialPrompt = initialPrompt;
    initialPrompt = undefined;
    const inkInstance = render(
      <AppContainer
        projectRoot={projectRoot}
        version={packageInfo.version}
        initialPrompt={appInitialPrompt}
        onRestart={() => restartRef.current?.()}
      />,
      { exitOnCtrlC: false }
    );

    restartRef.current = () => {
      restarting = true;
      process.stdout.write("\u001B[2J\u001B[3J\u001B[H");
      inkInstance.unmount();
      startApp();
    };

    inkInstance.waitUntilExit().then(() => {
      if (!restarting) {
        restartRef.current = null;
        process.exit(0);
      }
    });
  }

  if (!updatePromptResult.installed) {
    void checkForNpmUpdate(packageInfo);
  }

  startApp();
}

function buildMainHelp(): string {
  return (
    [
      "doku — DeepSeek AI coding assistant",
      "",
      "Usage:",
      "  doku                              Launch the interactive TUI in the current directory",
      "  doku exec --prompt <text>         Run one task without the interactive TUI",
      "  doku -p <prompt>                  Launch with a pre-filled prompt",
      "  doku --prompt <prompt>            Same as -p",
      "  doku exec --help                  Headless exec mode help",
      "  doku --version                    Print the version",
      "  doku --help                       Show this help",
      "",
      "Configuration:",
      "  ~/.doku/settings.json    User-level API key, model, base URL",
      "  ./.doku/settings.json    Project-level settings",
      "  ~/.agents/skills/*/SKILL.md  User-level skills",
      "  ./.agents/skills/*/SKILL.md  Project-level skills",
      "  ./.doku/skills/*/SKILL.md Legacy project-level skills",
      "",
      "Inside the TUI:",
      "  enter            Send the prompt",
      "  shift+enter      Insert a newline",
      "  home/end         Move within the current line",
      "  alt+left/right   Move by word",
      "  ctrl+w           Delete the previous word",
      "  ctrl+v           Paste an image from the clipboard",
      "  ctrl+x           Clear pasted images",
      "  esc              Interrupt the current model turn",
      "  /                Open the skills/commands menu",
      "  /skills          List available skills",
      "  /model           Select model, thinking mode and effort control",
      "  /new             Start a fresh conversation",
      "  /init            Initialize an AGENTS.md file with instructions for LLM",
      "  /resume          Pick a previous conversation to continue",
      "  /continue        Continue the active conversation, or resume one if empty",
      "  /undo            Restore code and/or conversation to a previous point",
      "  /mcp             Show MCP server status and available tools",
      "  /raw             Toggle display mode for viewing or collapsing reasoning content",
      "  /ideate          Load idea-refine workflow for refining ideas",
      "  /plan            Load planning-and-task-breakdown workflow",
      "  /debug           Load debugging-and-error-recovery workflow",
      "  /build           Load incremental-implementation workflow",
      "  /review          Load code-review-and-quality workflow",
      "  /exit            Quit",
      "  ctrl+c twice     Quit",
    ].join("\n") + "\n"
  );
}

function extractInitialPrompt(args: string[]): string | undefined {
  const promptIndex = args.findIndex((arg) => arg === "-p" || arg === "--prompt");
  if (promptIndex !== -1 && promptIndex + 1 < args.length) {
    return args[promptIndex + 1];
  }
  return undefined;
}

function configureWindowsShell(): void {
  process.env.NoDefaultCurrentDirectoryInExePath = "1";
  try {
    setShellIfWindows();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`doku: ${message}\n`);
    process.exit(1);
  }
}
