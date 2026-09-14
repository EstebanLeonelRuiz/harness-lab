import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { THEMES, THEME_LABELS, papers } from '../lib/papers'
import type { Theme } from '../types'

export function Catalog() {
  const [q, setQ] = useState('')
  const [theme, setTheme] = useState<Theme | 'all'>('all')
  const [verifiedOnly, setVerifiedOnly] = useState(false)

  const rows = useMemo(() => {
    const qq = q.trim().toLowerCase()
    return papers.filter((p) => {
      if (theme !== 'all' && !p.themes.includes(theme)) return false
      if (verifiedOnly && !p.verified) return false
      if (!qq) return true
      return (
        p.title.toLowerCase().includes(qq) ||
        p.id.includes(qq) ||
        p.takeaway.toLowerCase().includes(qq) ||
        p.authors.some((a) => a.toLowerCase().includes(qq))
      )
    })
  }, [q, theme, verifiedOnly])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Catálogo DMBOK</h1>
        <p className="mt-1 text-sm text-muted">
          Fuente única: <code className="text-fg">src/data/papers.json</code> · {papers.length}{' '}
          papers
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar título, id, takeaway…"
          className="min-w-[220px] flex-1 rounded-md border border-line bg-panel2 px-3 py-2 text-sm text-fg outline-none focus:border-accent"
        />
        <select
          value={theme}
          onChange={(e) => setTheme(e.target.value as Theme | 'all')}
          className="rounded-md border border-line bg-panel2 px-3 py-2 text-sm"
        >
          <option value="all">Todos los temas</option>
          {THEMES.map((t) => (
            <option key={t} value={t}>
              {THEME_LABELS[t]}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={verifiedOnly}
            onChange={(e) => setVerifiedOnly(e.target.checked)}
            className="accent-accent"
          />
          Solo verified
        </label>
      </div>
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead className="bg-panel2 text-[11px] uppercase tracking-wider text-muted">
            <tr>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Themes</th>
              <th className="px-3 py-2">Demo</th>
              <th className="px-3 py-2">Published</th>
              <th className="px-3 py-2">OK</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-t border-line hover:bg-panel2/50">
                <td className="px-3 py-2 font-mono text-xs">
                  <a href={p.url} target="_blank" rel="noreferrer">
                    {p.id}
                  </a>
                  {!p.verified && <span className="ml-1 text-warn">?</span>}
                </td>
                <td className="px-3 py-2">
                  <div className="font-medium">{p.title}</div>
                  <div className="text-xs text-muted line-clamp-1">{p.takeaway}</div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {p.themes.map((t) => (
                      <span key={t} className="rounded bg-ink px-1.5 py-0.5 text-[10px] text-muted">
                        {THEME_LABELS[t]}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-2 text-xs">
                  {p.demoId ? (
                    <Link to={`/demos/${p.demoId}`}>{p.demoId}</Link>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-muted">{p.published ?? p.firstSeen}</td>
                <td className="px-3 py-2 text-xs">{p.verified ? <span className="text-ok">✓</span> : <span className="text-warn">?</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">{rows.length} resultados</p>
    </div>
  )
}
