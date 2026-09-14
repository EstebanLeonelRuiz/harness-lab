import { useMemo, useState } from 'react'
import { Card } from '../components/Card'
import { Metric } from '../components/Metric'
import { IllustrativeBanner } from '../components/IllustrativeBanner'

export function EconomicsDemo() {
  const [tasks, setTasks] = useState(10)
  const [tokensPerTask, setTokensPerTask] = useState(120_000)
  const [cacheHit, setCacheHit] = useState(55)
  const [budget, setBudget] = useState(5)
  const [successRate, setSuccessRate] = useState(72)

  const stats = useMemo(() => {
    const priceIn = 3
    const priceCached = 0.3
    const priceOut = 15
    const outFrac = 0.15
    const inTok = tokensPerTask * (1 - outFrac)
    const outTok = tokensPerTask * outFrac
    const hit = cacheHit / 100
    const costPerTask =
      ((inTok * (1 - hit)) / 1e6) * priceIn +
      ((inTok * hit) / 1e6) * priceCached +
      (outTok / 1e6) * priceOut
    const total = costPerTask * tasks
    const solves = tasks * (successRate / 100)
    const costPerSolve = solves ? total / solves : 0
    const overBudget = total > budget
    // Token reduction illusion: -30% tokens but if cache breaks, cost can rise
    const naiveTokenCut = tokensPerTask * 0.7
    const brokenCacheCost =
      (((naiveTokenCut * (1 - outFrac)) / 1e6) * priceIn +
        ((naiveTokenCut * outFrac) / 1e6) * priceOut) *
      tasks
    return { costPerTask, total, costPerSolve, overBudget, brokenCacheCost, solves }
  }, [tasks, tokensPerTask, cacheHit, budget, successRate])

  return (
    <div className="space-y-4">
      <IllustrativeBanner text="Token Reduction Is Not Cost Reduction: tokens ≠ $. Usá $/solve, cache hit, FCR." />
      <div className="grid gap-3 sm:grid-cols-4">
        <Metric label="$/tarea" value={`$${stats.costPerTask.toFixed(3)}`} />
        <Metric
          label="$ total"
          value={`$${stats.total.toFixed(2)}`}
          tone={stats.overBudget ? 'danger' : 'ok'}
          hint={`budget $${budget}`}
        />
        <Metric label="$/solve" value={`$${stats.costPerSolve.toFixed(3)}`} tone="accent" />
        <Metric label="Solves" value={`${stats.solves.toFixed(1)}`} hint={`FCR ${successRate}%`} />
      </div>
      {stats.overBudget && (
        <div className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          Presupuesto excedido. Capá turns, tools o subí cache hit — no solo “recortes de tokens”.
        </div>
      )}
      <Card title="Controles">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm text-muted">
            Tareas: {tasks}
            <input type="range" min={1} max={50} value={tasks} onChange={(e) => setTasks(+e.target.value)} className="mt-1 w-full accent-accent" />
          </label>
          <label className="text-sm text-muted">
            Tok/tarea: {tokensPerTask.toLocaleString()}
            <input type="range" min={20000} max={400000} step={10000} value={tokensPerTask} onChange={(e) => setTokensPerTask(+e.target.value)} className="mt-1 w-full accent-accent" />
          </label>
          <label className="text-sm text-muted">
            Cache hit: {cacheHit}%
            <input type="range" min={0} max={90} value={cacheHit} onChange={(e) => setCacheHit(+e.target.value)} className="mt-1 w-full accent-accent" />
          </label>
          <label className="text-sm text-muted">
            Budget $: {budget}
            <input type="range" min={1} max={30} value={budget} onChange={(e) => setBudget(+e.target.value)} className="mt-1 w-full accent-accent" />
          </label>
          <label className="text-sm text-muted sm:col-span-2">
            First-pass success (FCR): {successRate}%
            <input type="range" min={20} max={95} value={successRate} onChange={(e) => setSuccessRate(+e.target.value)} className="mt-1 w-full accent-accent" />
          </label>
        </div>
      </Card>
      <Card title="Trampa: −30% tokens rompiendo caché">
        <p className="text-sm text-muted">
          Si comprimís/reordenás y el hit de caché cae a ~0, el costo ilustrativo puede subir a{' '}
          <span className="font-mono text-danger">${stats.brokenCacheCost.toFixed(2)}</span> vs total
          actual <span className="font-mono text-ok">${stats.total.toFixed(2)}</span>.
        </p>
      </Card>
    </div>
  )
}
