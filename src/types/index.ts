export type Theme =
  | 'cache'
  | 'compression'
  | 'harness'
  | 'serving'
  | 'memory'
  | 'economics'
  | 'navigation'
  | 'skills'
  | 'security'

export interface Paper {
  id: string
  title: string
  authors: string[]
  url: string
  themes: Theme[]
  firstSeen: string
  takeaway: string
  demoId?: string
  verified: boolean
}

export type DemoId =
  | 'prompt-cache'
  | 'trajectory-prune'
  | 'agents-md-hygiene'
  | 'repo-nav'
  | 'bash-vs-typed'
  | 'economics'
  | 'kv-eviction'

export interface DemoMeta {
  id: DemoId
  title: string
  blurb: string
  themes: Theme[]
}
