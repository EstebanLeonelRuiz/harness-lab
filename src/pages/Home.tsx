import { Link } from 'react-router-dom'
import { Card } from '../components/Card'
import { LabStageRail } from '../components/lab/LabStageRail'
import { papers, verifiedCount } from '../lib/papers'
import { LAB_STAGES } from '../data/labStages'
import { DEMOS } from '../lib/demos'
import { useNavigate } from 'react-router-dom'
import type { LabStageId } from '../types'

export function Home() {
  const navigate = useNavigate()
  const goStage = (id: LabStageId) => navigate(`/lab#${id}`)

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <p className="text-xs font-mono uppercase tracking-[0.2em] text-accent">
          Coding-agent economics lab
        </p>
        <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
          Harness Lab — una sesión integrada, no un mosaico de demos
        </h1>
        <p className="max-w-2xl text-base text-muted">
          Simulá una sesión de agente de código de punta a punta (control → cache → nav → tools →
          trayectoria → skills → memoria → KV → economía → harness). Las métricas son{' '}
          <em>ilustrativas</em> ancladas a papers de arXiv — no mediciones sobre tu repo.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/lab"
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-ink no-underline hover:opacity-90"
          >
            Abrir Integrated Lab
          </Link>
          <Link
            to="/pipeline"
            className="rounded-md border border-line px-4 py-2 text-sm text-fg no-underline hover:border-accent"
          >
            Pipeline (deep-links)
          </Link>
          <Link
            to="/catalog"
            className="rounded-md border border-line px-4 py-2 text-sm text-fg no-underline hover:border-accent"
          >
            Catálogo ({papers.length})
          </Link>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
          Etapas del lab (A–J)
        </h2>
        <LabStageRail active="A" onSelect={goStage} />
        <p className="mt-2 text-xs text-muted">Clic en una etapa → /lab#ID</p>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Integrated Lab" subtitle="Producto principal">
          <p className="text-sm text-muted">
            {LAB_STAGES.length} etapas, políticas togglables, tokenomics en vivo, tableros
            Red/Blue/Green y export Markdown.
          </p>
        </Card>
        <Card title="Catálogo DMBOK" subtitle={`${verifiedCount()} verified arXiv`}>
          <p className="text-sm text-muted">
            {papers.length} papers. Cada id aparece al menos una vez en el lab (palanca, métrica,
            checklist o chip).
          </p>
        </Card>
        <Card title="Demos opcionales" subtitle="Deep-dives secundarios">
          <p className="text-sm text-muted">
            {DEMOS.length} widgets en <code className="text-fg">/demos/*</code> — útiles, pero el
            camino feliz es el Lab.
          </p>
        </Card>
      </div>
    </div>
  )
}
