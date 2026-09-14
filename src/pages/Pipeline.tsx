import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Card } from '../components/Card'
import { PaperChip } from '../components/PaperChip'
import { StageRail, type StageId, PIPELINE_STAGES } from '../components/StageRail'
import { papersForThemes } from '../lib/papers'
import type { Theme } from '../types'

const STAGE_META: Record<
  StageId,
  { title: string; blurb: string; themes: Theme[]; checklist: string[] }
> = {
  spec: {
    title: 'Spec',
    blurb: 'Definí budgets, never-touch control, y KPIs ($/solve, FCR, cache hit) antes de codear.',
    themes: ['economics', 'harness'],
    checklist: [
      'Budget $ y techo de turns',
      'Control layer (AGENTS.md) versionada',
      'Éxito = patch + tests, no solo tokens bajos',
    ],
  },
  implement: {
    title: 'Implement',
    blurb: 'Harness + tools: preferí bash donde alcance; navegación file-centered; prefijos estables.',
    themes: ['harness', 'skills', 'navigation', 'cache'],
    checklist: [
      'Bloques estables al inicio del prompt',
      'Tools mínimas / bash-first',
      'Repo nav por árbol, no dump plano',
    ],
  },
  review: {
    title: 'Review',
    blurb: 'Revisión humana + agente: blast radius, secretos, y reglas nuevas con deletion signal.',
    themes: ['harness', 'memory', 'security'],
    checklist: [
      'Diff acotado',
      'Nueva regla en AGENTS.md tiene razón + borrado',
      'No filtrar secrets en tool I/O',
    ],
  },
  qa: {
    title: 'QA',
    blurb: 'Tests, FCR, y telemetría de caché. Token cut sin mirar $ es un anti-patrón.',
    themes: ['economics', 'compression'],
    checklist: [
      'Suite verde',
      'Medir $/solve no solo tok',
      'Compresión no toca control <50%',
    ],
  },
  red: {
    title: 'Red Team',
    blurb: 'Adversarial harness/tools: prompt injection, ATO vía tools, fuzz de sandbox.',
    themes: ['security'],
    checklist: [
      'Fuzz tool args (ToFu)',
      'Intentos de override de AGENTS.md',
      'Exfiltración / path escape',
    ],
  },
  blue: {
    title: 'Blue Team',
    blurb: 'Defensas: sandbox, budgets, never-touch control layer, allowlists.',
    themes: ['security', 'harness'],
    checklist: [
      'Sandbox + network policy',
      'Budgets hard-fail',
      'Control layer immutable para el agente',
    ],
  },
  green: {
    title: 'Green Team',
    blurb: 'PQC metrics: $/solve, cache hit, FCR. Optimizá el sistema, no el vanity token count.',
    themes: ['economics', 'cache'],
    checklist: [
      'Dashboard $/solve',
      'Cache hit en prefijo estable',
      'FCR y retries visibles',
    ],
  },
  ship: {
    title: 'Ship',
    blurb: 'Release con harness escaneado, catálogo de skills, y playbook de costo.',
    themes: ['harness', 'skills', 'economics'],
    checklist: [
      'Harness scan limpio',
      'Runbook de incidente de costo',
      'Rollback de reglas de memoria',
    ],
  },
}

export function Pipeline() {
  const [active, setActive] = useState<StageId>('spec')
  const location = useLocation()

  useEffect(() => {
    const hash = location.hash.replace('#', '') as StageId
    if (PIPELINE_STAGES.some((s) => s.id === hash)) setActive(hash)
  }, [location.hash])

  const meta = STAGE_META[active]
  const related = papersForThemes(meta.themes).slice(0, 8)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Pipeline interactivo</h1>
        <p className="mt-1 text-sm text-muted">
          Spec → Implement → Review → QA → Red → Blue → Green → Ship
        </p>
      </div>
      <StageRail active={active} onSelect={setActive} />
      <Card title={meta.title} subtitle={meta.blurb}>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Checklist</h4>
        <ul className="mb-4 list-inside list-disc space-y-1 text-sm">
          {meta.checklist.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
          Papers aplicables
        </h4>
        <div className="flex flex-wrap gap-2">
          {related.map((p) => (
            <PaperChip key={p.id} paper={p} />
          ))}
        </div>
      </Card>
      {active === 'red' && (
        <Card title="Red = adversarial">
          <p className="text-sm text-muted">
            Atacá el harness y las tools: inyección, ATO (Agent ATO), y fugas de sandbox. El éxito
            del red team es un hallazgo accionable para Blue.
          </p>
        </Card>
      )}
      {active === 'blue' && (
        <Card title="Blue = defensas">
          <p className="text-sm text-muted">
            Sandbox, budgets hard, y <strong className="text-fg">never-touch control layer</strong>.
            CompressAgent: no dietar AGENTS.md bajo ~50%.
          </p>
        </Card>
      )}
      {active === 'green' && (
        <Card title="Green = PQC metrics">
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded border border-line bg-panel2 p-3 font-mono text-sm">$/solve</div>
            <div className="rounded border border-line bg-panel2 p-3 font-mono text-sm">cache hit</div>
            <div className="rounded border border-line bg-panel2 p-3 font-mono text-sm">FCR</div>
          </div>
        </Card>
      )}
    </div>
  )
}
