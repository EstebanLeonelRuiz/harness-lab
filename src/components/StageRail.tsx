import { Link } from 'react-router-dom'

export const PIPELINE_STAGES = [
  { id: 'spec', label: 'Spec', color: 'bg-accent2' },
  { id: 'implement', label: 'Implement', color: 'bg-accent' },
  { id: 'review', label: 'Review', color: 'bg-accent2' },
  { id: 'qa', label: 'QA', color: 'bg-ok' },
  { id: 'red', label: 'Red Team', color: 'bg-danger' },
  { id: 'blue', label: 'Blue Team', color: 'bg-accent2' },
  { id: 'green', label: 'Green Team', color: 'bg-ok' },
  { id: 'ship', label: 'Ship', color: 'bg-accent' },
] as const

export type StageId = (typeof PIPELINE_STAGES)[number]['id']

export function StageRail({
  active,
  onSelect,
  linkToPipeline = false,
}: {
  active?: StageId
  onSelect?: (id: StageId) => void
  linkToPipeline?: boolean
}) {
  return (
    <ol className="flex flex-wrap gap-2">
      {PIPELINE_STAGES.map((s, i) => {
        const isActive = active === s.id
        const inner = (
          <span
            className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium transition ${
              isActive
                ? 'border-accent bg-accent/15 text-accent'
                : 'border-line bg-panel2 text-muted hover:border-muted hover:text-fg'
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${s.color}`} />
            <span className="font-mono text-[10px] opacity-60">{i + 1}</span>
            {s.label}
          </span>
        )
        if (linkToPipeline) {
          return (
            <li key={s.id}>
              <Link to={`/pipeline#${s.id}`} className="no-underline">
                {inner}
              </Link>
            </li>
          )
        }
        return (
          <li key={s.id}>
            <button type="button" onClick={() => onSelect?.(s.id)} className="cursor-pointer">
              {inner}
            </button>
          </li>
        )
      })}
    </ol>
  )
}
