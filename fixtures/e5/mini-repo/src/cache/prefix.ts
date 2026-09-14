export type PromptPart = { stable: boolean; text: string };

export function stablePrefix(parts: PromptPart[]): string {
  return parts.filter((p) => p.stable).map((p) => p.text).join('\n');
}

export function shaPreview(s: string): string {
  return s.slice(0, 32);
}
