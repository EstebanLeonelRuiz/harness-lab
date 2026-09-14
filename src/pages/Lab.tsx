import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { LAB_STAGES, labStageById } from '../data/labStages'
import type { LabStageId } from '../types'
import { LabStageRail } from '../components/lab/LabStageRail'
import { PolicyToggle } from '../components/lab/PolicyToggle'
import { TokenomicsPanel } from '../components/lab/TokenomicsPanel'
import { ScoreBoards } from '../components/lab/ScoreBoards'
import { PaperChip } from '../components/PaperChip'
import { Card } from '../components/Card'
import { IllustrativeBanner, ProvenanceLegend } from '../components/IllustrativeBanner'
import {
  buildMarkdownSummary,
  defaultPolicyState,
  deltaPct,
  evaluateSession,
  formatFcr,
  formatPct,
  formatTokens,
  formatUsd,
  type PolicyState,
} from '../lib/costModel'
import {
  catalogIdsMissingFromLab,
  paperById,
  papers,
  illustrativeSourceLabel,
  verifiedCount,
} from '../lib/papers'

function parseStage(hash: string): LabStageId | null {
  const raw = hash.replace(/^#/, '').toUpperCase()
  if (LAB_STAGES.some((s) => s.id === raw)) return raw as LabStageId
  // support #stage-B or #B
  const m = raw.match(/(?:STAGE-)?([A-J])$/)
  if (m) return m[1] as LabStageId
  return null
}

export function Lab() {
  const location = useLocation()
  const [active, setActive] = useState<LabStageId>('A')
  const [state, setState] = useState<PolicyState>(() => defaultPolicyState())
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const fromHash = parseStage(location.hash)
    if (fromHash) setActive(fromHash)
  }, [location.hash])

  const selectStage = useCallback((id: LabStageId) => {
    setActive(id)
    const url = `${window.location.pathname}${window.location.search}#${id}`
    window.history.replaceState(null, '', url)
  }, [])

  const metrics = useMemo(() => evaluateSession(state), [state])
  const baselineMetrics = useMemo(
    () => evaluateSession(Object.fromEntries(Object.keys(state).map((k) => [k, false]))),
    [state],
  )

  const stage = labStageById(active)!
  const missing = catalogIdsMissingFromLab()

  const onToggle = (id: string, next: boolean) => {
    setState((prev) => ({ ...prev, [id]: next }))
  }

  const setAll = (on: boolean) => {
    setState((prev) => {
      const next = { ...prev }
      for (const k of Object.keys(next)) next[k] = on
      return next
    })
  }

  const resetDefaults = () => setState(defaultPolicyState())

  const copySummary = async () => {
    const md = buildMarkdownSummary(state, metrics)
    try {
      await navigator.clipboard.writeText(md)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
      const ta = document.createElement('textarea')
      ta.value = md
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="text-xs font-mono uppercase tracking-[0.2em] text-accent">
          Experiencia principal
        </p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Integrated Lab — sesión end-to-end de agente de código
        </h1>
        <p className="max-w-3xl text-sm text-muted">
          Una sola simulación coherente (etapas A–J). Activá/desactivá políticas; el panel de
          tokenomics se actualiza en vivo. Cada paper del catálogo ({papers.length},{' '}
          {verifiedCount()} verificados en arXiv) aparece como palanca, métrica, checklist o chip
          deep-dive.
        </p>
        <IllustrativeBanner
          tone="ok"
          text="Deltas de políticas medidas vienen de npm run measure (medido · MVP). $/solve usa precios lista asumidos (E8). Papers citan el porqué."
        />
        <ProvenanceLegend />
        {missing.length > 0 && (
          <p className="text-xs text-danger">
            Wiring incompleto: faltan en lab {missing.join(', ')}
          </p>
        )}
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <LabStageRail active={active} onSelect={selectStage} />
        <div className="ml-auto flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setAll(true)}
            className="rounded border border-line px-2.5 py-1 text-xs text-muted hover:text-fg"
          >
            Todo ON
          </button>
          <button
            type="button"
            onClick={() => setAll(false)}
            className="rounded border border-line px-2.5 py-1 text-xs text-muted hover:text-fg"
          >
            Todo OFF
          </button>
          <button
            type="button"
            onClick={resetDefaults}
            className="rounded border border-line px-2.5 py-1 text-xs text-muted hover:text-fg"
          >
            Defaults
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Card
            title={`${stage.id}. ${stage.title}`}
            subtitle={stage.subtitle}
          >
            <p className="mb-4 text-sm text-muted">{stage.blurb}</p>

            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
              Checklist
            </h4>
            <ul className="mb-5 space-y-2">
              {stage.checklist.map((c) => (
                <li
                  key={c.text}
                  className="flex flex-col gap-1 rounded border border-line/60 bg-ink/30 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <span>{c.text}</span>
                  <span className="flex flex-wrap gap-1">
                    {c.paperIds.map((id) => {
                      const p = paperById(id)
                      return p ? <PaperChip key={id} paper={p} /> : null
                    })}
                  </span>
                </li>
              ))}
            </ul>

            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
              Métricas de etapa
            </h4>
            <div className="mb-5 flex flex-wrap gap-2">
              {stage.metrics.map((m) => (
                <span
                  key={m.label}
                  className="rounded-md border border-line bg-panel2 px-2.5 py-1 text-xs"
                  title={illustrativeSourceLabel(m.paperIds)}
                >
                  {m.label}{' '}
                  <span className="font-mono text-[10px] text-muted">
                    {illustrativeSourceLabel(m.paperIds)}
                  </span>
                </span>
              ))}
            </div>

            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
              Políticas (palancas)
            </h4>
            <div className="space-y-2">
              {stage.policies.map((p) => (
                <PolicyToggle
                  key={p.id}
                  policy={p}
                  on={!!state[p.id]}
                  onChange={onToggle}
                />
              ))}
            </div>

            <h4 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wider text-muted">
              Deep-dive (arXiv)
            </h4>
            <div className="flex flex-wrap gap-2">
              {stage.deepDiveIds.map((id) => {
                const p = paperById(id)
                return p ? <PaperChip key={id} paper={p} /> : (
                  <span key={id} className="text-xs text-danger">
                    missing {id}
                  </span>
                )
              })}
            </div>
          </Card>

          <Card title="Comparación baseline vs optimizado">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead className="text-[11px] uppercase tracking-wider text-muted">
                  <tr>
                    <th className="py-1 pr-3">Métrica</th>
                    <th className="py-1 pr-3">Baseline</th>
                    <th className="py-1 pr-3">Actual</th>
                    <th className="py-1">Δ</th>
                  </tr>
                </thead>
                <tbody className="font-mono text-xs">
                  <tr className="border-t border-line">
                    <td className="py-2 pr-3 font-sans text-sm">Tokens</td>
                    <td>{formatTokens(baselineMetrics.tokens)}</td>
                    <td className="text-accent">{formatTokens(metrics.tokens)}</td>
                    <td>{deltaPct(metrics.tokens, baselineMetrics.tokens)}</td>
                  </tr>
                  <tr className="border-t border-line">
                    <td className="py-2 pr-3 font-sans text-sm">$/solve</td>
                    <td>{formatUsd(baselineMetrics.costUsd)}</td>
                    <td className="text-ok">{formatUsd(metrics.costUsd)}</td>
                    <td>{deltaPct(metrics.costUsd, baselineMetrics.costUsd)}</td>
                  </tr>
                  <tr className="border-t border-line">
                    <td className="py-2 pr-3 font-sans text-sm">Cache hit</td>
                    <td>{formatPct(baselineMetrics.cacheHitPct)}</td>
                    <td>{formatPct(metrics.cacheHitPct)}</td>
                    <td>{deltaPct(metrics.cacheHitPct, baselineMetrics.cacheHitPct)}</td>
                  </tr>
                  <tr className="border-t border-line">
                    <td className="py-2 pr-3 font-sans text-sm">FCR</td>
                    <td>{formatFcr(baselineMetrics.fcr)}</td>
                    <td>{formatFcr(metrics.fcr)}</td>
                    <td>{deltaPct(metrics.fcr, baselineMetrics.fcr)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[10px] text-ok">{metrics.provenanceLabel}</p>
            <p className="mt-1 text-[10px] text-muted">
              {illustrativeSourceLabel(metrics.sources)}
            </p>
            <button
              type="button"
              onClick={copySummary}
              className="mt-3 rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-ink hover:opacity-90"
            >
              {copied ? 'Copiado ✓' : 'Copiar resumen Markdown'}
            </button>
          </Card>
        </div>

        <div className="lg:sticky lg:top-4 lg:self-start">
          <TokenomicsPanel metrics={metrics} />
          <p className="mt-3 text-[11px] text-muted">
            Deep-dives:{' '}
            <Link to="/audit">Audit</Link> · <Link to="/pipeline">Pipeline</Link> ·{' '}
            <Link to="/catalog">Catálogo</Link> · <Link to="/demos">Demos</Link>
          </p>
        </div>
      </div>

      <ScoreBoards state={state} metrics={metrics} />
    </div>
  )
}
