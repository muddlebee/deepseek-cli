export const DEEPSEEK_V4_MODELS = new Set([
  "deepseek-v4-flash",
  "deepseek-v4-pro",
  "deepseek-chat", // legacy alias → deepseek-v4-flash
  "deepseek-reasoner", // legacy alias → deepseek-v4-flash
]);

export const NON_MULTIMODAL_MODELS = new Set([
  "deepseek-v4-pro",
  "deepseek-v4-flash",
  "deepseek-chat",
  "deepseek-reasoner",
]);

export function defaultsToThinkingMode(model: string): boolean {
  return DEEPSEEK_V4_MODELS.has(model);
}

export function supportsMultimodal(model: string): boolean {
  return !NON_MULTIMODAL_MODELS.has(model.trim());
}
