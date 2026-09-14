export interface Task { id: string; prompt: string; budgetTokens?: number }
export interface Result { ok: boolean; tokensUsed: number; summary: string }
export interface ToolSpec { name: string; schema: Record<string, unknown> }
export interface FileMeta { path: string; signature: string; bytes: number }
