import { LAB_STAGES } from '../data/labStages'
import measurements from '../data/measurements.json'
import type { LabPolicy, PolicyEffect } from '../types'

/**
 * Cost model preferring **measured** MVP deltas from `measurements.json`.
 *
 * Provenance labels:
 * - medido · MVP {expId} · {timestamp}  — token/structural/sim metrics from npm run measure
 * - asumido (precio lista)              — E8 list-price proxy (NOT API bills)
 * - cualitativo                         — papers without a local measurement yet
 *
 * Composition (KISS):
 *   tokens  = BASE_TOKENS * Π tokenMult
 *   cacheHit = clamp(BASE_CACHE + Σ cacheHitDelta, 0, 95)
 *   fcr     = clamp(BASE_FCR + Σ fcrDelta, 0.05, 0.98)
 *   cost    = BASE_COST * Π costMult * (tokens/BASE_TOKENS)^0.6 * cacheFactor
 *   latency = BASE_LATENCY * Π latencyMult
 *
 * Measured policyEffects from experiments override labStages numeric multipliers
 * when present. Paper ids remain citations for *why* we measure.
 */

export const BASELINE = {
  tokens: 850_000,
  costUsd: 4.2,
  cacheHitPct: 12,
  fcr: 0.55,
  latencyRel: 1,
} as const

export type PolicyState = Record<string, boolean>

export type MetricProvenance = 'medido' | 'asumido' | 'cualitativo'

export interface SessionMetrics {
  tokens: number
  costUsd: number
  cacheHitPct: number
  fcr: number
  latencyRel: number
  /** Paper ids that contributed effects. */
  sources: string[]
  /** Measurement experiment ids that contributed. */
  measurementIds: string[]
  /** Qualitative notes from enabled policies. */
  qualitative: { note: string; sourceIds: string[] }[]
  /** How the dominant numeric stack was sourced. */
  provenance: MetricProvenance
  provenanceLabel: string
}

type MeasuredEffect = {
  kind: 'measured'
  expId: string
  tokenMult?: number
  costMult?: number
  cacheHitDelta?: number
  fcrDelta?: number
  latencyMult?: number
  citation?: string
  [k: string]: unknown
}

const measured = measurements as {
  generatedAt: string
  encoding: string
  provenanceLabel: string
  assumptions: Record<string, unknown>
  experiments: Record<string, Record<string, unknown>>
  policyEffects: Record<string, MeasuredEffect>
}

export function getMeasurements() {
  return measured
}

export function measuredLabel(expId: string): string {
  return `medido · MVP ${expId} · ${measured.generatedAt}`
}

export function assumedPriceLabel(): string {
  return `asumido (precio lista) · MVP E8 · ${measured.generatedAt}`
}

export function defaultPolicyState(): PolicyState {
  const state: PolicyState = {}
  for (const stage of LAB_STAGES) {
    for (const p of stage.policies) {
      state[p.id] = p.defaultOn
    }
  }
  return state
}

export function allPolicies(): LabPolicy[] {
  return LAB_STAGES.flatMap((s) => s.policies)
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}

function resolveEffect(policy: LabPolicy): {
  effect: PolicyEffect | MeasuredEffect
  fromMeasurement: boolean
  expId?: string
} {
  const m = measured.policyEffects[policy.id]
  if (m && m.kind === 'measured') {
    return { effect: m, fromMeasurement: true, expId: m.expId }
  }
  return { effect: policy.effect, fromMeasurement: false }
}

export function evaluateSession(state: PolicyState): SessionMetrics {
  const acc = {
    tokenMult: 1,
    costMult: 1,
    cacheHit: BASELINE.cacheHitPct,
    fcr: BASELINE.fcr,
    latencyMult: 1,
    sources: new Set<string>(),
    measurementIds: new Set<string>(),
  }
  const qualitative: SessionMetrics['qualitative'] = []
  let usedMeasured = false
  let usedAssumed = false

  for (const p of allPolicies()) {
    if (!state[p.id]) continue
    const { effect, fromMeasurement, expId } = resolveEffect(p)

    if (fromMeasurement && expId) {
      usedMeasured = true
      acc.measurementIds.add(expId)
      if (expId === 'E8') usedAssumed = true
      const m = effect as MeasuredEffect
      if (m.tokenMult != null) acc.tokenMult *= m.tokenMult
      if (m.costMult != null) acc.costMult *= m.costMult
      if (m.cacheHitDelta != null) acc.cacheHit += m.cacheHitDelta
      if (m.fcrDelta != null) acc.fcr += m.fcrDelta
      if (m.latencyMult != null) acc.latencyMult *= m.latencyMult
      for (const id of p.paperIds) acc.sources.add(id)
      continue
    }

    if (effect.kind === 'numeric') {
      if (effect.tokenMult != null) acc.tokenMult *= effect.tokenMult
      if (effect.costMult != null) acc.costMult *= effect.costMult
      if (effect.cacheHitDelta != null) acc.cacheHit += effect.cacheHitDelta
      if (effect.fcrDelta != null) acc.fcr += effect.fcrDelta
      if (effect.latencyMult != null) acc.latencyMult *= effect.latencyMult
      for (const id of effect.sourceIds) acc.sources.add(id)
    } else if (effect.kind === 'qualitative') {
      qualitative.push({ note: effect.note, sourceIds: effect.sourceIds })
      for (const id of effect.sourceIds) acc.sources.add(id)
    }
  }

  const tokens = Math.round(BASELINE.tokens * acc.tokenMult)
  const cacheHitPct = clamp(acc.cacheHit, 0, 95)
  const fcr = clamp(acc.fcr, 0.05, 0.98)
  const latencyRel = acc.latencyMult

  const cacheFactor = 1 - (cacheHitPct / 100) * 0.45
  const tokenRatio = tokens / BASELINE.tokens
  const costUsd =
    BASELINE.costUsd * acc.costMult * Math.pow(tokenRatio, 0.6) * cacheFactor

  let provenance: MetricProvenance = 'cualitativo'
  let provenanceLabel = 'cualitativo · sin medición local para políticas activas'
  if (usedMeasured) {
    provenance = usedAssumed ? 'asumido' : 'medido'
    const ids = [...acc.measurementIds].join(',')
    provenanceLabel = usedAssumed
      ? `medido + asumido (precio lista) · MVP ${ids} · ${measured.generatedAt}`
      : `medido · MVP ${ids} · ${measured.generatedAt}`
  } else if ([...acc.sources].length) {
    provenanceLabel = `cualitativo / residual · fuente arXiv:${[...acc.sources].slice(0, 3).join(', ')}`
  }

  return {
    tokens,
    costUsd,
    cacheHitPct,
    fcr,
    latencyRel,
    sources: [...acc.sources],
    measurementIds: [...acc.measurementIds],
    qualitative,
    provenance,
    provenanceLabel,
  }
}

