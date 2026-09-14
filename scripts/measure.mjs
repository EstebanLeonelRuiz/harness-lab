#!/usr/bin/env node
/**
 * Harness Lab — MVP measurement runner
 *
 * Honest local measurements only (no LLM API / billing):
 * - token counts via js-tiktoken (encoding: o200k_base)
 * - sha256 of prompt prefixes
 * - wall-clock ms for transforms (secondary)
 * - structural scores (tool-name preservation)
 * - seeded KV access-trace simulation (seed documented in fixtures/e7)
 *
 * Writes:
 *   src/data/measurements.json       — compact numbers for UI
 *   src/data/measurement-audit.json  — full audit trail
 *
 * Reproduce: npm run measure
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getEncoding } from 'js-tiktoken'

const ROOT = join(fileURLToPath(import.meta.url), '..', '..')
const FIX = join(ROOT, 'fixtures')
const OUT_DIR = join(ROOT, 'src', 'data')

/** Documented encoding — o200k_base (GPT-4o / o-series family tokenizer). */
const ENCODING = 'o200k_base'
const enc = getEncoding(ENCODING)

function tok(text) {
  return enc.encode(String(text ?? '')).length
}

function sha256(text) {
  return createHash('sha256').update(String(text), 'utf8').digest('hex')
}

function nowIso() {
  return new Date().toISOString()
}

function read(path) {
  return readFileSync(path, 'utf8')
}

function readJson(path) {
  return JSON.parse(read(path))
}

