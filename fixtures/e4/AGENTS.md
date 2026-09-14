# AGENTS.md — Control Layer

## Mission
You are the coding agent for harness-lab. Prefer measured metrics over illustrative multipliers. Keep diffs small and reproducible.

## Safety
- Never invent API keys or billing.
- Never push without explicit request.
- Prefer local fixtures for measurement.
- No Anthropic/OpenAI/xAI calls in measure.

## Style
- TypeScript strict.
- Spanish UI labels; English paper titles.
- Keep prompts with stable prefixes.
- Document seeds and encodings.

## Cache policy
- System + tools + repo map before dynamic blocks.
- Do not mutate tool schemas mid-session.
- Prefer Condition A packing (dynamic at end).

## Trajectory
- Drop redundant file reads.
- Sliding window of recent steps.
- Prefer AgentDiet-style prune only after cache-aware layout.

## Navigation
- Prefer file-centered scaffolds over flat dumps.
- Expand file bodies on demand.

## Economics
- Optimize dollars, not only tokens.
- Document assumed list prices separately from measured tokens.

## Testing
- Run npm run measure before build when metrics change.
- Assert all experiment ids present in measurements.json.

## Release
- Build must be green.
- No force-push to main.
- Parent agent deploys; do not git push from measure.

## Tools (never-touch names)
Declared tools the agent may invoke — CompressAgent floor protects these names:
- read_file
- write_file
- edit_file
- list_dir
- grep
- run_tests
- git_status
- git_diff
- bash
- npm_script
- search_symbols
- apply_patch

## Appendix A — Tool schemas summary
Each tool above has a JSON schema; names listed in Tools section are authoritative for preservation checks under compression.

## Appendix B — Glossary
prefix cache, KV eviction, FCR, CommitKV, AgentDiet, CompressAgent, TraceLab, ReCache.

## Extra hygiene 13
Keep control instructions; do not strip tool names under compression floor. Use deterministic seeds.

## Extra hygiene 14
Keep control instructions; do not strip tool names under compression floor. Use deterministic seeds.

## Extra hygiene 15
Keep control instructions; do not strip tool names under compression floor. Use deterministic seeds.

## Extra hygiene 16
Keep control instructions; do not strip tool names under compression floor. Use deterministic seeds.

## Extra hygiene 17
Keep control instructions; do not strip tool names under compression floor. Use deterministic seeds.

## Extra hygiene 18
Keep control instructions; do not strip tool names under compression floor. Use deterministic seeds.

## Extra hygiene 19
Keep control instructions; do not strip tool names under compression floor. Use deterministic seeds.

## Extra hygiene 20
Keep control instructions; do not strip tool names under compression floor. Use deterministic seeds.

## Extra hygiene 21
Keep control instructions; do not strip tool names under compression floor. Use deterministic seeds.

## Extra hygiene 22
Keep control instructions; do not strip tool names under compression floor. Use deterministic seeds.

## Extra hygiene 23
Keep control instructions; do not strip tool names under compression floor. Use deterministic seeds.

## Extra hygiene 24
Keep control instructions; do not strip tool names under compression floor. Use deterministic seeds.
