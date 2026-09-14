import { Link } from 'react-router-dom'
import audit from '../data/measurement-audit.json'
import measurements from '../data/measurements.json'
import { Card } from '../components/Card'
import { PaperChip } from '../components/PaperChip'
import { paperById } from '../lib/papers'
import { assumedPriceLabel, measuredLabel } from '../lib/costModel'

type AuditExp = {
  id: string
  title: string
  hypothesis: string
  method: string
  fixtures: string[]
  encoding: string
  seed?: number
  startedAt: string
  finishedAt: string
  commands_or_functions: string[]
  raw: Record<string, unknown>
  metrics: { key: string; value: number | string | boolean; unit: string; howMeasured: string }[]
  limitations: string[]
  relatedPaperIds: string[]
}

const experiments = (audit as { experiments: AuditExp[]; generatedAt: string; encoding: string; durationMs: number })
  .experiments

export function Audit() {
  const m = measurements as {
    generatedAt: string
    encoding: string
    encodingNote: string
    assumptions: {
      ASSUMED_PRICE_PER_MTOK_INPUT: number
      ASSUMED_PRICE_PER_MTOK_CACHED_INPUT: number
      ASSUMED_PRICE_PER_MTOK_OUTPUT: number
      note: string
    }
  }

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="text-xs font-mono uppercase tracking-[0.2em] text-accent">Auditoría MVP</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Measurement audit — qué medimos de verdad
        </h1>
        <p className="max-w-3xl text-sm text-muted">
          Experiments E1–E8 corridos con <code className="text-fg">npm run measure</code>. Encoding:{' '}
          <strong className="text-fg">{m.encoding}</strong>. Generado:{' '}
          <span className="font-mono text-xs">{m.generatedAt}</span>. Sin API keys; sin facturas
          reales.
        </p>
        <div className="flex flex-wrap gap-2 text-[11px]">
          <span className="rounded border border-ok/40 bg-ok/10 px-2 py-1 text-ok">
            medido (MVP) — tokens, sha256, estructuras, sim
          </span>
          <span className="rounded border border-warn/40 bg-warn/10 px-2 py-1 text-warn">
            asumido (precio lista) — {assumedPriceLabel()}
          </span>
          <span className="rounded border border-line px-2 py-1 text-muted">
            cualitativo — papers sin medición local
          </span>
        </div>
        <p className="text-xs text-muted">
          {m.encodingNote} · Assumed USD/MTok input={m.assumptions.ASSUMED_PRICE_PER_MTOK_INPUT}{' '}
          cached={m.assumptions.ASSUMED_PRICE_PER_MTOK_CACHED_INPUT} output=
          {m.assumptions.ASSUMED_PRICE_PER_MTOK_OUTPUT}
        </p>
        <Link to="/lab" className="text-sm text-accent">
          ← Volver al Lab
        </Link>
      </header>

      <div className="space-y-4">
        {experiments.map((exp) => (
          <Card
            key={exp.id}
            title={`${exp.id} · ${exp.title}`}
            subtitle={measuredLabel(exp.id)}
          >
            <div className="space-y-3 text-sm">
              <p>
                <span className="text-xs uppercase tracking-wider text-muted">Hipótesis</span>
                <br />
                {exp.hypothesis}
              </p>
              <p>
                <span className="text-xs uppercase tracking-wider text-muted">Método</span>
                <br />
                {exp.method}
              </p>
              {exp.seed != null && (
                <p className="font-mono text-xs text-muted">seed={exp.seed}</p>
              )}
              <div>
                <span className="text-xs uppercase tracking-wider text-muted">Métricas</span>
                <div className="mt-1 overflow-x-auto">
                  <table className="w-full min-w-[420px] text-left text-xs">
                    <thead className="text-[10px] uppercase text-muted">
                      <tr>
                        <th className="py-1 pr-2">key</th>
                        <th className="py-1 pr-2">value</th>
                        <th className="py-1 pr-2">unit</th>
                        <th className="py-1">howMeasured</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono">
                      {exp.metrics.map((row) => (
                        <tr key={row.key} className="border-t border-line/60">
                          <td className="py-1 pr-2 text-accent">{row.key}</td>
                          <td className="py-1 pr-2">{String(row.value)}</td>
                          <td className="py-1 pr-2 text-muted">{row.unit}</td>
                          <td className="py-1 font-sans text-[11px] text-muted">{row.howMeasured}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div>
                <span className="text-xs uppercase tracking-wider text-muted">Limitaciones</span>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-muted">
                  {exp.limitations.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              </div>
              <div>
                <span className="text-xs uppercase tracking-wider text-muted">Fixtures</span>
                <p className="mt-1 font-mono text-[11px] text-muted">{exp.fixtures.join(' · ')}</p>
              </div>
              <div className="flex flex-wrap gap-1">
                {exp.relatedPaperIds.map((id) => {
                  const p = paperById(id)
                  return p ? <PaperChip key={id} paper={p} /> : (
                    <a
                      key={id}
                      href={`https://arxiv.org/abs/${id}`}
                      className="text-[11px] text-accent"
                      target="_blank"
                      rel="noreferrer"
                    >
                      arXiv:{id}
                    </a>
                  )
                })}
              </div>
              <details className="rounded border border-line bg-ink/30 p-2">
                <summary className="cursor-pointer text-xs text-muted">raw JSON</summary>
                <pre className="mt-2 max-h-64 overflow-auto text-[10px] text-muted">
                  {JSON.stringify(exp.raw, null, 2)}
                </pre>
              </details>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
