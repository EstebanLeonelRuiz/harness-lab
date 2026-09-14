import type { DemoMeta } from '../types'

export const DEMOS: DemoMeta[] = [
  {
    id: 'prompt-cache',
    title: 'Prompt Cache',
    blurb: 'Reordená bloques y mirá el costo con/sin caché de prefijo.',
    themes: ['cache', 'economics'],
  },
  {
    id: 'trajectory-prune',
    title: 'Trajectory Prune',
    blurb: 'Slider de compresión; alerta si el control cae bajo ~50%.',
    themes: ['compression', 'security'],
  },
  {
    id: 'agents-md-hygiene',
    title: 'AGENTS.md Hygiene',
    blurb: 'Reglas con razón + señal de borrado; crecimiento con/sin higiene.',
    themes: ['memory', 'harness'],
  },
  {
    id: 'repo-nav',
    title: 'Repo Nav',
    blurb: 'Navegación centrada en archivos vs snippets planos.',
    themes: ['navigation'],
  },
  {
    id: 'bash-vs-typed',
    title: 'Bash vs Typed Tools',
    blurb: 'Comparación de tokens/costo: bash suele usar 19–72% menos.',
    themes: ['skills', 'economics'],
  },
  {
    id: 'economics',
    title: 'Economics Dashboard',
    blurb: '$/tarea con techos de presupuesto; tokens ≠ dólares.',
    themes: ['economics'],
  },
  {
    id: 'kv-eviction',
    title: 'KV Eviction',
    blurb: 'Timeline LRU vs eviction agent-aware (bonus).',
    themes: ['cache', 'serving'],
  },
]
