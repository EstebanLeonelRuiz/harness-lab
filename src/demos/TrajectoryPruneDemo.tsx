import { useMemo, useState } from 'react'
import { Card } from '../components/Card'
import { Metric } from '../components/Metric'
import { IllustrativeBanner } from '../components/IllustrativeBanner'

const CONTROL_TOKENS = 2000
const TRAJECTORY_TOKENS = 8000

export function TrajectoryPruneDemo() {
  const [keepPct, setKeepPct] = useState(70)
  const [compressControl, setCompressControl] = useState(false)

  const stats = useMemo(() => {
    const trajKept = Math.round(TRAJECTORY_TOKENS * (keepPct / 100))
    const controlKept = compressControl
      ? Math.round(CONTROL_TOKENS * (keepPct / 100))
      : CONTROL_TOKENS
    const controlRatio = controlKept / CONTROL_TOKENS
    const warn = controlRatio < 0.5
    const total = controlKept + trajKept
    const baseline = CONTROL_TOKENS + TRAJECTORY_TOKENS
    return { trajKept, controlKept, controlRatio, warn, total, baseline }
  }, [keepPct, compressControl])

  return (
    <div className="space-y-4">
      <IllustrativeBanner text="CompressAgent: no comprimir la capa de control (AGENTS.md) bajo ~50%." />
      <div className="grid gap-3 sm:grid-cols-4">
        <Metric label="Control retenido" value={`${(stats.controlRatio * 100).toFixed(0)}%`} tone={stats.warn ? 'danger' : 'ok'} />
        <Metric label="Trayectoria" value={`${stats.trajKept} tok`} />
        <Metric label="Total" value={`${stats.total}`} hint={`baseline ${stats.baseline}`} />
        <Metric label="Ahorro tok" value={`${(((stats.baseline - stats.total) / stats.baseline) * 100).toFixed(0)}%`} tone="accent" />
      </div>
      {stats.warn && (
        <div className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          ⚠ Control comprimido bajo ~50%. Riesgo de pérdida de policy / AGENTS.md (CompressAgent).
        </div>
      )}
      <Card title="Slider de retención">
        <label className="block text-sm text-muted">
          Retener {keepPct}% de la trayectoria
          <input
            type="range"
            min={20}
            max={100}
            value={keepPct}
            onChange={(e) => setKeepPct(Number(e.target.value))}
            className="mt-2 w-full accent-accent"
          />
        </label>
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={compressControl}
            onChange={(e) => setCompressControl(e.target.checked)}
            className="accent-danger"
          />
          También comprimir capa de control (peligroso)
        </label>
        <div className="mt-4 h-4 overflow-hidden rounded bg-panel2">
          <div
            className={`h-full ${stats.warn ? 'bg-danger' : 'bg-accent'}`}
            style={{ width: `${(stats.total / stats.baseline) * 100}%` }}
          />
        </div>
      </Card>
    </div>
  )
}
