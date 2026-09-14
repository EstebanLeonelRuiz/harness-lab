import { Link } from 'react-router-dom'
import { Card } from '../components/Card'
import { LabStageRail } from '../components/lab/LabStageRail'
import { ProvenanceLegend } from '../components/IllustrativeBanner'
import { papers, verifiedCount } from '../lib/papers'
import { LAB_STAGES } from '../data/labStages'
import { DEMOS } from '../lib/demos'
import { useNavigate } from 'react-router-dom'
import type { LabStageId } from '../types'
import { getMeasurements } from '../lib/costModel'

export function Home() {
  const navigate = useNavigate()
  const goStage = (id: LabStageId) => navigate(`/lab#${id}`)
  const m = getMeasurements()

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <p className="text-xs font-mono uppercase tracking-[0.2em] text-accent">
          Coding-agent economics lab
        </p>
        <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
          Harness Lab — una sesión integrada, métricas MVP medibles
        </h1>
        <p className="max-w-2xl text-base text-muted">
          Simulá una sesión de agente de código de punta a punta. Los deltas numéricos del Lab
          vienen de <strong className="text-fg">mediciones locales MVP</strong> (
          <code className="text-fg">npm run measure</code>
          ): tokens (js-tiktoken), sha256 de prefijos, scores estructurales y sims con seed. El
          proxy $ usa <em>precios lista asumidos</em> — no facturas de API.
        </p>
        <ProvenanceLegend />
        <p className="font-mono text-[11px] text-muted">
          encoding {m.encoding} · generated {m.generatedAt}
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/lab"
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-ink no-underline hover:opacity-90"
          >
            Abrir Integrated Lab
          </Link>
          <Link
            to="/audit"
            className="rounded-md border border-ok/40 px-4 py-2 text-sm text-ok no-underline hover:border-ok"
          >
            Audit E1–E8
          </Link>
          <Link
            to="/pipeline"
            className="rounded-md border border-line px-4 py-2 text-sm text-fg no-underline hover:border-accent"
          >
            Pipeline
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
            {LAB_STAGES.length} etapas, políticas togglables, tokenomics en vivo anclado a
            measurements.json, tableros Red/Blue/Green y export Markdown.
          </p>
        </Card>
        <Card title="Audit MVP" subtitle="E1–E8">
          <p className="text-sm text-muted">
            Método, limitaciones, métricas crudas y papers relacionados. Reproducí con{' '}
            <code className="text-fg">npm run measure</code>.
          </p>
        </Card>
        <Card title="Catálogo + demos" subtitle={`${verifiedCount()} verified arXiv`}>
          <p className="text-sm text-muted">
            {papers.length} papers · {DEMOS.length} demos opcionales en /demos/*.
          </p>
        </Card>
      </div>
    </div>
  )
}
