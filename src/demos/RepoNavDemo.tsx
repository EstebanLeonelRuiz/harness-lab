import { useState } from 'react'
import { Card } from '../components/Card'
import { Metric } from '../components/Metric'
import { IllustrativeBanner } from '../components/IllustrativeBanner'

const TREE = [
  {
    path: 'src/auth/',
    files: [
      { name: 'session.ts', tokens: 120, preview: 'export function createSession…' },
      { name: 'oauth.ts', tokens: 180, preview: 'export async function exchangeCode…' },
    ],
  },
  {
    path: 'src/api/',
    files: [
      { name: 'routes.ts', tokens: 220, preview: 'router.get("/health"…' },
      { name: 'middleware.ts', tokens: 90, preview: 'export function rateLimit…' },
    ],
  },
  {
    path: 'tests/',
    files: [{ name: 'auth.test.ts', tokens: 150, preview: 'describe("session"…' }],
  },
]

const FLAT_SNIPPETS = TREE.flatMap((d) =>
  d.files.map((f) => ({
    label: `${d.path}${f.name}`,
    tokens: f.tokens + 40, // path noise + surrounding junk
    body: f.preview,
  })),
)

export function RepoNavDemo() {
  const [mode, setMode] = useState<'file' | 'flat'>('file')
  const [open, setOpen] = useState<string | null>('src/auth/session.ts')

  const fileTokens =
    80 /* tree outline */ +
    TREE.reduce(
      (s, d) =>
        s +
        d.files.reduce((a, f) => a + (open === `${d.path}${f.name}` ? f.tokens : 12), 0),
      0,
    )
  const flatTokens = FLAT_SNIPPETS.reduce((s, x) => s + x.tokens, 0)

  return (
    <div className="space-y-4">
      <IllustrativeBanner text="RepoNav / Cost-Effective Repository Exploration: file-centered suele gastar menos tokens que dumps planos." />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode('file')}
          className={`rounded-md border px-3 py-1.5 text-sm ${mode === 'file' ? 'border-accent bg-accent/15 text-accent' : 'border-line text-muted'}`}
        >
          File-centered
        </button>
        <button
          type="button"
          onClick={() => setMode('flat')}
          className={`rounded-md border px-3 py-1.5 text-sm ${mode === 'flat' ? 'border-accent bg-accent/15 text-accent' : 'border-line text-muted'}`}
        >
          Flat snippets
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Modo file" value={`${fileTokens} tok`} tone="ok" />
        <Metric label="Modo flat" value={`${flatTokens} tok`} tone="warn" />
        <Metric
          label="Delta"
          value={`${(((flatTokens - fileTokens) / flatTokens) * 100).toFixed(0)}% menos`}
          tone="accent"
          hint="ilustrativo"
        />
      </div>
      <Card title={mode === 'file' ? 'Árbol + archivo abierto' : 'Snippets planos'}>
        {mode === 'file' ? (
          <div className="grid gap-4 md:grid-cols-2">
            <ul className="font-mono text-xs">
              {TREE.map((d) => (
                <li key={d.path} className="mb-2">
                  <div className="text-muted">{d.path}</div>
                  {d.files.map((f) => {
                    const key = `${d.path}${f.name}`
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setOpen(key)}
                        className={`ml-3 block w-full rounded px-2 py-1 text-left ${open === key ? 'bg-accent/15 text-accent' : 'text-fg hover:bg-panel2'}`}
                      >
                        {f.name}
                      </button>
                    )
                  })}
                </li>
              ))}
            </ul>
            <pre className="overflow-auto rounded border border-line bg-ink p-3 text-xs text-fg">
              {open
                ? TREE.flatMap((d) =>
                    d.files
                      .filter((f) => `${d.path}${f.name}` === open)
                      .map((f) => `// ${open}\n${f.preview}\n…`),
                  ).join('\n')
                : '// seleccioná un archivo'}
            </pre>
          </div>
        ) : (
          <ul className="space-y-2">
            {FLAT_SNIPPETS.map((s) => (
              <li key={s.label} className="rounded border border-line bg-panel2 p-2 font-mono text-xs">
                <div className="text-muted">{s.label} · {s.tokens} tok</div>
                <div>{s.body}</div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
