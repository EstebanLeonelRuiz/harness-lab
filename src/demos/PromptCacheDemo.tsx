import { useMemo, useState } from 'react'
import { Card } from '../components/Card'
import { Metric } from '../components/Metric'
import { IllustrativeBanner } from '../components/IllustrativeBanner'

type Block = { id: string; label: string; tokens: number; stable: boolean }

const INITIAL: Block[] = [
  { id: 'sys', label: 'System / policy', tokens: 800, stable: true },
  { id: 'agents', label: 'AGENTS.md', tokens: 1200, stable: true },
  { id: 'skills', label: 'Skills catalog', tokens: 600, stable: true },
  { id: 'repo', label: 'Repo map', tokens: 900, stable: false },
  { id: 'task', label: 'Task brief', tokens: 400, stable: false },
  { id: 'tools', label: 'Tool I/O turn', tokens: 1500, stable: false },
]

/** Illustrative: TraceLab ~59% prefix; literature 41–80% save when prefix stable */
const CACHE_HIT_RATE = 0.59
const PRICE_PER_MTOK = 3 // illustrative $/MTok input

export function PromptCacheDemo() {
  const [blocks, setBlocks] = useState(INITIAL)

  const move = (index: number, dir: -1 | 1) => {
    const j = index + dir
    if (j < 0 || j >= blocks.length) return
    const next = [...blocks]
    ;[next[index], next[j]] = [next[j], next[index]]
    setBlocks(next)
  }

  const stats = useMemo(() => {
    // Longest stable prefix from the start
    let prefix = 0
    for (const b of blocks) {
      if (!b.stable) break
      prefix += b.tokens
    }
    const total = blocks.reduce((s, b) => s + b.tokens, 0)
    const uncachedCost = (total / 1e6) * PRICE_PER_MTOK
    const cachedTokens = Math.floor(prefix * CACHE_HIT_RATE)
    const withCacheCost =
      ((total - cachedTokens) / 1e6) * PRICE_PER_MTOK + (cachedTokens / 1e6) * (PRICE_PER_MTOK * 0.1)
    const savePct = total ? ((uncachedCost - withCacheCost) / uncachedCost) * 100 : 0
    return { prefix, total, uncachedCost, withCacheCost, savePct, cachedTokens }
  }, [blocks])

  return (
    <div className="space-y-4">
      <IllustrativeBanner text="Ahorro ilustrativo 41–80%; TraceLab ~59% hit de prefijo. No medido en tu repo." />
      <div className="grid gap-3 sm:grid-cols-4">
        <Metric label="Prefijo estable" value={`${stats.prefix} tok`} />
        <Metric label="Sin caché" value={`$${stats.uncachedCost.toFixed(4)}`} />
        <Metric
          label="Con caché"
          value={`$${stats.withCacheCost.toFixed(4)}`}
          tone="ok"
          hint={`~${stats.savePct.toFixed(0)}% save ilustrativo`}
        />
        <Metric label="Hit prefijo" value={`${(CACHE_HIT_RATE * 100).toFixed(0)}%`} tone="accent" />
      </div>
      <Card title="Bloques de prompt" subtitle="Subí los bloques estables al inicio para maximizar el prefijo cacheable.">
        <ul className="space-y-2">
          {blocks.map((b, i) => (
            <li
              key={b.id}
              className={`flex items-center justify-between gap-2 rounded border px-3 py-2 ${
                b.stable ? 'border-accent/40 bg-accent/5' : 'border-line bg-panel2'
              }`}
            >
              <div>
                <div className="text-sm font-medium">{b.label}</div>
                <div className="font-mono text-[11px] text-muted">
                  {b.tokens} tok · {b.stable ? 'estable' : 'volátil'}
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  className="rounded border border-line px-2 py-1 text-xs text-muted hover:text-fg"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="rounded border border-line px-2 py-1 text-xs text-muted hover:text-fg"
                  onClick={() => move(i, 1)}
                  disabled={i === blocks.length - 1}
                >
                  ↓
                </button>
              </div>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="mt-3 text-xs text-muted underline"
          onClick={() => setBlocks(INITIAL)}
        >
          Reset orden
        </button>
      </Card>
    </div>
  )
}
