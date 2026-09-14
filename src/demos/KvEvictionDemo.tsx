import { useMemo, useState } from 'react'
import { Card } from '../components/Card'
import { Metric } from '../components/Metric'
import { IllustrativeBanner } from '../components/IllustrativeBanner'

type Region = 'system' | 'tools' | 'scratch'
const REGIONS: { id: Region; label: string; priority: number; color: string }[] = [
  { id: 'system', label: 'System/control', priority: 3, color: 'bg-accent' },
  { id: 'tools', label: 'Tool I/O', priority: 2, color: 'bg-accent2' },
  { id: 'scratch', label: 'Scratch/CoT', priority: 1, color: 'bg-warn' },
]

type Page = { id: number; region: Region; age: number }

function seedPages(): Page[] {
  const pages: Page[] = []
  let id = 0
  for (let i = 0; i < 4; i++) pages.push({ id: id++, region: 'system', age: 10 - i })
  for (let i = 0; i < 6; i++) pages.push({ id: id++, region: 'tools', age: 8 - i })
  for (let i = 0; i < 8; i++) pages.push({ id: id++, region: 'scratch', age: 6 - i })
  return pages
}

export function KvEvictionDemo() {
  const [budget, setBudget] = useState(10)
  const [policy, setPolicy] = useState<'lru' | 'agent'>('agent')
  const pages = useMemo(() => seedPages(), [])

  const kept = useMemo(() => {
    const sorted = [...pages]
    if (policy === 'lru') {
      sorted.sort((a, b) => a.age - b.age) // older = larger age kept? LRU evicts oldest = highest age
      sorted.sort((a, b) => b.age - a.age) // evict high age first → keep low age (recent)
      // keep most recent (lowest age)
      return [...pages].sort((a, b) => a.age - b.age).slice(0, budget)
    }
    // agent-aware: priority then recency
    return [...pages]
      .sort((a, b) => {
        const pa = REGIONS.find((r) => r.id === a.region)!.priority
        const pb = REGIONS.find((r) => r.id === b.region)!.priority
        if (pb !== pa) return pb - pa
        return a.age - b.age
      })
      .slice(0, budget)
  }, [pages, budget, policy])

  const keptIds = new Set(kept.map((p) => p.id))
  const systemKept = pages.filter((p) => p.region === 'system' && keptIds.has(p.id)).length
  const systemTotal = pages.filter((p) => p.region === 'system').length

  return (
    <div className="space-y-4">
      <IllustrativeBanner text="PBKV / MetaKV / Declarative Attention: prioridades por región vs LRU puro." />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setPolicy('lru')}
          className={`rounded-md border px-3 py-1.5 text-sm ${policy === 'lru' ? 'border-warn bg-warn/15 text-warn' : 'border-line text-muted'}`}
        >
          LRU
        </button>
        <button
          type="button"
          onClick={() => setPolicy('agent')}
          className={`rounded-md border px-3 py-1.5 text-sm ${policy === 'agent' ? 'border-accent bg-accent/15 text-accent' : 'border-line text-muted'}`}
        >
          Agent-aware
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Budget páginas" value={`${budget}`} />
        <Metric
          label="System pinned"
          value={`${systemKept}/${systemTotal}`}
          tone={systemKept === systemTotal ? 'ok' : 'danger'}
        />
        <Metric label="Política" value={policy === 'lru' ? 'LRU' : 'Priority'} tone="accent" />
      </div>
      <Card title="Timeline de páginas KV">
        <label className="mb-4 block text-sm text-muted">
          Budget: {budget}
          <input
            type="range"
            min={4}
            max={18}
            value={budget}
            onChange={(e) => setBudget(+e.target.value)}
            className="mt-1 w-full accent-accent"
          />
        </label>
        <div className="flex flex-wrap gap-1">
          {pages.map((p) => {
            const alive = keptIds.has(p.id)
            const color = REGIONS.find((r) => r.id === p.region)!.color
            return (
              <div
                key={p.id}
                title={`${p.region} age=${p.age}`}
                className={`h-10 w-8 rounded border text-[9px] ${
                  alive ? `${color} border-transparent text-ink` : 'border-line bg-panel2 text-muted line-through opacity-40'
                } flex items-end justify-center pb-0.5 font-mono`}
              >
                {p.region[0]}
              </div>
            )
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted">
          {REGIONS.map((r) => (
            <span key={r.id} className="inline-flex items-center gap-1">
              <span className={`h-2 w-2 rounded-full ${r.color}`} />
              {r.label}
            </span>
          ))}
        </div>
      </Card>
    </div>
  )
}
