import type { Paper } from '../types'

export function PaperChip({ paper }: { paper: Paper }) {
  return (
    <a
      href={paper.url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-line bg-panel2 px-2.5 py-1 text-xs text-fg no-underline hover:border-accent/60 hover:bg-panel"
      title={paper.takeaway}
    >
      <span className="truncate font-medium">{paper.title}</span>
      <span className="shrink-0 font-mono text-[10px] text-muted">{paper.id}</span>
      {!paper.verified && (
        <span className="shrink-0 rounded bg-warn/15 px-1 text-[9px] uppercase text-warn">?</span>
      )}
    </a>
  )
}
