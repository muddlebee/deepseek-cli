import React, { useState } from "react";
import { Box, Text } from "ink";
import { PasswordInput, TextInput } from "@inkjs/ui";
import { ThemedGradient } from "./ThemedGradient";
import figlet from "figlet";

const LOGO = figlet.textSync("doku", { font: "Slant" });
const DEFAULT_BASE_URL = "https://api.deepseek.com/v1";

type Step = "api-key" | "base-url";

type SetupResult = {
  apiKey: string;
  baseURL: string;
};

type SetupScreenProps = {
  onComplete: (result: SetupResult) => void;
};

export function SetupScreen({ onComplete }: SetupScreenProps): React.ReactElement {
  const [step, setStep] = useState<Step>("api-key");
  const [apiKey, setApiKey] = useState("");

  function handleApiKeySubmit(value: string): void {
    const trimmed = value.trim();
    if (!trimmed) return;
    setApiKey(trimmed);
    setStep("base-url");
  }

  function handleBaseURLSubmit(value: string): void {
    const trimmed = value.trim();
    onComplete({ apiKey, baseURL: trimmed || DEFAULT_BASE_URL });
  }

  return (
    <Box flexDirection="column" paddingX={2} marginTop={1} gap={1}>
      <Box>
        <ThemedGradient>{LOGO}</ThemedGradient>
      </Box>

      <Text bold>Welcome! Let&apos;s get you set up.</Text>
      <Text dimColor>Settings will be saved to ~/.doku/settings.json</Text>

      {step === "api-key" && (
        <Box flexDirection="column" gap={1} marginTop={1}>
          <Text>
            <Text color="cyan">API Key</Text>
            <Text dimColor> — your DeepSeek (or compatible) API key</Text>
          </Text>
          <PasswordInput placeholder="sk-..." onSubmit={handleApiKeySubmit} />
        </Box>
      )}

      {step === "base-url" && (
        <Box flexDirection="column" gap={1} marginTop={1}>
          <Text color="green">✓ API key saved</Text>
          <Text>
            <Text color="cyan">Base URL</Text>
            <Text dimColor> — press Enter to use the default ({DEFAULT_BASE_URL})</Text>
          </Text>
          <TextInput placeholder={DEFAULT_BASE_URL} onSubmit={handleBaseURLSubmit} />
        </Box>
      )}
    </Box>
  );
}
