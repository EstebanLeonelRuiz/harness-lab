import type { FileMeta } from '../types.js';

export function fileCenteredScaffold(files: FileMeta[]): string {
  return files.map((f) => `${f.path} — ${f.signature}`).join('\n');
}

export function flatConcat(files: { path: string; content: string }[]): string {
  return files.map((f) => `===== ${f.path} =====\n${f.content}`).join('\n\n');
}
