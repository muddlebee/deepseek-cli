/* global process, console, URL */
import fs from "node:fs";

export function parseRunLog(text) {
  const events = text
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  let sessionStart = null;
  let sessionEnd = null;
  let toolCalls = 0;
  let toolResults = 0;

  for (const event of events) {
    if (event.type === "session_start") {
      sessionStart = event;
    } else if (event.type === "session_end") {
      sessionEnd = event;
    } else if (event.type === "tool_call") {
      toolCalls += 1;
    } else if (event.type === "tool_result") {
      toolResults += 1;
    }
  }

  const usage = sessionEnd?.usage ?? null;
  return {
    events: events.length,
    toolCalls,
    toolResults,
    exitCode: sessionEnd?.exitCode ?? null,
    status: sessionEnd?.status ?? null,
    failReason: sessionEnd?.failReason ?? null,
    durationMs: sessionEnd?.durationMs ?? null,
    model: sessionEnd?.model ?? sessionStart?.model ?? null,
    promptTokens: usage?.prompt_tokens ?? null,
    completionTokens: usage?.completion_tokens ?? null,
    totalTokens: usage?.total_tokens ?? null,
  };
}

export function formatSummary(taskName, harnessExit, verifyExit, metrics) {
  const harness = harnessExit === 0 ? "ok" : `fail(${harnessExit})`;
  const verify = verifyExit === 0 ? "pass" : verifyExit == null ? "skipped" : `fail(${verifyExit})`;
  const duration = metrics.durationMs != null ? `${(metrics.durationMs / 1000).toFixed(1)}s` : "?";
  const tokens =
    metrics.totalTokens != null
      ? `${metrics.totalTokens} tok`
      : metrics.promptTokens != null
        ? `${metrics.promptTokens}+${metrics.completionTokens ?? "?"} tok`
        : "? tok";

  return `${taskName}: harness=${harness} verify=${verify} tools=${metrics.toolCalls}/${metrics.toolResults} ${duration} ${tokens}`;
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  const logPath = process.argv[2];
  if (!logPath) {
    process.stderr.write("usage: node score-run.mjs <run.jsonl>\n");
    process.exit(2);
  }
  const metrics = parseRunLog(fs.readFileSync(logPath, "utf8"));
  console.log(JSON.stringify(metrics, null, 2));
}
