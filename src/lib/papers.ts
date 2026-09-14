import raw from '../data/papers.json'
import type { Paper, Theme, DemoId } from '../types'

export const papers = raw as Paper[]

export const THEMES: Theme[] = [
  'cache',
  'compression',
  'harness',
  'serving',
  'memory',
  'economics',
  'navigation',
  'skills',
  'security',
]

export const THEME_LABELS: Record<Theme, string> = {
  cache: 'Caché',
  compression: 'Compresión',
  harness: 'Harness',
  serving: 'Serving',
  memory: 'Memoria',
  economics: 'Economía',
  navigation: 'Navegación',
  skills: 'Skills',
  security: 'Seguridad',
}

export function papersByTheme(theme: Theme): Paper[] {
  return papers.filter((p) => p.themes.includes(theme))
}

export function papersByDemo(demoId: DemoId | string): Paper[] {
  return papers.filter((p) => p.demoId === demoId)
}

export function papersForThemes(themes: Theme[]): Paper[] {
  const set = new Set(themes)
  return papers.filter((p) => p.themes.some((t) => set.has(t)))
}
