import type { DemoId } from '../types'
import type { ComponentType } from 'react'
import { PromptCacheDemo } from './PromptCacheDemo'
import { TrajectoryPruneDemo } from './TrajectoryPruneDemo'
import { AgentsMdHygieneDemo } from './AgentsMdHygieneDemo'
import { RepoNavDemo } from './RepoNavDemo'
import { BashVsTypedDemo } from './BashVsTypedDemo'
import { EconomicsDemo } from './EconomicsDemo'
import { KvEvictionDemo } from './KvEvictionDemo'

export const DEMO_COMPONENTS: Record<DemoId, ComponentType> = {
  'prompt-cache': PromptCacheDemo,
  'trajectory-prune': TrajectoryPruneDemo,
  'agents-md-hygiene': AgentsMdHygieneDemo,
  'repo-nav': RepoNavDemo,
  'bash-vs-typed': BashVsTypedDemo,
  economics: EconomicsDemo,
  'kv-eviction': KvEvictionDemo,
}
