import assert from "node:assert/strict";
import test from "node:test";
import { formatSummary, parseRunLog } from "../../benchmarks/smoke/score-run.mjs";

test("parseRunLog aggregates session and tool metrics", () => {
  const log = [
    '{"type":"session_start","model":"deepseek-chat"}',
    '{"type":"tool_call","sessionId":"s1"}',
    '{"type":"tool_result","sessionId":"s1"}',
    '{"type":"session_end","exitCode":0,"status":"completed","durationMs":1200,"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}',
  ].join("\n");

  const metrics = parseRunLog(log);
  assert.equal(metrics.exitCode, 0);
  assert.equal(metrics.toolCalls, 1);
  assert.equal(metrics.toolResults, 1);
  assert.equal(metrics.totalTokens, 15);
  assert.equal(metrics.durationMs, 1200);
});

test("formatSummary renders harness and verify status", () => {
  const line = formatSummary("fix-typo", 0, 0, {
    toolCalls: 2,
    toolResults: 2,
    durationMs: 4500,
    totalTokens: 900,
  });
  assert.match(line, /fix-typo: harness=ok verify=pass/);
  assert.match(line, /4\.5s/);
});
