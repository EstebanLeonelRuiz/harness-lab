import type { PolicyState, SessionMetrics } from '../../lib/costModel'
import { allPolicies, formatFcr, formatPct, formatUsd } from '../../lib/costModel'
import { Card } from '../Card'

function scoreRed(state: PolicyState): { score: number; notes: string[] } {
  let score = 35
  const notes: string[] = []
  if (state['tofu-fuzz']) {
    score += 30
    notes.push('ToFu fuzz activo')
  } else notes.push('Sin fuzz de tools (ToFu)')
  if (state['harness-scan']) {
    score += 25
    notes.push('Harness scan (supply-chain)')
  } else notes.push('Scan de harness OFF')
  if (state['protect-control']) {
    score += 10
    notes.push('Control layer como superficie a atacar')
  }
  return { score: Math.min(100, score), notes }
}

function scoreBlue(state: PolicyState): { score: number; notes: string[] } {
  let score = 30
  const notes: string[] = []
  if (state['protect-control']) {
    score += 25
    notes.push('Control ≥50%')
  } else notes.push('Control desprotegido')
  if (state['hard-budget']) {
    score += 20
    notes.push('Budget hard-fail')
  } else notes.push('Sin budget hard')
  if (state['agents-md-hygiene']) {
    score += 15
    notes.push('Higiene AGENTS.md')
  }
  if (state['harness-scan']) {
    score += 10
    notes.push('Scan pre-ship')
  }
  return { score: Math.min(100, score), notes }
}

function scoreGreen(metrics: SessionMetrics, state: PolicyState): { score: number; notes: string[] } {
  const notes: string[] = []
  const costScore = Math.max(0, Math.min(40, ((4.2 - metrics.costUsd) / 4.2) * 50))
  const cacheScore = Math.min(30, (metrics.cacheHitPct / 80) * 30)
  const fcrScore = Math.min(30, metrics.fcr * 30)
  if (state['optimize-dollars']) notes.push('Optimiza $ no solo tokens')
  if (state['cache-observe']) notes.push('Telemetría de caché')
  if (state['ato-timeline']) notes.push('Timelines ATO desde logs')
  notes.push(`$/solve ${formatUsd(metrics.costUsd)}`)
  notes.push(`cache ${formatPct(metrics.cacheHitPct)} · FCR ${formatFcr(metrics.fcr)}`)
  return {
    score: Math.round(Math.min(100, costScore + cacheScore + fcrScore)),
    notes,
  }
}

function Board({
  title,
  tone,
  score,
  notes,
}: {
  title: string
  tone: 'danger' | 'accent2' | 'ok'
  score: number
  notes: string[]
}) {
  const color =
    tone === 'danger'
      ? 'text-danger'
      : tone === 'ok'
        ? 'text-ok'
        : 'text-accent2'
  return (
    <Card title={title}>
      <div className={`mb-2 font-mono text-3xl font-semibold ${color}`}>{score}</div>
      <div className="mb-3 h-2 overflow-hidden rounded bg-ink">
        <div
          className={`h-full ${tone === 'danger' ? 'bg-danger' : tone === 'ok' ? 'bg-ok' : 'bg-accent2'}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <ul className="space-y-1 text-xs text-muted">
        {notes.map((n) => (
          <li key={n}>· {n}</li>
        ))}
      </ul>
    </Card>
  )
}

export function ScoreBoards({
  state,
  metrics,
}: {
  state: PolicyState
  metrics: SessionMetrics
}) {
  const red = scoreRed(state)
  const blue = scoreBlue(state)
  const green = scoreGreen(metrics, state)
  const enabled = allPolicies().filter((p) => state[p.id]).length

  return (
    <section className="space-y-4" id="scoreboards">
      <div>
        <h2 className="text-lg font-semibold">Tableros Red / Blue / Green</h2>
        <p className="text-sm text-muted">
          Scoring ilustrativo del set de políticas ({enabled} ON). No es un audit real.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Board title="Red Team" tone="danger" score={red.score} notes={red.notes} />
        <Board title="Blue Team" tone="accent2" score={blue.score} notes={blue.notes} />
        <Board title="Green Team (PQC)" tone="ok" score={green.score} notes={green.notes} />
      </div>
    </section>
  )
}
