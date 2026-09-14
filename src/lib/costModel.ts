import { LAB_STAGES } from '../data/labStages'
import type { LabPolicy, PolicyEffect } from '../types'

/**
 * Simple illustrative cost model (NOT measured on user repos).
 *
 * Baseline: a "messy" coding-agent session — unstable prompt prefix, typed-tool
 * bloat, flat repo dump, no trajectory prune, LRU KV, optimize-tokens-not-$.
 *
 * Each enabled policy applies multipliers/deltas taken from paper-reported
 * ranges when available (see PolicyEffect.sourceIds). When a paper only gives
 * qualitative guidance, the policy is marked qualitative and does not invent
 * precision.
 *
 * Composition (KISS):
 *   tokens  = BASE_TOKENS * Π tokenMult
 *   cacheHit = clamp(BASE_CACHE + Σ cacheHitDelta, 0, 95)
 *   fcr     = clamp(BASE_FCR + Σ fcrDelta, 0.05, 0.98)
 *   cost    = BASE_COST * Π costMult * (tokens/BASE_TOKENS)^0.6 * cacheFactor
 *   latency = BASE_LATENCY * Π latencyMult
 *
 * cacheFactor: higher hit rate reduces effective $ (cached tokens cheaper).
 * The 0.6 exponent reflects that $ is sublinear in tokens once cache/serving
 * dominate (Token Reduction Is Not Cost Reduction — arXiv:2607.12161).
 *
 * All UI numbers MUST be labeled: "ilustrativo · fuente arXiv:ID".
 */

export const BASELINE = {
  tokens: 850_000,
  costUsd: 4.2,
  cacheHitPct: 12,
  fcr: 0.55,
  latencyRel: 1,
} as const

export type PolicyState = Record<string, boolean>

export interface SessionMetrics {
  tokens: number
  costUsd: number
  cacheHitPct: number
  fcr: number
  latencyRel: number
  /** Paper ids that contributed numeric effects. */
  sources: string[]
  /** Qualitative notes from enabled policies. */
  qualitative: { note: string; sourceIds: string[] }[]
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

function applyNumeric(
  acc: {
    tokenMult: number
    costMult: number
    cacheHit: number
    fcr: number
    latencyMult: number
    sources: Set<string>
  },
  effect: Extract<PolicyEffect, { kind: 'numeric' }>,
): void {
  if (effect.tokenMult != null) acc.tokenMult *= effect.tokenMult
  if (effect.costMult != null) acc.costMult *= effect.costMult
  if (effect.cacheHitDelta != null) acc.cacheHit += effect.cacheHitDelta
  if (effect.fcrDelta != null) acc.fcr += effect.fcrDelta
  if (effect.latencyMult != null) acc.latencyMult *= effect.latencyMult
  for (const id of effect.sourceIds) acc.sources.add(id)
}

export function evaluateSession(state: PolicyState): SessionMetrics {
  const acc = {
    tokenMult: 1,
    costMult: 1,
    cacheHit: BASELINE.cacheHitPct,
    fcr: BASELINE.fcr,
    latencyMult: 1,
    sources: new Set<string>(),
  }
  const qualitative: SessionMetrics['qualitative'] = []

  for (const p of allPolicies()) {
    if (!state[p.id]) continue
    if (p.effect.kind === 'numeric') {
      applyNumeric(acc, p.effect)
    } else {
      qualitative.push({ note: p.effect.note, sourceIds: p.effect.sourceIds })
      for (const id of p.effect.sourceIds) acc.sources.add(id)
    }
  }

  const tokens = Math.round(BASELINE.tokens * acc.tokenMult)
  const cacheHitPct = clamp(acc.cacheHit, 0, 95)
  const fcr = clamp(acc.fcr, 0.05, 0.98)
  const latencyRel = acc.latencyMult

  // Cached tokens are cheaper; map hit rate to a soft discount on $.
  const cacheFactor = 1 - (cacheHitPct / 100) * 0.45
  const tokenRatio = tokens / BASELINE.tokens
  const costUsd =
    BASELINE.costUsd * acc.costMult * Math.pow(tokenRatio, 0.6) * cacheFactor

  return {
    tokens,
    costUsd,
    cacheHitPct,
    fcr,
    latencyRel,
    sources: [...acc.sources],
    qualitative,
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
    '# Harness Lab — resumen de política (ilustrativo)',
    '',
    '> Números **ilustrativos** compuestos desde rangos reportados en papers.',
    '> **No** medidos sobre tus repositorios.',
    '',
    '## Baseline vs optimizado',
    '',
    '| Métrica | Baseline | Optimizado | Δ |',
    '|---------|----------|------------|---|',
    `| Tokens | ${formatTokens(base.tokens)} | ${formatTokens(metrics.tokens)} | ${deltaPct(metrics.tokens, base.tokens)} |`,
    `| $/solve | ${formatUsd(base.costUsd)} | ${formatUsd(metrics.costUsd)} | ${deltaPct(metrics.costUsd, base.costUsd)} |`,
    `| Cache hit | ${formatPct(base.cacheHitPct)} | ${formatPct(metrics.cacheHitPct)} | ${deltaPct(metrics.cacheHitPct, base.cacheHitPct)} |`,
    `| FCR | ${formatFcr(base.fcr)} | ${formatFcr(metrics.fcr)} | ${deltaPct(metrics.fcr, base.fcr)} |`,
    '',
    '## Políticas ON',
    '',
  ]

  for (const p of enabled) {
    const src = p.paperIds.map((id) => `arXiv:${id}`).join(', ')
    lines.push(`- **${p.label}** — ${p.description} _(fuente ${src})_`)
  }

  lines.push('', '## Políticas OFF', '')
  for (const p of disabled) {
    lines.push(`- ${p.label}`)
  }

  if (metrics.qualitative.length) {
    lines.push('', '## Notas cualitativas', '')
    for (const q of metrics.qualitative) {
      lines.push(`- ${q.note} _(fuente ${q.sourceIds.map((id) => `arXiv:${id}`).join(', ')})_`)
    }
  }

  lines.push(
    '',
    '## Fuentes',
    '',
    ...metrics.sources.map((id) => `- https://arxiv.org/abs/${id}`),
    '',
  )

  return lines.join('\n')
}
