export function IllustrativeBanner({ text }: { text?: string }) {
  return (
    <div className="mb-4 rounded-md border border-warn/30 bg-warn/10 px-3 py-2 text-xs text-warn">
      {text ??
        'Métricas ilustrativas / de ejemplo tomadas de papers (no medidas en tus repositorios).'}
    </div>
  )
}
