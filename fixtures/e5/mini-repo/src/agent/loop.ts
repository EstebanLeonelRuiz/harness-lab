import type { Task, Result } from '../types.js';
import { TOOLS } from './tools.js';

export async function agentLoop(task: Task): Promise<Result> {
  // illustrative loop body with enough lines for packing comparison
  const tools = TOOLS.map((t) => t.name).join(',');
  return { ok: true, tokensUsed: 1200, summary: `ran with ${tools} for ${task.id}` };
}

export function planSteps(task: Task): string[] {
  return ['explore', 'edit', 'test', 'summarize'].map((s) => `${task.id}:${s}`);
}
