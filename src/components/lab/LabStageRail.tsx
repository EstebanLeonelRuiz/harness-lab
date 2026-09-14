import { LAB_STAGES } from '../../data/labStages'
import type { LabStageId } from '../../types'

export function LabStageRail({
  active,
  onSelect,
}: {
  active: LabStageId
  onSelect: (id: LabStageId) => void
}) {
  return (
    <ol className="flex flex-wrap gap-1.5">
      {LAB_STAGES.map((s) => {
        const isActive = active === s.id
        return (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => onSelect(s.id)}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition ${
                isActive
                  ? 'border-accent bg-accent/15 text-accent'
                  : 'border-line bg-panel2 text-muted hover:border-muted hover:text-fg'
              }`}
              title={s.subtitle}
            >
              <span className="font-mono text-[10px] opacity-70">{s.id}</span>
              <span className="hidden sm:inline">{s.title}</span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
