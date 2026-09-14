import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Card } from '../components/Card'
import { PaperChip } from '../components/PaperChip'
import { StageRail, type StageId, PIPELINE_STAGES } from '../components/StageRail'
import { papersByIds } from '../lib/papers'
import type { LabStageId } from '../types'

/** Map SDLC pipeline steps → Integrated Lab stages (deep-links). */
const PIPELINE_TO_LAB: Record<
  StageId,
  { lab: LabStageId[]; title: string; blurb: string; checklist: string[]; paperIds: string[] }
> = {
  spec: {
    lab: ['A', 'I'],
    title: 'Spec',
    blurb: 'Budgets, never-touch control, KPIs ($/solve, FCR, cache hit) antes de codear.',
    checklist: [
      'Budget $ y techo de turns',
      'Control layer (AGENTS.md) versionada',
      'Éxito = patch + tests, no solo tokens bajos',
    ],
    paperIds: ['2608.01056', '2608.11095', '2607.12161', '2604.22750'],
  },
  implement: {
    lab: ['B', 'C', 'D', 'F'],
    title: 'Implement',
    blurb: 'Prefijos estables, nav file-centered, bash-first, skills slim.',
    checklist: [
      'Bloques estables al inicio del prompt',
      'Tools mínimas / bash-first',
      'Repo nav por árbol, no dump plano',
    ],
    paperIds: ['2601.06007', '2609.08355', '2609.11999', '2609.01428'],
  },
  review: {
    lab: ['A', 'G', 'J'],
    title: 'Review',
    blurb: 'Higiene de reglas, memoria con presupuesto, harness vs model.',
    checklist: [
      'Diff acotado',
      'Nueva regla con razón + borrado',
      'No filtrar secrets en tool I/O',
    ],
    paperIds: ['2608.11095', '2609.05441', '2609.11987'],
  },
  qa: {
    lab: ['E', 'I'],
    title: 'QA',
    blurb: 'Prune de trayectoria + medir $/solve (tokens ≠ $).',
    checklist: [
      'Suite verde',
      'Medir $/solve no solo tok',
      'Compresión no toca control <50%',
    ],
    paperIds: ['2601.16746', '2509.23586', '2607.12161', '2608.01056'],
  },
  red: {
    lab: ['F', 'I'],
    title: 'Red Team',
    blurb: 'ToFu fuzz + scanning the harness (supply-chain).',
    checklist: ['Fuzz tool args (ToFu)', 'Intentos de override de AGENTS.md', 'Exfiltración / path escape'],
    paperIds: ['2607.11423', '2609.07360', '2609.08301'],
  },
  blue: {
    lab: ['A', 'I'],
    title: 'Blue Team',
    blurb: 'Never-touch control, budgets hard, harness scan.',
    checklist: ['Sandbox + network policy', 'Budgets hard-fail', 'Control layer immutable para el agente'],
    paperIds: ['2608.01056', '2604.22750', '2609.07360'],
  },
  green: {
    lab: ['B', 'H', 'I'],
    title: 'Green Team',
    blurb: 'PQC: $/solve, cache hit, FCR + telemetría KV.',
    checklist: ['Dashboard $/solve', 'Cache hit en prefijo estable', 'FCR y retries visibles'],
    paperIds: ['2607.12161', '2601.06007', '2606.16824', '2609.08301'],
  },
  ship: {
    lab: ['J', 'H'],
    title: 'Ship',
    blurb: 'Harness escaneado, serving listo, playbook de costo.',
    checklist: ['Harness scan limpio', 'Runbook de incidente de costo', 'Rollback de reglas de memoria'],
    paperIds: ['2609.07360', '2609.11987', '2609.11677'],
  },
}

export function Pipeline() {
  const [active, setActive] = useState<StageId>('spec')
  const location = useLocation()

  useEffect(() => {
    const hash = location.hash.replace('#', '') as StageId
    if (PIPELINE_STAGES.some((s) => s.id === hash)) setActive(hash)
  }, [location.hash])

  const meta = PIPELINE_TO_LAB[active]
  const related = papersByIds(meta.paperIds)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Pipeline → Lab</h1>
        <p className="mt-1 text-sm text-muted">
          Vista SDLC que deep-linkea al{' '}
          <Link to="/lab">Integrated Lab</Link>. Spec → … → Ship.
        </p>
      </div>
      <StageRail active={active} onSelect={setActive} />
      <Card title={meta.title} subtitle={meta.blurb}>
        <div className="mb-4 flex flex-wrap gap-2">
          <span className="text-xs text-muted">Abrir en Lab:</span>
          {meta.lab.map((id) => (
            <Link
              key={id}
              to={`/lab#${id}`}
              className="rounded-md border border-accent/40 bg-accent/10 px-2.5 py-1 text-xs font-mono text-accent no-underline hover:bg-accent/20"
            >
              Etapa {id}
            </Link>
          ))}
        </div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Checklist</h4>
        <ul className="mb-4 list-inside list-disc space-y-1 text-sm">
          {meta.checklist.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
          Papers (deep-dive)
        </h4>
        <div className="flex flex-wrap gap-2">
          {related.map((p) => (
            <PaperChip key={p.id} paper={p} />
          ))}
        </div>
      </Card>
    </div>
  )
}