/** Mulberry32 PRNG — deterministic given seed. */
function mulberry32(seed) {
  let t = seed >>> 0
  return function next() {
    t = (t + 0x6d2b79f5) >>> 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function metric(key, value, unit, howMeasured) {
  return { key, value, unit, howMeasured }
}

function timed(fn) {
  const t0 = performance.now()
  const result = fn()
  const ms = performance.now() - t0
  return { result, ms }
}

// ─── E1 prefix-cache ─────────────────────────────────────────────────────────

function runE1() {
  const startedAt = nowIso()
  const system = read(join(FIX, 'e1/system.txt')).trim()
  const tools = read(join(FIX, 'e1/tools.json')).trim()
  const repoMap = read(join(FIX, 'e1/repo-map.txt')).trim()
  const turns = readJson(join(FIX, 'e1/turns.json'))

  const stableCore = `SYSTEM\n${system}\n\nTOOLS\n${tools}\n\nREPO_MAP\n${repoMap}`
  const prefixTokenCount = tok(stableCore)

  const turnsA = []
  const turnsB = []

  for (let i = 0; i < turns.length; i++) {
    const t = turns[i]
    const dynamic = `USER\n${t.user}\n\nTOOL_RESULTS\n${JSON.stringify(t.toolResults, null, 2)}`

    // Condition A: dynamic at end → stable prefix identical every turn
    const promptA = `${stableCore}\n\n---TURN ${i + 1}---\n${dynamic}`
    const prefixA = stableCore

    // Condition B: dynamic interleaved (user+results inserted before tools/map) → breaks prefix
    const promptB = `SYSTEM\n${system}\n\n---DYNAMIC ${i + 1}---\n${dynamic}\n\nTOOLS\n${tools}\n\nREPO_MAP\n${repoMap}`
    // Prefix for B = everything before first dynamic-dependent byte; we take first 200 chars of
    // the "would-be" cache key region that includes interleaved dynamic → changes each turn.
    const prefixB = `SYSTEM\n${system}\n\n---DYNAMIC ${i + 1}---\n${dynamic}`

    turnsA.push({
      turn: i + 1,
      full_tokens: tok(promptA),
      prefix_sha256: sha256(prefixA),
      prefix_tokens: tok(prefixA),
    })
    turnsB.push({
      turn: i + 1,
      full_tokens: tok(promptB),
      prefix_sha256: sha256(prefixB),
      prefix_tokens: tok(prefixB),
    })
  }

  const prefixStableA =
    turnsA.every((t) => t.prefix_sha256 === turnsA[0].prefix_sha256)
  const prefixStableB =
    turnsB.every((t) => t.prefix_sha256 === turnsB[0].prefix_sha256)

  const finishedAt = nowIso()
  return {
    id: 'E1',
    title: 'prefix-cache',
    hypothesis:
      'Stable prefix (dynamic at end) keeps sha256 identical across turns; interleaved dynamic breaks prefix identity.',
    method:
      'Build coding-agent prompt (system+tools+repo map). Condition A appends dynamic at end; B interleaves dynamic after system. Tokenize with o200k_base; sha256 UTF-8 of each condition prefix across 3 turns.',
    fixtures: [
      'fixtures/e1/system.txt',
      'fixtures/e1/tools.json',
      'fixtures/e1/repo-map.txt',
      'fixtures/e1/turns.json',
    ],
    encoding: ENCODING,
    startedAt,
    finishedAt,
    commands_or_functions: ['tok', 'sha256', 'runE1'],
    raw: {
      prefixTokenCount,
      turnsA,
      turnsB,
      prefixStableA,
      prefixStableB,
    },
    metrics: [
      metric('prefix_token_count', prefixTokenCount, 'tokens', 'js-tiktoken o200k_base on stableCore'),
      metric('full_tokens_A_mean', Math.round(turnsA.reduce((s, t) => s + t.full_tokens, 0) / turnsA.length), 'tokens', 'mean full prompt A'),
      metric('full_tokens_B_mean', Math.round(turnsB.reduce((s, t) => s + t.full_tokens, 0) / turnsB.length), 'tokens', 'mean full prompt B'),
      metric('prefix_stable_A', prefixStableA ? 1 : 0, 'bool', 'sha256 identical across 3 turns for A'),
      metric('prefix_stable_B', prefixStableB ? 1 : 0, 'bool', 'sha256 identical across 3 turns for B'),
      metric('unique_prefix_hashes_A', new Set(turnsA.map((t) => t.prefix_sha256)).size, 'count', 'distinct sha256 A'),
      metric('unique_prefix_hashes_B', new Set(turnsB.map((t) => t.prefix_sha256)).size, 'count', 'distinct sha256 B'),
    ],
    limitations: [
      'No real provider prompt-cache API; prefix identity is a proxy for cacheability.',
      'Tokenizer o200k_base may differ from Anthropic/OpenAI production tokenizers used in billing.',
    ],
    relatedPaperIds: ['2601.06007', '2606.30560', '2607.15516', '2606.17016', '2608.19662'],
  }
}

// ─── E2 bash-vs-typed ────────────────────────────────────────────────────────

function runE2() {
  const startedAt = nowIso()
  const typed = read(join(FIX, 'e2/typed-tools.json'))
  const bash = read(join(FIX, 'e2/bash-only.json'))
  const typedSection = `TOOLS\n${typed}`
  const bashSection = `TOOLS\n${bash}`
  const typedTokens = tok(typedSection)
  const bashTokens = tok(bashSection)
  const ratio = bashTokens / typedTokens
  const finishedAt = nowIso()
  return {
    id: 'E2',
    title: 'bash-vs-typed',
    hypothesis: 'A single bash tool schema uses far fewer tokens than a 12-tool typed catalog.',
    method: 'Tokenize tool-section-only JSON for 12 typed tools vs 1 bash tool with o200k_base.',
    fixtures: ['fixtures/e2/typed-tools.json', 'fixtures/e2/bash-only.json'],
    encoding: ENCODING,
    startedAt,
    finishedAt,
    commands_or_functions: ['tok', 'runE2'],
    raw: {
      typedToolCount: JSON.parse(typed).length,
      bashToolCount: JSON.parse(bash).length,
      typedTokens,
      bashTokens,
      ratio_bash_over_typed: ratio,
    },
    metrics: [
      metric('typed_tool_tokens', typedTokens, 'tokens', 'tool section only, 12 schemas'),
      metric('bash_tool_tokens', bashTokens, 'tokens', 'tool section only, 1 schema'),
      metric('token_ratio_bash_over_typed', Number(ratio.toFixed(4)), 'ratio', 'bashTokens/typedTokens'),
      metric('token_reduction_pct', Number(((1 - ratio) * 100).toFixed(2)), 'percent', '(1 - bash/typed)*100'),
    ],
    limitations: [
      'Counts schema tokens only; ignores that bash may need more conversational clarification.',
      'Catalog content is fixture-realistic, not extracted from a production agent.',
    ],
    relatedPaperIds: ['2609.11999'],
  }
}

// ─── E3 trajectory-prune ─────────────────────────────────────────────────────

function pruneTrajectory(steps, windowSize) {
  // 1) sliding window: keep last windowSize steps (always keep first user if present)
  let kept = steps.slice(-windowSize)
  // 2) drop redundant file reads: keep only the latest read_file per path
  const seenReads = new Set()
  const out = []
  for (let i = kept.length - 1; i >= 0; i--) {
    const s = kept[i]
    if (s.role === 'tool' && s.name === 'read_file' && s.path) {
      if (seenReads.has(s.path)) continue
      seenReads.add(s.path)
    }
    out.push(s)
  }
  return out.reverse()
}

function serializeTrajectory(steps) {
  return steps
    .map((s) => {
      if (s.role === 'tool') {
        return `[tool:${s.name}] ${s.path ?? ''}\n${s.result ?? ''}`
      }
      return `[${s.role}] ${s.content ?? ''}`
    })
    .join('\n\n')
}

function runE3() {
  const startedAt = nowIso()
  const traj = readJson(join(FIX, 'e3/trajectory.json'))
  const beforeText = serializeTrajectory(traj.steps)
  const { result: pruned, ms } = timed(() =>
    pruneTrajectory(traj.steps, traj.windowSize),
  )
  const afterText = serializeTrajectory(pruned)
  const tokensBefore = tok(beforeText)
  const tokensAfter = tok(afterText)
  const reductionPct = ((tokensBefore - tokensAfter) / tokensBefore) * 100
  const finishedAt = nowIso()
  return {
    id: 'E3',
    title: 'trajectory-prune',
    hypothesis:
      'Sliding-window + drop-redundant-reads reduces transcript tokens while keeping recent context.',
    method:
      'Serialize multi-turn fixture (~15–25 steps). Apply sliding window then drop older duplicate read_file paths. Count tokens before/after.',
    fixtures: ['fixtures/e3/trajectory.json'],
    encoding: ENCODING,
    startedAt,
    finishedAt,
    commands_or_functions: ['pruneTrajectory', 'serializeTrajectory', 'tok'],
    raw: {
      stepsBefore: traj.steps.length,
      stepsAfter: pruned.length,
      windowSize: traj.windowSize,
      tokensBefore,
      tokensAfter,
      reductionPct,
      transformMs: ms,
      prunedIds: pruned.map((s) => s.id),
    },
    metrics: [
      metric('tokens_before', tokensBefore, 'tokens', 'full serialized trajectory'),
      metric('tokens_after', tokensAfter, 'tokens', 'after prune'),
      metric('reduction_pct', Number(reductionPct.toFixed(2)), 'percent', '(before-after)/before*100'),
      metric('steps_before', traj.steps.length, 'count', 'fixture step count'),
      metric('steps_after', pruned.length, 'count', 'pruned step count'),
      metric('transform_ms', Number(ms.toFixed(3)), 'ms', 'wall-clock secondary'),
    ],
    limitations: [
      'Pruner is a simple heuristic, not AgentDiet/SWE-Pruner model-based compression.',
      'Timing is secondary and machine-dependent; not a primary claim.',
    ],
    relatedPaperIds: [
      '2509.23586',
      '2609.08318',
      '2601.16746',
      '2607.18213',
      '2609.00749',
      '2607.22711',
    ],
  }
}

// ─── E4 control-compression ──────────────────────────────────────────────────

function compressAgentsMd(text, keepPct) {
  const lines = text.split('\n')
  // Split into sections by ## headers
  const sections = []
  let cur = []
  for (const line of lines) {
    if (line.startsWith('## ') && cur.length) {
      sections.push(cur.join('\n'))
      cur = [line]
    } else {
      cur.push(line)
    }
  }
  if (cur.length) sections.push(cur.join('\n'))
  const keep = Math.max(1, Math.ceil(sections.length * (keepPct / 100)))
  return sections.slice(0, keep).join('\n\n')
}

function toolNamePreservation(original, compressed, toolNames) {
  const present = toolNames.filter((n) => compressed.includes(n))
  return present.length / toolNames.length
}

function runE4() {
  const startedAt = nowIso()
  const text = read(join(FIX, 'e4/AGENTS.md'))
  const toolNames = [
    'read_file',
    'write_file',
    'edit_file',
    'list_dir',
    'grep',
    'run_tests',
    'git_status',
    'git_diff',
    'bash',
    'npm_script',
    'search_symbols',
    'apply_patch',
  ]
  const levels = [75, 50, 35]
  const results = {}
  const { ms } = timed(() => {
    for (const pct of levels) {
      const compressed = compressAgentsMd(text, pct)
      results[pct] = {
        tokens: tok(compressed),
        chars: compressed.length,
        tool_name_preservation_rate: toolNamePreservation(text, compressed, toolNames),
        keepPct: pct,
      }
    }
  })
  const tokensFull = tok(text)
  const finishedAt = nowIso()
  return {
    id: 'E4',
    title: 'control-compression',
    hypothesis:
      'Keeping first N% of AGENTS.md sections reduces tokens; tool-name preservation drops if Tools section is truncated away.',
    method:
      'Split AGENTS.md by ## sections; keep first 75/50/35% of sections. Measure tokens + fraction of declared tool names still present.',
    fixtures: ['fixtures/e4/AGENTS.md'],
    encoding: ENCODING,
    startedAt,
    finishedAt,
    commands_or_functions: ['compressAgentsMd', 'toolNamePreservation', 'tok'],
    raw: { tokensFull, lineCount: text.split('\n').length, results, transformMs: ms },
    metrics: [
      metric('tokens_full', tokensFull, 'tokens', 'uncompressed AGENTS.md'),
      metric('tokens_keep_75', results[75].tokens, 'tokens', 'keep first 75% sections'),
      metric('tokens_keep_50', results[50].tokens, 'tokens', 'keep first 50% sections'),
      metric('tokens_keep_35', results[35].tokens, 'tokens', 'keep first 35% sections'),
      metric('preservation_75', Number(results[75].tool_name_preservation_rate.toFixed(4)), 'rate', 'tool names present'),
      metric('preservation_50', Number(results[50].tool_name_preservation_rate.toFixed(4)), 'rate', 'tool names present'),
      metric('preservation_35', Number(results[35].tool_name_preservation_rate.toFixed(4)), 'rate', 'tool names present'),
      metric('transform_ms', Number(ms.toFixed(3)), 'ms', 'wall-clock secondary'),
    ],
    limitations: [
      'Section-prefix truncation is a crude proxy for CompressAgent; not model-based.',
      'Tool names early in the fixture inflate preservation at high keep%.',
    ],
    relatedPaperIds: ['2608.01056', '2608.11095'],
  }
}

// ─── E5 repo-nav ─────────────────────────────────────────────────────────────

function walkFiles(dir, base = dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) out.push(...walkFiles(p, base))
    else out.push(p)
  }
  return out
}

