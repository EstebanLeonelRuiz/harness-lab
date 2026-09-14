import { useMemo, useState } from 'react'
import { Card } from '../components/Card'
import { Metric } from '../components/Metric'
import { IllustrativeBanner } from '../components/IllustrativeBanner'

type Rule = {
  id: string
  text: string
  reason: string
  deletionSignal: string
  keep: boolean
}

const SEED: Rule[] = [
  {
    id: '1',
    text: 'Siempre correr tests antes de commit',
    reason: 'Evita regresiones en CI',
    deletionSignal: 'Si el repo adopta pre-commit hooks equivalentes',
    keep: true,
  },
  {
    id: '2',
    text: 'No tocar /legacy/payments (proyecto 2024)',
    reason: 'Área congelada en migración',
    deletionSignal: 'Cuando payments v2 esté en prod',
    keep: true,
  },
  {
    id: '3',
    text: 'Usar prettier 2.x',
    reason: 'Histórico; ya migraron a 3.x',
    deletionSignal: 'Inmediato — regla obsoleta',
    keep: false,
  },
  {
    id: '4',
    text: 'Preferir fetch sobre axios en nuevos módulos',
    reason: 'Menor superficie de deps',
    deletionSignal: 'Si el equipo estandariza otra HTTP lib',
    keep: true,
  },
  {
    id: '5',
    text: 'Nunca editar CLAUDE.md sin revisión humana',
    reason: 'Control layer / catastrophic remembering',
    deletionSignal: 'Nunca — capa never-touch',
    keep: true,
  },
]

export function AgentsMdHygieneDemo() {
  const [rules, setRules] = useState(SEED)
  const [weeks, setWeeks] = useState(12)

  const stats = useMemo(() => {
    const active = rules.filter((r) => r.keep).length
    const dead = rules.length - active
    // Illustrative growth: without hygiene, +2 rules/week of cruft; with hygiene, +0.3
    const without = rules.length + weeks * 2
    const withH = active + Math.floor(weeks * 0.3)
    return { active, dead, without, withH }
  }, [rules, weeks])

  return (
    <div className="space-y-4">
      <IllustrativeBanner text="CLAUDE.md Catastrophic Remembering / Ecdysis: reglas sin señal de borrado crecen sin control." />
      <div className="grid gap-3 sm:grid-cols-4">
        <Metric label="Reglas activas" value={`${stats.active}`} tone="ok" />
        <Metric label="Candidatas a borrar" value={`${stats.dead}`} tone="warn" />
        <Metric label={`Sin higiene @${weeks}w`} value={`${stats.without}`} tone="danger" />
        <Metric label={`Con higiene @${weeks}w`} value={`${stats.withH}`} tone="accent" />
      </div>
      <Card title="Horizonte">
        <label className="text-sm text-muted">
          Semanas proyectadas: {weeks}
          <input
            type="range"
            min={4}
            max={52}
            value={weeks}
            onChange={(e) => setWeeks(Number(e.target.value))}
            className="mt-2 w-full accent-accent"
          />
        </label>
        <div className="mt-4 flex h-32 items-end gap-2">
          <div className="flex flex-1 flex-col items-center gap-1">
            <div
              className="w-full rounded-t bg-danger/70"
              style={{ height: `${Math.min(100, (stats.without / 120) * 100)}%` }}
            />
            <span className="text-[10px] text-muted">sin higiene</span>
          </div>
          <div className="flex flex-1 flex-col items-center gap-1">
            <div
              className="w-full rounded-t bg-accent/80"
              style={{ height: `${Math.min(100, (stats.withH / 120) * 100)}%` }}
            />
            <span className="text-[10px] text-muted">con higiene</span>
          </div>
        </div>
      </Card>
      <Card title="Reglas (razón + señal de borrado)">
        <ul className="space-y-3">
          {rules.map((r) => (
            <li key={r.id} className="rounded border border-line bg-panel2 p-3">
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={r.keep}
                  onChange={() =>
                    setRules((prev) =>
                      prev.map((x) => (x.id === r.id ? { ...x, keep: !x.keep } : x)),
                    )
                  }
                  className="mt-1 accent-accent"
                />
                <div>
                  <div className="text-sm font-medium">{r.text}</div>
                  <div className="mt-1 text-xs text-muted">
                    <strong className="text-fg">Razón:</strong> {r.reason}
                  </div>
                  <div className="text-xs text-muted">
                    <strong className="text-warn">Borrar cuando:</strong> {r.deletionSignal}
                  </div>
                </div>
              </label>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
