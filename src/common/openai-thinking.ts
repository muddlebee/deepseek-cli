import type { ReasoningEffort } from "../settings";

type ThinkingConfig = {
  type: "enabled" | "disabled";
};

type ThinkingRequestOptions = {
  extra_body: {
    thinking: ThinkingConfig;
    reasoning_effort?: ReasoningEffort;
  };
};

export function buildThinkingRequestOptions(
  thinkingEnabled: boolean,
  _baseURL?: string,
  reasoningEffort: ReasoningEffort = "max"
): ThinkingRequestOptions {
  return {
    extra_body: {
      thinking: { type: thinkingEnabled ? "enabled" : "disabled" },
      ...(thinkingEnabled ? { reasoning_effort: reasoningEffort } : {}),
    },
  };
}
