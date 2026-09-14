import type { ReactNode } from 'react'

export function Card({
  children,
  className = '',
  title,
  subtitle,
}: {
  children: ReactNode
  className?: string
  title?: string
  subtitle?: string
}) {
  return (
    <section
      className={`rounded-lg border border-line bg-panel/80 p-4 shadow-[0_0_0_1px_rgba(42,53,72,0.4)] ${className}`}
    >
      {(title || subtitle) && (
        <header className="mb-3">
          {title && <h3 className="text-sm font-semibold tracking-wide text-fg">{title}</h3>}
          {subtitle && <p className="mt-1 text-xs text-muted">{subtitle}</p>}
        </header>
      )}
      {children}
    </section>
  )
}