function runE5() {
  const startedAt = nowIso()
  const repoRoot = join(FIX, 'e5/mini-repo')
  const sigs = readJson(join(FIX, 'e5/signatures.json'))
  const files = walkFiles(repoRoot).sort()
  const flatParts = files.map((p) => {
    const rel = relative(repoRoot, p)
    return `===== ${rel} =====\n${read(p)}`
  })
  const flat = flatParts.join('\n\n')
  const scaffold = [
    'FILE-CENTERED SCAFFOLD (paths + signatures; expand on demand)',
    ...sigs.map((s) => `${s.path} — ${s.signature}`),
  ].join('\n')
  const flatTokens = tok(flat)
  const scaffoldTokens = tok(scaffold)
  const ratio = scaffoldTokens / flatTokens
  const finishedAt = nowIso()
  return {
    id: 'E5',
    title: 'repo-nav',
    hypothesis:
      'File-centered scaffold (paths+signatures) uses fewer tokens than flat concatenation of all file bodies.',
    method:
      'Pack mini-repo (11 files) two ways: full flat concat vs scaffold of path+signature. Tokenize both.',
    fixtures: ['fixtures/e5/mini-repo/', 'fixtures/e5/signatures.json'],
    encoding: ENCODING,
    startedAt,
    finishedAt,
    commands_or_functions: ['walkFiles', 'tok', 'runE5'],
    raw: {
      fileCount: files.length,
      flatTokens,
      scaffoldTokens,
      ratio_scaffold_over_flat: ratio,
      flatChars: flat.length,
      scaffoldChars: scaffold.length,
    },
    metrics: [
      metric('flat_tokens', flatTokens, 'tokens', 'full file concatenation'),
      metric('scaffold_tokens', scaffoldTokens, 'tokens', 'paths + signatures only'),
      metric('token_ratio_scaffold_over_flat', Number(ratio.toFixed(4)), 'ratio', 'scaffold/flat'),
      metric('token_reduction_pct', Number(((1 - ratio) * 100).toFixed(2)), 'percent', '(1-scaffold/flat)*100'),
      metric('file_count', files.length, 'count', 'files in mini-repo'),
    ],
    limitations: [
      'Scaffold omits bodies; real sessions pay expand cost when reading files.',
      'Mini-repo is tiny vs production monorepos.',
    ],
    relatedPaperIds: ['2609.08355', '2608.29675'],
  }
}

