import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { getExecExitCodeForStatus, parseExecArgs, runExec } from "../exec";
import { SessionManager } from "../session";

function createChatResponse(content: string, usage: Record<string, unknown>): unknown {
  return {
    choices: [{ message: { content } }],
    usage,
  };
}

function createMockOpenAIClient(responses: unknown[]) {
  return () => ({
    client: {
      chat: {
        completions: {
          create: async () => {
            const response = responses.shift();
            assert.ok(response, "expected a queued chat response");
            return response;
          },
        },
      },
    } as never,
    model: "test-model",
    baseURL: "https://api.deepseek.com",
    thinkingEnabled: false,
    reasoningEffort: "high" as const,
    debugLogEnabled: false,
    env: {},
  });
}

function withIsolatedHome(run: (home: string) => Promise<void> | void): Promise<void> {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "doku-exec-home-"));
  const previousHome = process.env.HOME;
  process.env.HOME = home;
  return Promise.resolve(run(home)).finally(() => {
    if (previousHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = previousHome;
    }
  });
}

test("parseExecArgs requires --prompt", () => {
  const result = parseExecArgs(["--non-interactive"]);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.exitCode, 2);
    assert.match(result.error, /--prompt is required/);
  }
});

test("parseExecArgs parses prompt, cwd, and timeout", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "doku-exec-parse-"));
  const result = parseExecArgs(["--non-interactive", "--prompt", "fix the bug", "--cwd", cwd, "--timeout-sec", "120"]);
  assert.equal(result.ok, true);
  if (result.ok && !result.help) {
    assert.equal(result.options.prompt, "fix the bug");
    assert.equal(result.options.cwd, cwd);
    assert.equal(result.options.nonInteractive, true);
    assert.equal(result.options.timeoutSec, 120);
  }
});

test("parseExecArgs rejects unknown flags", () => {
  const result = parseExecArgs(["--prompt", "hello", "--bogus"]);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.error, /Unknown argument/);
  }
});

test("parseExecArgs rejects invalid timeout", () => {
  const result = parseExecArgs(["--prompt", "hello", "--timeout-sec", "0"]);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.error, /positive number/);
  }
});

test("parseExecArgs parses max-turns and mcp flag", () => {
  const result = parseExecArgs(["--prompt", "hello", "--max-turns", "25", "--mcp"]);
  assert.equal(result.ok, true);
  if (result.ok && !result.help) {
    assert.equal(result.options.maxTurns, 25);
    assert.equal(result.options.enableMcp, true);
  }
});

test("parseExecArgs parses output path", () => {
  const result = parseExecArgs(["--prompt", "hello", "--output", "/tmp/doku-run.jsonl"]);
  assert.equal(result.ok, true);
  if (result.ok && !result.help) {
    assert.equal(result.options.outputPath, "/tmp/doku-run.jsonl");
  }
});

test("getExecExitCodeForStatus maps completed to 0", () => {
  assert.equal(getExecExitCodeForStatus("completed"), 0);
  assert.equal(getExecExitCodeForStatus("failed"), 1);
  assert.equal(getExecExitCodeForStatus("waiting_for_user"), 1);
  assert.equal(getExecExitCodeForStatus("interrupted"), 1);
  assert.equal(getExecExitCodeForStatus(null), 1);
});

test("runExec returns 2 when API key is missing", async () => {
  await withIsolatedHome(async (home) => {
    const workspace = fs.mkdtempSync(path.join(home, "doku-exec-workspace-"));
    const exitCode = await runExec({
      prompt: "hello",
      cwd: workspace,
      nonInteractive: true,
    });
    assert.equal(exitCode, 2);
  });
});

test("runExec writes session_start and session_end to output log", async () => {
  await withIsolatedHome(async (home) => {
    const workspace = fs.mkdtempSync(path.join(home, "doku-exec-workspace-"));
    fs.mkdirSync(path.join(home, ".doku"), { recursive: true });
    fs.writeFileSync(
      path.join(home, ".doku", "settings.json"),
      JSON.stringify({
        env: {
          API_KEY: "test-key",
          MODEL: "test-model",
          BASE_URL: "https://api.deepseek.com",
        },
      }),
      "utf8"
    );

    const outputPath = path.join(workspace, "run.jsonl");
    const responses = [createChatResponse("done", { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 })];
    const exitCode = await runExec(
      {
        prompt: "finish the task",
        cwd: workspace,
        nonInteractive: true,
        outputPath,
      },
      {
        createSessionManager: (options, hooks) =>
          new SessionManager({
            projectRoot: options.cwd,
            createOpenAIClient: createMockOpenAIClient(responses),
            getResolvedSettings: () => ({ model: "test-model" }),
            renderMarkdown: (text) => text,
            onAssistantMessage: (message) => {
              hooks?.onMessage?.(message);
            },
            onSessionEntryUpdated: (entry) => {
              hooks?.onSessionEntryUpdated?.(entry);
            },
            nonInteractive: true,
          }),
      }
    );

    assert.equal(exitCode, 0);
    const events = fs
      .readFileSync(outputPath, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as { type: string; exitCode?: number; prompt?: string });
    assert.ok(events.some((event) => event.type === "session_start" && event.prompt === "finish the task"));
    assert.ok(events.some((event) => event.type === "session_end" && event.exitCode === 0));
  });
});

test("non-interactive maxTurns fails when the turn budget is exhausted", async () => {
  await withIsolatedHome(async (home) => {
    const workspace = fs.mkdtempSync(path.join(home, "doku-exec-workspace-"));
    const responses: unknown[] = [
      {
        choices: [
          {
            message: {
              content: "",
              tool_calls: [
                {
                  id: "call-bash-1",
                  type: "function",
                  function: { name: "bash", arguments: JSON.stringify({ command: "printf one" }) },
                },
              ],
            },
          },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 0, total_tokens: 1 },
      },
      {
        choices: [
          {
            message: {
              content: "",
              tool_calls: [
                {
                  id: "call-bash-2",
                  type: "function",
                  function: { name: "bash", arguments: JSON.stringify({ command: "printf two" }) },
                },
              ],
            },
          },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 0, total_tokens: 1 },
      },
    ];

    const manager = new SessionManager({
      projectRoot: workspace,
      createOpenAIClient: createMockOpenAIClient(responses),
      getResolvedSettings: () => ({ model: "test-model" }),
      renderMarkdown: (text) => text,
      onAssistantMessage: () => {},
      nonInteractive: true,
      maxTurns: 2,
    });

    await manager.handleUserPrompt({ text: "loop" });
    const session = manager.getSession(manager.getActiveSessionId()!);
    assert.equal(session?.status, "failed");
    assert.equal(session?.failReason, "max turns reached");
  });
});
