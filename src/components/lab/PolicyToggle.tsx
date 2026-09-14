import type { LabPolicy } from '../../types'
import { PaperChip } from '../PaperChip'
import { paperById, illustrativeSourceLabel, policyProvenanceLabel } from '../../lib/papers'
import { getMeasurements } from '../../lib/costModel'

export function PolicyToggle({
  policy,
  on,
  onChange,
}: {
  policy: LabPolicy
  on: boolean
  onChange: (id: string, next: boolean) => void
}) {
  const measured = (getMeasurements().policyEffects as Record<
    string,
    {
      expId?: string
      tokenMult?: number
      costMult?: number
      cacheHitDelta?: number
      fcrDelta?: number
    }
  >)[policy.id]

  const effectHint = measured
    ? [
        measured.tokenMult != null && `tok×${measured.tokenMult}`,
        measured.costMult != null && `$×${measured.costMult}`,
        measured.cacheHitDelta != null &&
          `cache${measured.cacheHitDelta > 0 ? '+' : ''}${measured.cacheHitDelta}pp`,
        measured.fcrDelta != null &&
          `fcr${measured.fcrDelta > 0 ? '+' : ''}${(measured.fcrDelta * 100).toFixed(0)}pp`,
        measured.expId && `MVP ${measured.expId}`,
      ]
        .filter(Boolean)
        .join(' · ')
    : policy.effect.kind === 'numeric'
      ? [
          policy.effect.tokenMult != null && `tok×${policy.effect.tokenMult}`,
          policy.effect.costMult != null && `$×${policy.effect.costMult}`,
          policy.effect.cacheHitDelta != null &&
            `cache${policy.effect.cacheHitDelta > 0 ? '+' : ''}${policy.effect.cacheHitDelta}pp`,
          policy.effect.fcrDelta != null &&
            `fcr${policy.effect.fcrDelta > 0 ? '+' : ''}${(policy.effect.fcrDelta * 100).toFixed(0)}pp`,
        ]
          .filter(Boolean)
          .join(' · ')
      : 'cualitativo'

  const prov = policyProvenanceLabel(policy.id)

  return (
    <label
      className={`flex cursor-pointer flex-col gap-2 rounded-md border p-3 transition ${
        on ? 'border-accent/50 bg-accent/5' : 'border-line bg-panel2/40 hover:border-muted'
      }`}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 accent-accent"
          checked={on}
          onChange={(e) => onChange(policy.id, e.target.checked)}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-fg">{policy.label}</span>
            <span className="font-mono text-[10px] text-muted">{effectHint}</span>
          </div>
          <p className="mt-1 text-xs text-muted">{policy.description}</p>
          <p className={`mt-1 text-[10px] ${measured ? 'text-ok' : 'text-muted'}`}>
            {prov}
            {' · '}
            {illustrativeSourceLabel(policy.paperIds)}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 pl-7">
        {policy.paperIds.map((id) => {
          const p = paperById(id)
          return p ? <PaperChip key={id} paper={p} /> : null
        })}
      </div>
    </label>
  )
}
