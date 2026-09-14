import { NavLink, Outlet } from 'react-router-dom'

const nav = [
  { to: '/', label: 'Inicio', end: true },
  { to: '/lab', label: 'Lab', end: false },
  { to: '/audit', label: 'Audit' },
  { to: '/pipeline', label: 'Pipeline' },
  { to: '/catalog', label: 'Catálogo' },
  { to: '/demos', label: 'Demos' },
]

export function Layout() {
  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 pb-16 pt-4 sm:px-6">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <NavLink to="/" className="group flex items-center gap-2 no-underline">
          <span className="flex h-8 w-8 items-center justify-center rounded border border-accent/40 bg-accent/10 font-mono text-sm text-accent">
            HL
          </span>
          <div>
            <div className="text-sm font-semibold tracking-tight text-fg group-hover:text-accent">
              Harness Lab
            </div>
            <div className="text-[10px] uppercase tracking-widest text-muted">
              Integrated lab · medido MVP · $
            </div>
          </div>
        </NavLink>
        <nav className="flex flex-wrap gap-1">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `rounded-md px-3 py-1.5 text-sm no-underline transition ${
                  isActive ? 'bg-panel2 text-accent' : 'text-muted hover:bg-panel2 hover:text-fg'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="mt-12 border-t border-line pt-4 text-xs text-muted">
        <strong className="text-ok">medido (MVP)</strong> tokens/estructura ·{' '}
        <strong className="text-warn">asumido (precio lista)</strong> proxy $ · cualitativo residual.
        Sin facturas de API. Audit: <code className="text-fg">/audit</code> ·{' '}
        <code className="text-fg">npm run measure</code>.
      </footer>
    </div>
  )
}
