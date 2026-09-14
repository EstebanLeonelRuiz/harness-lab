import { useMemo, useState } from 'react'
import { Card } from '../components/Card'
import { Metric } from '../components/Metric'
import { IllustrativeBanner } from '../components/IllustrativeBanner'

const TASKS = [
  { id: 'find', label: 'Buscar símbolo en repo', bash: 180, typed: 520 },
  { id: 'test', label: 'Correr suite de tests', bash: 220, typed: 410 },
  { id: 'diff', label: 'Ver diff + aplicar patch', bash: 260, typed: 680 },
  { id: 'lint', label: 'Lint + format', bash: 140, typed: 390 },
]

/** Illustrative range from Bash All You Need: 19–72% fewer tokens */
export function BashVsTypedDemo() {
  const [selected, setSelected] = useState<string[]>(TASKS.map((t) => t.id))

  const stats = useMemo(() => {
    const rows = TASKS.filter((t) => selected.includes(t.id))
    const bash = rows.reduce((s, t) => s + t.bash, 0)
    const typed = rows.reduce((s, t) => s + t.typed, 0)
    const save = typed ? ((typed - bash) / typed) * 100 : 0
    const costBash = (bash / 1e6) * 5
    const costTyped = (typed / 1e6) * 5
    return { bash, typed, save, costBash, costTyped }
  }, [selected])

  return (
    <div className="space-y-4">
      <IllustrativeBanner text="Bash All You Need: 19–72% menos tokens vs schemas tipados pesados (ilustrativo)." />
      <div className="grid gap-3 sm:grid-cols-4">
        <Metric label="Bash tok" value={`${stats.bash}`} tone="ok" />
        <Metric label="Typed tok" value={`${stats.typed}`} tone="warn" />
        <Metric label="Ahorro tok" value={`${stats.save.toFixed(0)}%`} tone="accent" />
        <Metric
          label="$ ilustrativo"
          value={`$${stats.costBash.toFixed(4)} vs $${stats.costTyped.toFixed(4)}`}
        />
      </div>
      <Card title="Tareas" subtitle="Marcá las tareas a incluir en la comparación.">
        <ul className="space-y-2">
          {TASKS.map((t) => (
            <li key={t.id} className="flex items-center justify-between rounded border border-line bg-panel2 px-3 py-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selected.includes(t.id)}
                  onChange={() =>
                    setSelected((prev) =>
                      prev.includes(t.id) ? prev.filter((x) => x !== t.id) : [...prev, t.id],
                    )
                  }
                  className="accent-accent"
                />
                {t.label}
              </label>
              <span className="font-mono text-[11px] text-muted">
                bash {t.bash} · typed {t.typed}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded border border-ok/30 bg-ok/10 p-3">
            <div className="text-[10px] uppercase text-ok">Bash</div>
            <pre className="mt-1 overflow-auto text-[11px] text-fg">{`rg -n "createSession" src/\nnpm test -- --grep auth\ngit diff | head`}</pre>
          </div>
          <div className="rounded border border-warn/30 bg-warn/10 p-3">
            <div className="text-[10px] uppercase text-warn">Typed tools</div>
            <pre className="mt-1 overflow-auto text-[11px] text-fg">{`search_code({query, globs[], max…})\nrun_tests({suite, filter, …})\nget_diff({paths[], context…})`}</pre>
          </div>
        </div>
      </Card>
    </div>
  )
}