export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`
  return String(n)
}

export function formatUsd(n: number): string {
  return `$${n.toFixed(2)}`
}

export function formatPct(n: number): string {
  return `${n.toFixed(0)}%`
}

export function formatFcr(n: number): string {
  return `${(n * 100).toFixed(0)}%`
}

export function deltaPct(optimized: number, baseline: number): string {
  if (baseline === 0) return '—'
  const d = ((optimized - baseline) / baseline) * 100
  const sign = d > 0 ? '+' : ''
  return `${sign}${d.toFixed(0)}%`
}

/** Build a Spanish markdown summary of the current policy set. */
export function buildMarkdownSummary(
  state: PolicyState,
  metrics: SessionMetrics,
): string {
  const enabled = allPolicies().filter((p) => state[p.id])
  const disabled = allPolicies().filter((p) => !state[p.id])
  const base = evaluateSession(Object.fromEntries(allPolicies().map((p) => [p.id, false])))

  const lines: string[] = [
    '# Harness Lab — resumen de política',
    '',
    `> Provenance: **${metrics.provenanceLabel}**`,
    '> Tokens/estructura = **medido (MVP)**. $/proxy con precios lista = **asumido**.',
    '> No son facturas de API ni mediciones sobre tus repos de producción.',
    '',
    '## Baseline vs optimizado',
    '',
    '| Métrica | Baseline | Optimizado | Δ |',
    '|---------|----------|------------|---|',
    `| Tokens | ${formatTokens(base.tokens)} | ${formatTokens(metrics.tokens)} | ${deltaPct(metrics.tokens, base.tokens)} |`,
    `| $/solve (proxy) | ${formatUsd(base.costUsd)} | ${formatUsd(metrics.costUsd)} | ${deltaPct(metrics.costUsd, base.costUsd)} |`,
    `| Cache hit | ${formatPct(base.cacheHitPct)} | ${formatPct(metrics.cacheHitPct)} | ${deltaPct(metrics.cacheHitPct, base.cacheHitPct)} |`,
    `| FCR | ${formatFcr(base.fcr)} | ${formatFcr(metrics.fcr)} | ${deltaPct(metrics.fcr, base.fcr)} |`,
    '',
    '## Mediciones citadas',
    '',
  ]

  if (metrics.measurementIds.length) {
    for (const id of metrics.measurementIds) {
      lines.push(`- **${id}** — ${measuredLabel(id)}`)
    }
  } else {
    lines.push('- (ninguna política medida activa)')
  }

  lines.push('', '## Políticas ON', '')

  for (const p of enabled) {
    const src = p.paperIds.map((id) => `arXiv:${id}`).join(', ')
    const m = measured.policyEffects[p.id]
    const tag = m ? `medido · MVP ${m.expId}` : 'cualitativo/residual'
    lines.push(`- **${p.label}** — ${p.description} _(${tag}; por qué: ${src})_`)
  }

  lines.push('', '## Políticas OFF', '')
  for (const p of disabled) {
    lines.push(`- ${p.label}`)
  }

  if (metrics.qualitative.length) {
    lines.push('', '## Notas cualitativas', '')
    for (const q of metrics.qualitative) {
      lines.push(
        `- ${q.note} _(fuente ${q.sourceIds.map((id) => `arXiv:${id}`).join(', ')})_`,
      )
    }
  }

  lines.push(
    '',
    '## Fuentes (papers)',
    '',
    ...metrics.sources.map((id) => `- https://arxiv.org/abs/${id}`),
    '',
    '## Reproducir mediciones',
    '',
    '```bash',
    'npm run measure',
    '```',
    '',
  )

  return lines.join('\n')
}
