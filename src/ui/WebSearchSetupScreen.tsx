import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { PasswordInput, Select } from "@inkjs/ui";
import type { WebSearchProvider } from "../settings";

type Step = "provider" | "api-key";

type WebSearchSetupResult = {
  provider: WebSearchProvider;
  apiKey: string;
};

type WebSearchSetupScreenProps = {
  onComplete: (result: WebSearchSetupResult) => void;
  onCancel: () => void;
};

const PROVIDER_OPTIONS = [
  { label: "Tavily  (1,000 free searches/month)", value: "tavily" },
  { label: "Firecrawl  (500 free credits)", value: "firecrawl" },
];

const PROVIDER_LABELS: Record<WebSearchProvider, string> = {
  tavily: "Tavily",
  firecrawl: "Firecrawl",
};

const PROVIDER_KEY_HINTS: Record<WebSearchProvider, string> = {
  tavily: "tvly-...",
  firecrawl: "fc-...",
};

export function WebSearchSetupScreen({ onComplete, onCancel }: WebSearchSetupScreenProps): React.ReactElement {
  const [step, setStep] = useState<Step>("provider");
  const [provider, setProvider] = useState<WebSearchProvider>("tavily");

  useInput((_input, key) => {
    if (key.escape) {
      onCancel();
    }
  });

  function handleProviderSelect(value: string): void {
    setProvider(value as WebSearchProvider);
    setStep("api-key");
  }

  function handleApiKeySubmit(value: string): void {
    const trimmed = value.trim();
    if (!trimmed) return;
    onComplete({ provider, apiKey: trimmed });
  }

  return (
    <Box flexDirection="column" paddingX={2} marginTop={1} gap={1}>
      <Text bold>Web Search Setup</Text>
      <Text dimColor>Settings will be saved to ~/.doku/settings.json</Text>
      <Text dimColor>Press Escape to cancel</Text>

      {step === "provider" && (
        <Box flexDirection="column" gap={1} marginTop={1}>
          <Text color="cyan">Choose a search provider:</Text>
          <Select options={PROVIDER_OPTIONS} onChange={handleProviderSelect} />
        </Box>
      )}

      {step === "api-key" && (
        <Box flexDirection="column" gap={1} marginTop={1}>
          <Text color="green">✓ Provider: {PROVIDER_LABELS[provider]}</Text>
          <Text>
            <Text color="cyan">{PROVIDER_LABELS[provider]} API Key</Text>
          </Text>
          <PasswordInput placeholder={PROVIDER_KEY_HINTS[provider]} onSubmit={handleApiKeySubmit} />
        </Box>
      )}
    </Box>
  );
}
