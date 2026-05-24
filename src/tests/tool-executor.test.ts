import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { setTimeout as delay } from "node:timers/promises";
import { ToolExecutor } from "../tools/executor";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

test("ToolExecutor accepts title-case built-in tool aliases", async () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "doku-tool-executor-"));
  tempDirs.push(workspace);
  const filePath = path.join(workspace, "sample.txt");
  fs.writeFileSync(filePath, "alpha\nbeta\n", "utf8");

  const executor = new ToolExecutor(workspace);
  const executions = await executor.executeToolCalls("alias-session", [
    {
      id: "call-read",
      type: "function",
      function: {
        name: "Read",
        arguments: JSON.stringify({ file_path: filePath }),
      },
    },
  ]);

  assert.equal(executions.length, 1);
  assert.equal(executions[0]?.result.ok, true);
  assert.equal(executions[0]?.result.name, "read");
  assert.match(executions[0]?.result.output ?? "", /alpha/);
});

test("ToolExecutor runs parallel-safe tools concurrently", async () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "doku-tool-executor-"));
  tempDirs.push(workspace);

  const executor = new ToolExecutor(workspace) as any;

  let inFlight = 0;
  let maxInFlight = 0;
  executor.toolHandlers.set("read", async () => {
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await delay(30);
    inFlight -= 1;
    return { ok: true, name: "read" };
  });

  await executor.executeToolCalls("parallel-safe", [
    buildToolCall("call-1", "read"),
    buildToolCall("call-2", "read"),
    buildToolCall("call-3", "read"),
  ]);

  assert.ok(maxInFlight >= 2);
});

test("ToolExecutor runs mutating tools sequentially", async () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "doku-tool-executor-"));
  tempDirs.push(workspace);

  const executor = new ToolExecutor(workspace) as any;

  let inFlight = 0;
  let maxInFlight = 0;
  const runOrder: string[] = [];
  executor.toolHandlers.set("write", async (args: Record<string, unknown>) => {
    const callId = String(args.call_id ?? "unknown");
    runOrder.push(`${callId}:start`);
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await delay(20);
    inFlight -= 1;
    runOrder.push(`${callId}:end`);
    return { ok: true, name: "write" };
  });

  await executor.executeToolCalls("serial-mutations", [
    buildToolCall("write-1", "write", { call_id: "write-1" }),
    buildToolCall("write-2", "write", { call_id: "write-2" }),
  ]);

  assert.equal(maxInFlight, 1);
  assert.deepEqual(runOrder, ["write-1:start", "write-1:end", "write-2:start", "write-2:end"]);
});

function buildToolCall(id: string, name: string, args: Record<string, unknown> = {}) {
  return {
    id,
    type: "function" as const,
    function: {
      name,
      arguments: JSON.stringify(args),
    },
  };
}
