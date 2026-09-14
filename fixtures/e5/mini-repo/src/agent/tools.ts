import type { ToolSpec } from '../types.js';

export const TOOLS: ToolSpec[] = [
  { name: 'read_file', schema: { type: 'object', properties: { path: { type: 'string' } } } },
  { name: 'edit_file', schema: { type: 'object', properties: { path: { type: 'string' }, old: { type: 'string' }, new: { type: 'string' } } } },
  { name: 'bash', schema: { type: 'object', properties: { command: { type: 'string' } } } },
];

export function toolNames(): string[] {
  return TOOLS.map((t) => t.name);
}
