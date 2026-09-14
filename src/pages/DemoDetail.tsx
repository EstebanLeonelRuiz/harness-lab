import { Link, useParams } from 'react-router-dom'
import { PaperChip } from '../components/PaperChip'
import { DEMO_COMPONENTS } from '../demos'
import { DEMOS } from '../lib/demos'
import { papersByDemo } from '../lib/papers'
import type { DemoId } from '../types'

export function DemoDetail() {
  const { demoId } = useParams()
  const meta = DEMOS.find((d) => d.id === demoId)
  const Comp = demoId ? DEMO_COMPONENTS[demoId as DemoId] : undefined

  if (!meta || !Comp) {
    return (
      <div>
        <p className="text-danger">Demo no encontrada.</p>
        <Link to="/demos">← Volver</Link>
      </div>
    )
  }

  const related = papersByDemo(meta.id)

  return (
    <div className="space-y-6">
      <div>
        <Link to="/demos" className="text-xs text-muted no-underline hover:text-accent">
          ← Galería
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{meta.title}</h1>
        <p className="text-sm text-muted">{meta.blurb}</p>
      </div>
      <Comp />
      {related.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted">
            Papers vinculados
          </h2>
          <div className="flex flex-wrap gap-2">
            {related.map((p) => (
              <PaperChip key={p.id} paper={p} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
