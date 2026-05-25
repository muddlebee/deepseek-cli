import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { getExecExitCodeForStatus, parseExecArgs } from "../exec";

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

test("getExecExitCodeForStatus maps completed to 0", () => {
  assert.equal(getExecExitCodeForStatus("completed"), 0);
  assert.equal(getExecExitCodeForStatus("failed"), 1);
  assert.equal(getExecExitCodeForStatus("waiting_for_user"), 1);
  assert.equal(getExecExitCodeForStatus("interrupted"), 1);
  assert.equal(getExecExitCodeForStatus(null), 1);
});
