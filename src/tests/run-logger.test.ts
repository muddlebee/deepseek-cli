import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { RunLogger } from "../common/run-logger";

test("RunLogger writes JSONL events with timestamps", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "doku-run-logger-"));
  const outputPath = path.join(dir, "nested", "run.jsonl");
  const logger = new RunLogger(outputPath);

  logger.emit({ type: "session_start", prompt: "hello" });
  logger.emit({ type: "session_end", exitCode: 0 });

  const lines = fs.readFileSync(outputPath, "utf8").trim().split("\n");
  assert.equal(lines.length, 2);

  const first = JSON.parse(lines[0]!) as { type: string; prompt: string; timestamp: string };
  const second = JSON.parse(lines[1]!) as { type: string; exitCode: number; timestamp: string };

  assert.equal(first.type, "session_start");
  assert.equal(first.prompt, "hello");
  assert.ok(first.timestamp);
  assert.equal(second.type, "session_end");
  assert.equal(second.exitCode, 0);
});
