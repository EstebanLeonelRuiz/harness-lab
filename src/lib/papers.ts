import raw from '../data/papers.json'
import type { Paper, Theme, DemoId } from '../types'
import { allLabPaperIds } from '../data/labStages'
import { getMeasurements, measuredLabel, assumedPriceLabel } from './costModel'

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

const byId = new Map(papers.map((p) => [p.id, p]))

export function paperById(id: string): Paper | undefined {
  return byId.get(id)
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

export function papersByIds(ids: string[]): Paper[] {
  return ids.map((id) => byId.get(id)).filter((p): p is Paper => p != null)
}

/** Catalog ids missing from lab stage wiring (should be empty). */
export function catalogIdsMissingFromLab(): string[] {
  const wired = new Set(allLabPaperIds())
  return papers.map((p) => p.id).filter((id) => !wired.has(id))
}

export function verifiedCount(): number {
  return papers.filter((p) => p.verified).length
}

/** Paper citation for *why* we measure (not the numeric provenance). */
export function illustrativeSourceLabel(ids: string[]): string {
  if (!ids.length) return 'cualitativo'
  const shown = ids.slice(0, 3).join(', ')
  const more = ids.length > 3 ? ` +${ids.length - 3}` : ''
  return `por qué medimos · arXiv:${shown}${more}`
}

export function policyProvenanceLabel(policyId: string): string {
  const effects = getMeasurements().policyEffects as Record<string, { expId?: string }>
  const e = effects[policyId]
  if (e?.expId === 'E8') return assumedPriceLabel()
  if (e?.expId) return measuredLabel(e.expId)
  return 'cualitativo'
}
