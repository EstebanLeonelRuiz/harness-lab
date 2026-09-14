import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../components/Card'
import { DEMOS } from '../lib/demos'
import { THEMES, THEME_LABELS } from '../lib/papers'
import type { Theme } from '../types'

export function Demos() {
  const [theme, setTheme] = useState<Theme | 'all'>('all')

  const list = useMemo(
    () => (theme === 'all' ? DEMOS : DEMOS.filter((d) => d.themes.includes(theme))),
    [theme],
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Galería de demos</h1>
        <p className="mt-1 text-sm text-muted">Filtrá por tema. Métricas = ilustrativas.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTheme('all')}
          className={`rounded-full border px-3 py-1 text-xs ${theme === 'all' ? 'border-accent text-accent' : 'border-line text-muted'}`}
        >
          Todos
        </button>
        {THEMES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTheme(t)}
            className={`rounded-full border px-3 py-1 text-xs ${theme === t ? 'border-accent text-accent' : 'border-line text-muted'}`}
          >
            {THEME_LABELS[t]}
          </button>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {list.map((d) => (
          <Link key={d.id} to={`/demos/${d.id}`} className="no-underline">
            <Card className="h-full transition hover:border-accent/50">
              <h3 className="text-base font-semibold text-fg">{d.title}</h3>
              <p className="mt-1 text-sm text-muted">{d.blurb}</p>
              <div className="mt-3 flex flex-wrap gap-1">
                {d.themes.map((t) => (
                  <span key={t} className="rounded bg-panel2 px-2 py-0.5 text-[10px] text-muted">
                    {THEME_LABELS[t]}
                  </span>
                ))}
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