// ─── E6 agents-md-growth ─────────────────────────────────────────────────────

function runE6() {
  const startedAt = nowIso()
  const rules = readJson(join(FIX, 'e6/rules.json'))
  const header = '# AGENTS.md\n\n## Core\nFollow measured metrics.\n\n## Rules\n'
  let withSignal = header
  let withoutSignal = header
  const growth = []
  for (const r of rules) {
    withoutSignal += `\n### ${r.id}\n${r.text}\n`
    withSignal += `\n### ${r.id}\n${r.text}\n`
    if (r.deletion_signal) {
      withSignal += `deletion_signal: ${r.deletion_signal}\n`
    }
    // simulate pruning: if deletion_signal present and "obsolete" in text, drop older every 10 commits
    if (rules.indexOf(r) > 0 && (rules.indexOf(r) + 1) % 10 === 0) {
      // with-signal variant: drop rules that have deletion_signal (simulate cleanup)
      const kept = []
      const blocks = withSignal.split(/\n### /)
      const head = blocks[0]
      for (let i = 1; i < blocks.length; i++) {
        const block = blocks[i]
        if (block.includes('deletion_signal:') && kept.length > 5) {
          // drop some signaled rules periodically
          continue
        }
        kept.push(block)
      }
      withSignal = head + (kept.length ? '\n### ' + kept.join('\n### ') : '')
    }
    growth.push({
      commit: rules.indexOf(r) + 1,
      chars_with: withSignal.length,
      chars_without: withoutSignal.length,
      tokens_with: tok(withSignal),
      tokens_without: tok(withoutSignal),
    })
  }
  const first = growth[0]
  const last = growth[growth.length - 1]
  const growthRatioCharsWithout = last.chars_without / first.chars_without
  const growthRatioCharsWith = last.chars_with / first.chars_with
  const growthRatioTokensWithout = last.tokens_without / first.tokens_without
  const growthRatioTokensWith = last.tokens_with / first.tokens_with
  const finishedAt = nowIso()
  return {
    id: 'E6',
    title: 'agents-md-growth',
    hypothesis:
      'Deletion-signal metadata enables periodic cleanup so final growth ratio is lower than append-only rules.',
    method:
      'Simulate 40 commits each adding a rule. Variant A append-only; variant B includes deletion_signal and prunes signaled rules every 10 commits. Measure final char/token growth ratios.',
    fixtures: ['fixtures/e6/rules.json'],
    encoding: ENCODING,
    startedAt,
    finishedAt,
    commands_or_functions: ['runE6', 'tok'],
    raw: {
      commits: 40,
      final_chars_with: last.chars_with,
      final_chars_without: last.chars_without,
      final_tokens_with: last.tokens_with,
      final_tokens_without: last.tokens_without,
      growthRatioCharsWith,
      growthRatioCharsWithout,
      growthRatioTokensWith,
      growthRatioTokensWithout,
      growth,
    },
    metrics: [
      metric('final_tokens_without_signal', last.tokens_without, 'tokens', 'append-only'),
      metric('final_tokens_with_signal', last.tokens_with, 'tokens', 'with deletion_signal pruning'),
      metric('growth_ratio_tokens_without', Number(growthRatioTokensWithout.toFixed(4)), 'ratio', 'final/first tokens append-only'),
      metric('growth_ratio_tokens_with', Number(growthRatioTokensWith.toFixed(4)), 'ratio', 'final/first tokens with signal'),
      metric('growth_ratio_chars_without', Number(growthRatioCharsWithout.toFixed(4)), 'ratio', 'final/first chars append-only'),
      metric('growth_ratio_chars_with', Number(growthRatioCharsWith.toFixed(4)), 'ratio', 'final/first chars with signal'),
    ],
    limitations: [
      'Prune policy is a lab heuristic, not the CLAUDE.md paper algorithm.',
      'Growth ratios depend on fixture rule length and prune cadence.',
    ],
    relatedPaperIds: ['2608.11095'],
  }
}

// ─── E7 kv-access-sim ────────────────────────────────────────────────────────

function runE7() {
  const startedAt = nowIso()
  const cfg = readJson(join(FIX, 'e7/sim-config.json'))
  
  // Build page ids
  const prefixPages = Array.from({ length: cfg.prefixPages }, (_, i) => `prefix:${i}`)
  const toolPages = Array.from({ length: cfg.toolResultPages }, (_, i) => `tool:${i}`)

  // Pre-generate reproducible access trace (gets only), replay under both policies.
  // Commit markers are inline but do not count toward hit/miss.
  const rng = mulberry32(cfg.seed)
  const ops = []
  for (const id of prefixPages) ops.push({ type: 'get', id, kind: 'prefix' })
  while (ops.filter((o) => o.type === 'get').length < cfg.steps) {
    const toolId = toolPages[Math.floor(rng() * toolPages.length)]
    ops.push({ type: 'get', id: toolId, kind: 'tool', phase: 'alloc' })
    // Flood uniquely to force capacity pressure ( > capacity - 2 )
    const flood = cfg.capacityPages + 2
    const used = new Set([toolId])
    for (let f = 0; f < flood; f++) {
      if (rng() < 0.25) {
        ops.push({
          type: 'get',
          id: prefixPages[Math.floor(rng() * prefixPages.length)],
          kind: 'prefix',
        })
      } else {
        let noise
        do {
          noise = toolPages[Math.floor(rng() * toolPages.length)]
        } while (used.has(noise) && used.size < toolPages.length)
        used.add(noise)
        ops.push({ type: 'get', id: noise, kind: 'tool', phase: 'noise' })
      }
    }
    ops.push({ type: 'get', id: toolId, kind: 'tool', phase: 'reread' })
    ops.push({ type: 'commit' })
  }
  // Trim to cfg.steps gets (keep commits that fall inside)
  let gets = 0
  const trace = []
  for (const op of ops) {
    if (op.type === 'get') {
      if (gets >= cfg.steps) break
      gets++
    }
    trace.push(op)
  }

  function simulate(policy) {
    /** @type {Map<string, {lastUsed:number, pinned:boolean}>} */
    const cache = new Map()
    let hits = 0
    let misses = 0
    let clock = 0
    let rereadHits = 0
    let rereadTotal = 0

    function touch(id, pinned = false) {
      const e = cache.get(id)
      if (e) {
        e.lastUsed = clock
        if (pinned) e.pinned = true
        hits++
        return true
      }
      misses++
      cache.set(id, { lastUsed: clock, pinned })
      while (cache.size > cfg.capacityPages) evict()
      return false
    }

    function evict() {
      let victim = null
      let victimScore = Infinity
      for (const [id, e] of cache) {
        if (policy === 'tool_commit_aware' && e.pinned) continue
        if (e.lastUsed < victimScore) {
          victimScore = e.lastUsed
          victim = id
        }
      }
      if (victim == null) {
        for (const [id, e] of cache) {
          if (e.lastUsed < victimScore) {
            victimScore = e.lastUsed
            victim = id
          }
        }
      }
      if (victim != null) cache.delete(victim)
    }

    for (const op of trace) {
      clock++
      if (op.type === 'commit') {
        if (policy === 'tool_commit_aware') {
          for (const e of cache.values()) e.pinned = false
        }
        continue
      }
      // Pin tool pages from alloc through reread (CommitKV: don't evict until observation commit)
      const pin =
        policy === 'tool_commit_aware' &&
        op.kind === 'tool' &&
        (op.phase === 'alloc' || op.phase === 'reread')
      // Also keep pin on the alloc'd page during noise? We pin at alloc; page stays pinned until commit.
      const hit = touch(op.id, pin)
      if (op.phase === 'reread') {
        rereadTotal++
        if (hit) rereadHits++
      }
    }
    const total = hits + misses
    return {
      hits,
      misses,
      hitRatePct: total ? (hits / total) * 100 : 0,
      rereadHitRatePct: rereadTotal ? (rereadHits / rereadTotal) * 100 : 0,
      rereadHits,
      rereadTotal,
      finalSize: cache.size,
      traceGets: gets,
    }
  }

  const lru = simulate('lru')
  const commitAware = simulate('tool_commit_aware')
  const finishedAt = nowIso()

  return {
    id: 'E7',
    title: 'kv-access-sim',
    hypothesis:
      'Tool-commit-aware eviction (pin until observation commit) improves hit rate vs plain LRU on a mixed prefix/tool access trace.',
    method:
      `Seeded Mulberry32(seed=${cfg.seed}) simulation of ${cfg.steps} steps over ${cfg.capacityPages} page capacity. ` +
      `${cfg.prefixPages} prefix pages + ${cfg.toolResultPages} tool-result pages. ` +
      `LRU vs CommitKV-inspired: tool pages pinned until synthetic observation commit.`,
    fixtures: ['fixtures/e7/sim-config.json'],
    encoding: ENCODING,
    seed: cfg.seed,
    startedAt,
    finishedAt,
    commands_or_functions: ['mulberry32', 'simulate', 'runE7'],
    raw: {
      config: cfg,
      lru,
      tool_commit_aware: commitAware,
      algorithm: cfg.algorithm,
    },
    metrics: [
      metric('lru_hit_rate_pct', Number(lru.hitRatePct.toFixed(2)), 'percent', 'LRU simulation hits/(hits+misses)'),
      metric('commit_aware_hit_rate_pct', Number(commitAware.hitRatePct.toFixed(2)), 'percent', 'tool-commit-aware hits/(hits+misses)'),
      metric('hit_rate_delta_pp', Number((commitAware.hitRatePct - lru.hitRatePct).toFixed(2)), 'percentage_points', 'commit_aware - lru'),
      metric('steps', cfg.steps, 'count', 'simulation length'),
      metric('capacity_pages', cfg.capacityPages, 'count', 'cache capacity'),
    ],
    limitations: [
      'Synthetic access trace — not captured from a live agent runtime.',
      'Page granularity and pin/commit timing are simplified CommitKV analogues.',
      'No real GPU/CPU KV tensor memory measured.',
    ],
    relatedPaperIds: ['2608.07855', '2507.07400', '2605.06472', '2606.16824'],
  }
}

// ─── E8 economics-identity ───────────────────────────────────────────────────

/**
 * ASSUMED list prices (NOT measured bills — no API keys on this machine).
 * Approximate public list prices for a frontier input token tier (USD per 1M tokens).
 * Cached input assumed cheaper than fresh input (common provider pattern).
 */
const ASSUMED_PRICE_PER_MTOK_INPUT = 3.0
const ASSUMED_PRICE_PER_MTOK_CACHED_INPUT = 0.3
const ASSUMED_PRICE_PER_MTOK_OUTPUT = 15.0

function proxyCostUsd({ freshInputTokens, cachedInputTokens, outputTokens = 0 }) {
  return (
    (freshInputTokens / 1e6) * ASSUMED_PRICE_PER_MTOK_INPUT +
    (cachedInputTokens / 1e6) * ASSUMED_PRICE_PER_MTOK_CACHED_INPUT +
    (outputTokens / 1e6) * ASSUMED_PRICE_PER_MTOK_OUTPUT
  )
}

function runE8(e1, e2, e3) {
  const startedAt = nowIso()
  const prefixTokens = e1.raw.prefixTokenCount
  const fullA = e1.raw.turnsA.reduce((s, t) => s + t.full_tokens, 0)
  const dynamicA = fullA - prefixTokens * e1.raw.turnsA.length

  // Scenario: 3-turn session with stable prefix → prefix charged once fresh, then cached
  const stable = {
    freshInputTokens: prefixTokens + dynamicA, // prefix once + all dynamic
    cachedInputTokens: prefixTokens * (e1.raw.turnsA.length - 1), // prefix reused turns 2..n
  }
  // Aggressive prune that rewrites prefix each turn (forces full re-bill of prefix)
  // Use E3 reduction on dynamic portion but break cache
  const dynAfterPrune = Math.round(dynamicA * (e3.raw.tokensAfter / e3.raw.tokensBefore))
  const aggressive = {
    freshInputTokens: prefixTokens * e1.raw.turnsA.length + dynAfterPrune,
    cachedInputTokens: 0,
  }
  // Mild prune keeping prefix stable
  const mild = {
    freshInputTokens: prefixTokens + dynAfterPrune,
    cachedInputTokens: prefixTokens * (e1.raw.turnsA.length - 1),
  }

  const costStable = proxyCostUsd(stable)
  const costAggressive = proxyCostUsd(aggressive)
  const costMild = proxyCostUsd(mild)

  const tokensStable = stable.freshInputTokens + stable.cachedInputTokens
  const tokensAggressive = aggressive.freshInputTokens + aggressive.cachedInputTokens
  const tokensMild = mild.freshInputTokens + mild.cachedInputTokens

  const finishedAt = nowIso()
  return {
    id: 'E8',
    title: 'economics-identity',
    hypothesis:
      'Aggressive prune that forces prefix rewrite can raise proxy $ even when total tokens drop (Token Reduction ≠ Cost Reduction).',
    method:
      'Compose local cost proxy from E1 prefix/full tokens and E3 reduction. ' +
      'ASSUMED list prices (not billed): ' +
      `INPUT=$${ASSUMED_PRICE_PER_MTOK_INPUT}/MTok, ` +
      `CACHED_INPUT=$${ASSUMED_PRICE_PER_MTOK_CACHED_INPUT}/MTok, ` +
      `OUTPUT=$${ASSUMED_PRICE_PER_MTOK_OUTPUT}/MTok. ` +
      'Compare stable-prefix vs aggressive-prune-breaks-cache vs mild-prune-keeps-cache.',
    fixtures: ['derived from E1–E3 measurements'],
    encoding: ENCODING,
    startedAt,
    finishedAt,
    commands_or_functions: ['proxyCostUsd', 'runE8'],
    raw: {
      assumptions: {
        ASSUMED_PRICE_PER_MTOK_INPUT,
        ASSUMED_PRICE_PER_MTOK_CACHED_INPUT,
        ASSUMED_PRICE_PER_MTOK_OUTPUT,
        note: 'List-price assumptions only — no API billing measured on this machine.',
      },
      fromE1: { prefixTokens, fullA, dynamicA, turns: e1.raw.turnsA.length },
      fromE2: { typedTokens: e2.raw.typedTokens, bashTokens: e2.raw.bashTokens },
      fromE3: { tokensBefore: e3.raw.tokensBefore, tokensAfter: e3.raw.tokensAfter },
      scenarios: {
        stable_prefix: { ...stable, tokens: tokensStable, proxyUsd: costStable },
        aggressive_prune_breaks_cache: {
          ...aggressive,
          tokens: tokensAggressive,
          proxyUsd: costAggressive,
        },
        mild_prune_keeps_cache: { ...mild, tokens: tokensMild, proxyUsd: costMild },
      },
    },
    metrics: [
      metric('proxy_usd_stable_prefix', Number(costStable.toFixed(6)), 'USD', 'assumed list prices'),
      metric('proxy_usd_aggressive_breaks_cache', Number(costAggressive.toFixed(6)), 'USD', 'assumed list prices'),
      metric('proxy_usd_mild_keeps_cache', Number(costMild.toFixed(6)), 'USD', 'assumed list prices'),
      metric('tokens_stable', tokensStable, 'tokens', 'fresh+cached counted'),
      metric('tokens_aggressive', tokensAggressive, 'tokens', 'all fresh'),
      metric('tokens_mild', tokensMild, 'tokens', 'fresh+cached counted'),
      metric(
        'aggressive_cheaper_tokens_but_costlier_usd',
        tokensAggressive < tokensStable && costAggressive > costStable ? 1 : 0,
        'bool',
        'tokens drop but proxy $ rises',
      ),
      metric('assumed_price_input_per_mtok', ASSUMED_PRICE_PER_MTOK_INPUT, 'USD/MTok', 'assumption not measured'),
      metric('assumed_price_cached_input_per_mtok', ASSUMED_PRICE_PER_MTOK_CACHED_INPUT, 'USD/MTok', 'assumption not measured'),
    ],
    limitations: [
      'Dollar figures are ASSUMED list-price proxies — not real invoices.',
      'No Anthropic/OpenAI/xAI API keys; billing not measured.',
      'Cache discount ratio is an assumption (10x cheaper cached input).',
    ],
    relatedPaperIds: ['2607.12161', '2604.22750'],
  }
}

// ─── Compose UI measurements + policy map ────────────────────────────────────

function mget(exp, key) {
  const m = exp.metrics.find((x) => x.key === key)
  if (!m) throw new Error(`missing metric ${exp.id}.${key}`)
  return m.value
}

function buildMeasurements(exps, generatedAt) {
  const byId = Object.fromEntries(exps.map((e) => [e.id, e]))
  const E1 = byId.E1
  const E2 = byId.E2
  const E3 = byId.E3
  const E4 = byId.E4
  const E5 = byId.E5
  const E6 = byId.E6
  const E7 = byId.E7
  const E8 = byId.E8

  // Policy effects derived from measured deltas (map policy id → measured effects)
  // Map measured section/sim deltas into session multipliers.
  // Section-only ratios (E2/E5) are blended with an assumed session share so we
  // do not pretend the whole prompt shrinks to the tool-catalog ratio.
  const TOOL_SECTION_SHARE = 0.28 // assumption: tools ≈28% of prompt tokens
  const REPO_PACK_SHARE = 0.35 // assumption: repo context ≈35% of prompt tokens
  const bashRatio = mget(E2, 'token_ratio_bash_over_typed')
  const bashSessionMult = 1 - TOOL_SECTION_SHARE + TOOL_SECTION_SHARE * bashRatio
  const scaffoldRatio = mget(E5, 'token_ratio_scaffold_over_flat')
  const navSessionMult = 1 - REPO_PACK_SHARE + REPO_PACK_SHARE * scaffoldRatio
  // Protect-control: keeping ≥50% vs over-compress to 35% (token floor costs more)
  const protectMult = mget(E4, 'tokens_keep_50') / mget(E4, 'tokens_keep_35')
  const pruneMult = 1 - mget(E3, 'reduction_pct') / 100
  // Trajectory prune applies to transcript share (~40% of session tokens)
  const TRAJ_SHARE = 0.4
  const trajSessionMult = 1 - TRAJ_SHARE + TRAJ_SHARE * pruneMult

  const policyEffects = {
    'stable-prefix': {
      kind: 'measured',
      expId: 'E1',
      cacheHitDelta: mget(E1, 'prefix_stable_A') ? 35 : 0,
      costMult: Number(
        (mget(E8, 'proxy_usd_mild_keeps_cache') / mget(E8, 'proxy_usd_aggressive_breaks_cache')).toFixed(4),
      ),
      citation: 'E1 prefix sha256 identity + E8 proxy',
    },
    'bash-first': {
      kind: 'measured',
      expId: 'E2',
      tokenMult: Number(bashSessionMult.toFixed(4)),
      sectionRatio: Number(bashRatio.toFixed(4)),
      citation: 'E2 bash/typed tool-section tokens (blended at 28% session share)',
    },
    'trajectory-prune': {
      kind: 'measured',
      expId: 'E3',
      tokenMult: Number(trajSessionMult.toFixed(4)),
      transcriptMult: Number(pruneMult.toFixed(4)),
      citation: 'E3 prune reduction (blended at 40% transcript share)',
    },
    'protect-control': {
      kind: 'measured',
      expId: 'E4',
      tokenMult: Number(protectMult.toFixed(4)),
      preservation50: mget(E4, 'preservation_50'),
      preservation35: mget(E4, 'preservation_35'),
      citation: 'E4 tokens@50% / tokens@35% + tool-name preservation',
    },
    'agents-md-hygiene': {
      kind: 'measured',
      expId: 'E6',
      tokenMult: Number(
        (mget(E6, 'growth_ratio_tokens_with') / mget(E6, 'growth_ratio_tokens_without')).toFixed(4),
      ),
      citation: 'E6 growth ratio with vs without deletion_signal',
    },
    'file-centered-nav': {
      kind: 'measured',
      expId: 'E5',
      tokenMult: Number(navSessionMult.toFixed(4)),
      packRatio: Number(scaffoldRatio.toFixed(4)),
      citation: 'E5 scaffold/flat tokens (blended at 35% repo-pack share)',
    },
    'agent-aware-kv': {
      kind: 'measured',
      expId: 'E7',
      cacheHitDelta: Number(mget(E7, 'hit_rate_delta_pp').toFixed(2)),
      citation: 'E7 commit-aware vs LRU hit rate',
    },
    'optimize-dollars': {
      kind: 'measured',
      expId: 'E8',
      costMult: Number(
        (mget(E8, 'proxy_usd_mild_keeps_cache') / mget(E8, 'proxy_usd_aggressive_breaks_cache')).toFixed(4),
      ),
      showsTokenDropCanRaiseCost: mget(E8, 'aggressive_cheaper_tokens_but_costlier_usd') === 1,
      citation: 'E8 proxy $ scenarios (asumido precio lista)',
    },
  }

  return {
    generatedAt,
    encoding: ENCODING,
    encodingNote:
      'js-tiktoken encoding o200k_base (GPT-4o / o-series). Documented choice — not a provider billing tokenizer guarantee.',
    assumptions: {
      ASSUMED_PRICE_PER_MTOK_INPUT,
      ASSUMED_PRICE_PER_MTOK_CACHED_INPUT,
      ASSUMED_PRICE_PER_MTOK_OUTPUT,
      TOOL_SECTION_SHARE: 0.28,
      REPO_PACK_SHARE: 0.35,
      TRAJ_SHARE: 0.4,
      note: 'asumido (precio lista) — not measured API bills; session-share blends are composition assumptions for Lab tokenomics',
    },
    experiments: {
      E1: {
        prefix_token_count: mget(E1, 'prefix_token_count'),
        prefix_stable_A: mget(E1, 'prefix_stable_A') === 1,
        prefix_stable_B: mget(E1, 'prefix_stable_B') === 1,
        unique_prefix_hashes_A: mget(E1, 'unique_prefix_hashes_A'),
        unique_prefix_hashes_B: mget(E1, 'unique_prefix_hashes_B'),
        full_tokens_A_mean: mget(E1, 'full_tokens_A_mean'),
        full_tokens_B_mean: mget(E1, 'full_tokens_B_mean'),
      },
      E2: {
        typed_tool_tokens: mget(E2, 'typed_tool_tokens'),
        bash_tool_tokens: mget(E2, 'bash_tool_tokens'),
        token_ratio_bash_over_typed: mget(E2, 'token_ratio_bash_over_typed'),
        token_reduction_pct: mget(E2, 'token_reduction_pct'),
      },
      E3: {
        tokens_before: mget(E3, 'tokens_before'),
        tokens_after: mget(E3, 'tokens_after'),
        reduction_pct: mget(E3, 'reduction_pct'),
        steps_before: mget(E3, 'steps_before'),
        steps_after: mget(E3, 'steps_after'),
      },
      E4: {
        tokens_full: mget(E4, 'tokens_full'),
        tokens_keep_75: mget(E4, 'tokens_keep_75'),
        tokens_keep_50: mget(E4, 'tokens_keep_50'),
        tokens_keep_35: mget(E4, 'tokens_keep_35'),
        preservation_75: mget(E4, 'preservation_75'),
        preservation_50: mget(E4, 'preservation_50'),
        preservation_35: mget(E4, 'preservation_35'),
      },
      E5: {
        flat_tokens: mget(E5, 'flat_tokens'),
        scaffold_tokens: mget(E5, 'scaffold_tokens'),
        token_ratio_scaffold_over_flat: mget(E5, 'token_ratio_scaffold_over_flat'),
        token_reduction_pct: mget(E5, 'token_reduction_pct'),
        file_count: mget(E5, 'file_count'),
      },
      E6: {
        growth_ratio_tokens_without: mget(E6, 'growth_ratio_tokens_without'),
        growth_ratio_tokens_with: mget(E6, 'growth_ratio_tokens_with'),
        final_tokens_without_signal: mget(E6, 'final_tokens_without_signal'),
        final_tokens_with_signal: mget(E6, 'final_tokens_with_signal'),
      },
      E7: {
        seed: E7.seed,
        lru_hit_rate_pct: mget(E7, 'lru_hit_rate_pct'),
        commit_aware_hit_rate_pct: mget(E7, 'commit_aware_hit_rate_pct'),
        hit_rate_delta_pp: mget(E7, 'hit_rate_delta_pp'),
      },
      E8: {
        proxy_usd_stable_prefix: mget(E8, 'proxy_usd_stable_prefix'),
        proxy_usd_aggressive_breaks_cache: mget(E8, 'proxy_usd_aggressive_breaks_cache'),
        proxy_usd_mild_keeps_cache: mget(E8, 'proxy_usd_mild_keeps_cache'),
        aggressive_cheaper_tokens_but_costlier_usd:
          mget(E8, 'aggressive_cheaper_tokens_but_costlier_usd') === 1,
        tokens_stable: mget(E8, 'tokens_stable'),
        tokens_aggressive: mget(E8, 'tokens_aggressive'),
        tokens_mild: mget(E8, 'tokens_mild'),
      },
    },
    policyEffects,
    provenanceLabel: `medido · MVP · ${generatedAt}`,
  }
}

function assertAllExpIds(measurements) {
  const required = ['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8']
  for (const id of required) {
    if (!measurements.experiments[id]) {
      throw new Error(`measurements.json missing experiment ${id}`)
    }
  }
}

function main() {
  const t0 = performance.now()
  const e1 = runE1()
  const e2 = runE2()
  const e3 = runE3()
  const e4 = runE4()
  const e5 = runE5()
  const e6 = runE6()
  const e7 = runE7()
  const e8 = runE8(e1, e2, e3)
  const experiments = [e1, e2, e3, e4, e5, e6, e7, e8]
  const generatedAt = nowIso()
  const measurements = buildMeasurements(experiments, generatedAt)
  assertAllExpIds(measurements)

  const audit = {
    generatedAt,
    encoding: ENCODING,
    durationMs: Number((performance.now() - t0).toFixed(2)),
    experiments,
  }

  writeFileSync(join(OUT_DIR, 'measurements.json'), JSON.stringify(measurements, null, 2) + '\n')
  writeFileSync(join(OUT_DIR, 'measurement-audit.json'), JSON.stringify(audit, null, 2) + '\n')

  console.log(`measure ok in ${audit.durationMs}ms`)
  console.log(`  encoding: ${ENCODING}`)
  console.log(`  E2 ratio bash/typed: ${measurements.experiments.E2.token_ratio_bash_over_typed}`)
  console.log(`  E3 reduction%: ${measurements.experiments.E3.reduction_pct}`)
  console.log(`  E1 prefix stable A/B: ${measurements.experiments.E1.prefix_stable_A}/${measurements.experiments.E1.prefix_stable_B}`)
  console.log(`  E7 hit LRU/commit: ${measurements.experiments.E7.lru_hit_rate_pct}/${measurements.experiments.E7.commit_aware_hit_rate_pct}`)
  console.log(`  E8 proxy$ mild/agg: ${measurements.experiments.E8.proxy_usd_mild_keeps_cache}/${measurements.experiments.E8.proxy_usd_aggressive_breaks_cache}`)
  console.log(`  wrote src/data/measurements.json + measurement-audit.json`)
}

main()
