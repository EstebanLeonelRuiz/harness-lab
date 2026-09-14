export function IllustrativeBanner({
  text,
  tone = 'warn',
}: {
  text?: string
  tone?: 'warn' | 'ok' | 'accent'
}) {
  const cls =
    tone === 'ok'
      ? 'border-ok/30 bg-ok/10 text-ok'
      : tone === 'accent'
        ? 'border-accent/30 bg-accent/10 text-accent'
        : 'border-warn/30 bg-warn/10 text-warn'
  return (
    <div className={`mb-4 rounded-md border px-3 py-2 text-xs ${cls}`}>
      {text ??
        'Métricas: medido (MVP) · asumido (precio lista) · cualitativo. No facturas de API.'}
    </div>
  )
}

/** Compact provenance chips for Lab / Home. */
export function ProvenanceLegend() {
  return (
    <div className="flex flex-wrap gap-2 text-[11px]">
      <span className="rounded border border-ok/40 bg-ok/10 px-2 py-1 text-ok">
        medido (MVP)
      </span>
      <span className="rounded border border-warn/40 bg-warn/10 px-2 py-1 text-warn">
        asumido (precio lista)
      </span>
      <span className="rounded border border-line px-2 py-1 text-muted">cualitativo</span>
    </div>
  )
}
