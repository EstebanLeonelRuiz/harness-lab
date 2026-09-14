import { Metric } from '../Metric'
import {
  BASELINE,
  deltaPct,
  formatFcr,
  formatPct,
  formatTokens,
  formatUsd,
  type SessionMetrics,
} from '../../lib/costModel'
import { illustrativeSourceLabel } from '../../lib/papers'

export function TokenomicsPanel({
  metrics,
  baseline = false,
}: {
  metrics: SessionMetrics
  baseline?: boolean
}) {
  const src = metrics.provenanceLabel || illustrativeSourceLabel(metrics.sources)
  const dTok = deltaPct(metrics.tokens, BASELINE.tokens)
  const dCost = deltaPct(metrics.costUsd, BASELINE.costUsd)
  const dCache = deltaPct(metrics.cacheHitPct, BASELINE.cacheHitPct)
  const dFcr = deltaPct(metrics.fcr, BASELINE.fcr)

  const badge =
    metrics.provenance === 'medido'
      ? 'bg-ok/15 text-ok'
      : metrics.provenance === 'asumido'
        ? 'bg-warn/15 text-warn'
        : 'bg-panel2 text-muted'

  return (
    <aside className="space-y-3 rounded-lg border border-accent/30 bg-panel/90 p-4 shadow-[0_0_40px_rgba(61,214,198,0.06)]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-accent">Tokenomics en vivo</h2>
          <p className="mt-0.5 text-[11px] text-muted">
            {baseline ? 'Baseline (políticas OFF)' : 'Sesión con políticas actuales'}
          </p>
        </div>
        <span className={`rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wide ${badge}`}>
          {metrics.provenance}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Metric
          label="Tokens"
          value={formatTokens(metrics.tokens)}
          hint={baseline ? src : `Δ ${dTok} · medido`}
          tone="accent"
        />
        <Metric
          label="$/solve"
          value={formatUsd(metrics.costUsd)}
          hint={baseline ? src : `Δ ${dCost} · asumido`}
          tone={metrics.costUsd < BASELINE.costUsd ? 'ok' : 'warn'}
        />
        <Metric
          label="Cache hit"
          value={formatPct(metrics.cacheHitPct)}
          hint={baseline ? src : `Δ ${dCache}`}
          tone="ok"
        />
        <Metric
          label="FCR"
          value={formatFcr(metrics.fcr)}
          hint={baseline ? src : `Δ ${dFcr}`}
          tone="accent"
        />
      </div>

      <div className="rounded border border-line bg-ink/40 px-2 py-1.5 font-mono text-[10px] text-muted">
        baseline {formatTokens(BASELINE.tokens)} · {formatUsd(BASELINE.costUsd)} ·{' '}
        {formatPct(BASELINE.cacheHitPct)} hit · FCR {formatFcr(BASELINE.fcr)}
      </div>

      <p className="text-[10px] text-muted">{src}</p>

      {metrics.measurementIds.length > 0 && (
        <p className="text-[10px] text-ok">
          MVP: {metrics.measurementIds.join(', ')}
        </p>
      )}

      {metrics.qualitative.length > 0 && (
        <ul className="space-y-1 text-[11px] text-muted">
          {metrics.qualitative.map((q) => (
            <li key={q.note} className="border-l-2 border-accent2/40 pl-2">
              {q.note}{' '}
              <span className="text-[10px] text-accent2">
                ({illustrativeSourceLabel(q.sourceIds)})
              </span>
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}
