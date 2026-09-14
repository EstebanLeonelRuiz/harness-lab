import { agentLoop } from './agent/loop.js';
import type { Task } from './types.js';

export async function main(task: Task): Promise<void> {
  const result = await agentLoop(task);
  console.log(JSON.stringify(result));
}
