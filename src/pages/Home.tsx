import { Link } from 'react-router-dom'
import { Card } from '../components/Card'
import { StageRail } from '../components/StageRail'
import { papers } from '../lib/papers'
import { DEMOS } from '../lib/demos'

export function Home() {
  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <p className="text-xs font-mono uppercase tracking-[0.2em] text-accent">Interactive demo lab</p>
        <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
          Harness Lab — economía, caché y control para agentes de código
        </h1>
        <p className="max-w-2xl text-base text-muted">
          Catálogo DMBOK de papers + demos interactivas. Aprende por qué{' '}
          <em>tokens ≠ dólares</em>, cómo no romper el prompt cache, y por qué la capa de control
          (AGENTS.md) es never-touch bajo compresión.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/pipeline"
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-ink no-underline hover:opacity-90"
          >
            Ver pipeline
          </Link>
          <Link
            to="/demos"
            className="rounded-md border border-line px-4 py-2 text-sm text-fg no-underline hover:border-accent"
          >
            Abrir demos
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
          Pipeline overview
        </h2>
        <StageRail linkToPipeline />
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Catálogo DMBOK" subtitle="Una sola fuente de verdad">
          <p className="text-sm text-muted">
            {papers.length} papers con temas, takeaways y links a arXiv. Filtrá por theme o demo.
          </p>
        </Card>
        <Card title="Demos" subtitle="Métricas ilustrativas">
          <p className="text-sm text-muted">
            {DEMOS.length} demos interactivas (caché, prune, higiene, nav, bash, economía, KV).
          </p>
        </Card>
        <Card title="Green Team KPIs" subtitle="PQC mental model">
          <ul className="list-inside list-disc text-sm text-muted">
            <li>$/solve</li>
            <li>Cache hit rate</li>
            <li>FCR (first-pass success)</li>
          </ul>
        </Card>
      </div>
    </div>
  )
}
