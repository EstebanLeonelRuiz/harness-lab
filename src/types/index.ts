export type Theme =
  | 'cache'
  | 'compression'
  | 'harness'
  | 'serving'
  | 'memory'
  | 'economics'
  | 'navigation'
  | 'skills'
  | 'security'

export interface Paper {
  id: string
  title: string
  authors: string[]
  url: string
  themes: Theme[]
  firstSeen: string
  published?: string
  takeaway: string
  demoId?: string
  verified: boolean
}

export type DemoId =
  | 'prompt-cache'
  | 'trajectory-prune'
  | 'agents-md-hygiene'
  | 'repo-nav'
  | 'bash-vs-typed'
  | 'economics'
  | 'kv-eviction'

export interface DemoMeta {
  id: DemoId
  title: string
  blurb: string
  themes: Theme[]
}

/** Lab stages A–J of the integrated coding-agent session. */
export type LabStageId = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J'

/**
 * How a policy affects the illustrative cost model.
 * Multipliers/deltas are taken from paper-reported ranges when available;
 * when unknown, effect is qualitative-only (no fake precision numbers in UI).
 */
export type PolicyEffect =
  | {
      kind: 'numeric'
      /** Multiply remaining session tokens (e.g. 0.72 = −28%). */
      tokenMult?: number
      /** Multiply $/solve after token effects (tokens ≠ $). */
      costMult?: number
      /** Additive cache-hit percentage points (0–100 scale). */
      cacheHitDelta?: number
      /** Additive FCR (first-commit success) on 0–1 scale. */
      fcrDelta?: number
      /** Additive latency factor (1 = baseline). */
      latencyMult?: number
      sourceIds: string[]
    }
  | {
      kind: 'qualitative'
      note: string
      sourceIds: string[]
    }

export interface LabPolicy {
  id: string
  label: string
  description: string
  /** Paper ids that justify this lever. */
  paperIds: string[]
  defaultOn: boolean
  effect: PolicyEffect
}

export interface LabStage {
  id: LabStageId
  title: string
  subtitle: string
  blurb: string
  checklist: { text: string; paperIds: string[] }[]
  policies: LabPolicy[]
  /** Extra papers shown as deep-dive chips (must cover every catalog id overall). */
  deepDiveIds: string[]
  /** Metric labels shown in-stage (illustrative). */
  metrics: { label: string; paperIds: string[] }[]
}
