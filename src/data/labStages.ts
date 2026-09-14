import type { LabStage } from '../types'

/**
 * Integrated Lab stage map (A–J).
 * EVERY id in papers.json appears at least once as: policy lever, metric,
 * checklist item, or deep-dive chip. Keep this file as the wiring source of truth.
 */
export const LAB_STAGES: LabStage[] = [
  {
    id: 'A',
    title: 'Capa de control',
    subtitle: 'Never-touch under compression',
    blurb:
      'Antes de dietar contexto: protegés AGENTS.md / CLAUDE.md, escaneás el harness y fijás un piso de control (~50%).',
    checklist: [
      {
        text: 'Control layer versionada y never-touch para el agente',
        paperIds: ['2608.01056', '2608.11095'],
      },
      {
        text: 'Harness scan limpio antes de abrir tools',
        paperIds: ['2609.07360'],
      },
      {
        text: 'Reglas nuevas con razón + señal de borrado',
        paperIds: ['2608.11095'],
      },
    ],
    policies: [
      {
        id: 'protect-control',
        label: 'Proteger control ≥50%',
        description:
          'CompressAgent: no comprimir instrucciones de control por debajo del umbral crítico.',
        paperIds: ['2608.01056'],
        defaultOn: true,
        effect: {
          kind: 'numeric',
          fcrDelta: 0.08,
          tokenMult: 1.02,
          sourceIds: ['2608.01056'],
        },
      },
      {
        id: 'agents-md-hygiene',
        label: 'Higiene AGENTS.md / CLAUDE.md',
        description:
          'Evitar catastrophic remembering: cada regla con deletion signal.',
        paperIds: ['2608.11095'],
        defaultOn: true,
        effect: {
          kind: 'numeric',
          tokenMult: 0.94,
          fcrDelta: 0.04,
          sourceIds: ['2608.11095'],
        },
      },
      {
        id: 'harness-scan',
        label: 'Scan del harness',
        description: 'Auditar superficie de tools/prompts antes de la sesión.',
        paperIds: ['2609.07360'],
        defaultOn: true,
        effect: {
          kind: 'qualitative',
          note: 'Reduce superficie adversaria; efecto en $ es indirecto.',
          sourceIds: ['2609.07360'],
        },
      },
    ],
    deepDiveIds: ['2608.01056', '2608.11095', '2609.07360'],
    metrics: [
      { label: 'Piso de control', paperIds: ['2608.01056'] },
      { label: 'Reglas con deletion signal', paperIds: ['2608.11095'] },
    ],
  },
  {
    id: 'B',
    title: 'Prompt cache',
    subtitle: 'Prefijos estables · reuse KV',
    blurb:
      'Reordenar o mutar bloques del sistema destroza el hit rate. Prefijos estables + reuso consciente (ReCache, CAPC, TraceLab, TokenPilot).',
    checklist: [
      {
        text: 'Bloques estables al inicio del prompt',
        paperIds: ['2601.06007'],
      },
      {
        text: 'Medir prefijo cacheable (TraceLab ~59% reportado en paper)',
        paperIds: ['2606.30560'],
      },
      {
        text: 'Reuso KV en tool loops (ReCache / CAPC)',
        paperIds: ['2608.19662', '2607.15516'],
      },
    ],
    policies: [
      {
        id: 'stable-prefix',
        label: 'Prefijo estable (no romper caché)',
        description: "Don't Break the Cache: no mutar system/tool schemas mid-session.",
        paperIds: ['2601.06007'],
        defaultOn: true,
        effect: {
          kind: 'numeric',
          cacheHitDelta: 35,
          costMult: 0.72,
          sourceIds: ['2601.06007'],
        },
      },
      {
        id: 'recache',
        label: 'ReCache en tool loops',
        description: 'Reuso/compresión de KV entre turnos con tools.',
        paperIds: ['2608.19662'],
        defaultOn: true,
        effect: {
          kind: 'numeric',
          tokenMult: 0.85,
          cacheHitDelta: 12,
          sourceIds: ['2608.19662'],
        },
      },
      {
        id: 'capc',
        label: 'CAPC (cache-aware prompting)',
        description: 'Estructura de prompts alineada al prefijo cacheable.',
        paperIds: ['2607.15516'],
        defaultOn: false,
        effect: {
          kind: 'numeric',
          cacheHitDelta: 8,
          costMult: 0.93,
          sourceIds: ['2607.15516'],
        },
      },
      {
        id: 'token-pilot',
        label: 'TokenPilot budgeting',
        description: 'Piloto de presupuesto de tokens por etapa.',
        paperIds: ['2606.17016'],
        defaultOn: false,
        effect: {
          kind: 'numeric',
          tokenMult: 0.9,
          sourceIds: ['2606.17016'],
        },
      },
    ],
    deepDiveIds: ['2601.06007', '2606.30560', '2607.15516', '2606.17016', '2608.19662'],
    metrics: [
      { label: 'Cache hit (prefijo)', paperIds: ['2601.06007', '2606.30560'] },
      { label: 'Ahorro tool-loop KV', paperIds: ['2608.19662', '2607.15516'] },
    ],
  },
  {
    id: 'C',
    title: 'Navegación',
    subtitle: 'File-centered > dump plano',
    blurb:
      'RepoNav y exploración cost-effective: árbol + archivos relevantes en vez de snippear todo el repo al contexto.',
    checklist: [
      {
        text: 'Navegación centrada en archivos (RepoNav)',
        paperIds: ['2609.08355'],
      },
      {
        text: 'Exploración con presupuesto de tokens',
        paperIds: ['2608.29675'],
      },
    ],
    policies: [
      {
        id: 'file-centered-nav',
        label: 'Navegación file-centered',
        description: 'RepoNav: índice + open selectivo vs flat dump.',
        paperIds: ['2609.08355', '2608.29675'],
        defaultOn: true,
        effect: {
          kind: 'numeric',
          tokenMult: 0.78,
          fcrDelta: 0.05,
          sourceIds: ['2609.08355', '2608.29675'],
        },
      },
    ],
    deepDiveIds: ['2609.08355', '2608.29675'],
    metrics: [
      { label: 'Tokens de exploración', paperIds: ['2608.29675'] },
      { label: 'Archivos abiertos / solve', paperIds: ['2609.08355'] },
    ],
  },
  {
    id: 'D',
    title: 'Tools',
    subtitle: 'Bash-first cuando alcanza',
    blurb:
      'Bash All You Need: tools tipadas rígidas inflan schemas y tokens; bash + convenciones suele usar 19–72% menos tokens (rango del paper).',
    checklist: [
      {
        text: 'Preferir bash/shell para operaciones estándar',
        paperIds: ['2609.11999'],
      },
      {
        text: 'Schemas tipados solo donde aportan safety real',
        paperIds: ['2609.11999'],
      },
    ],
    policies: [
      {
        id: 'bash-first',
        label: 'Bash-first tools',
        description: 'Reducir superficie tipada; bash para ls/grep/edit patterns.',
        paperIds: ['2609.11999'],
        defaultOn: true,
        effect: {
          kind: 'numeric',
          // Mid of reported 19–72% token reduction range → ~0.55 mult would be aggressive;
          // use conservative mid-low: ~35% cut.
          tokenMult: 0.65,
          costMult: 0.88,
          sourceIds: ['2609.11999'],
        },
      },
    ],
    deepDiveIds: ['2609.11999'],
    metrics: [{ label: 'Tokens tool-schema', paperIds: ['2609.11999'] }],
  },
  {
    id: 'E',
    title: 'Trayectoria',
    subtitle: 'Prune · diet · attention',
    blurb:
      'AgentDiet, SWE-Pruner(+Pro), AttnCompress, ContextPipe, CORVUS, CommitKV: sacar turns de bajo valor sin tocar el control.',
    checklist: [
      {
        text: 'Prune de turns low-value (SWE-Pruner / Pro)',
        paperIds: ['2601.16746', '2607.18213'],
      },
      {
        text: 'Dieta de contexto con control protegido (AgentDiet)',
        paperIds: ['2509.23586'],
      },
      {
        text: 'Pipeline de contexto (ContextPipe) + runtime (CORVUS)',
        paperIds: ['2609.00749', '2607.22711'],
      },
    ],
    policies: [
      {
        id: 'trajectory-prune',
        label: 'Trajectory prune (SWE-Pruner)',
        description: 'Drop tool turns de bajo valor; Pro refina heurística.',
        paperIds: ['2601.16746', '2607.18213'],
        defaultOn: true,
        effect: {
          kind: 'numeric',
          tokenMult: 0.82,
          sourceIds: ['2601.16746', '2607.18213'],
        },
      },
      {
        id: 'agent-diet',
        label: 'AgentDiet selectivo',
        description: 'Truncation selectiva preservando control.',
        paperIds: ['2509.23586'],
        defaultOn: true,
        effect: {
          kind: 'numeric',
          tokenMult: 0.88,
          sourceIds: ['2509.23586'],
        },
      },
      {
        id: 'attn-compress',
        label: 'AttnCompress',
        description: 'Compresión guiada por atención en trayectoria larga.',
        paperIds: ['2609.08318'],
        defaultOn: false,
        effect: {
          kind: 'numeric',
          tokenMult: 0.9,
          latencyMult: 0.95,
          sourceIds: ['2609.08318'],
        },
      },
      {
        id: 'context-pipe',
        label: 'ContextPipe + CommitKV',
        description: 'Canalizar contexto y commitear KV de hitos.',
        paperIds: ['2609.00749', '2608.07855'],
        defaultOn: false,
        effect: {
          kind: 'numeric',
          cacheHitDelta: 6,
          tokenMult: 0.95,
          sourceIds: ['2609.00749', '2608.07855'],
        },
      },
    ],
    deepDiveIds: [
      '2509.23586',
      '2609.08318',
      '2601.16746',
      '2607.18213',
      '2609.00749',
      '2607.22711',
      '2608.07855',
    ],
    metrics: [
      { label: 'Turns retenidos', paperIds: ['2601.16746'] },
      { label: 'Control bajo dieta', paperIds: ['2509.23586', '2608.01056'] },
    ],
  },
  {
    id: 'F',
    title: 'Skills / routing',
    subtitle: 'TRIAGE · TROVE · Skill Issue · ToFu',
    blurb:
      'Enrutar al skill correcto, descubrir skills (TROVE), evitar skill bloat (Skill Issue), y fuzz de tools (ToFu).',
    checklist: [
      {
        text: 'TRIAGE: enrutar tareas a skills/budgets',
        paperIds: ['2609.01428'],
      },
      {
        text: 'Catálogo TROVE; no cargar todos los skills',
        paperIds: ['2609.05019', '2609.12742'],
      },
      {
        text: 'Fuzz adversarial de tool args (ToFu)',
        paperIds: ['2607.11423'],
      },
    ],
    policies: [
      {
        id: 'triage-routing',
        label: 'TRIAGE routing',
        description: 'Clasificar y asignar budget/skill antes de ejecutar.',
        paperIds: ['2609.01428'],
        defaultOn: true,
        effect: {
          kind: 'numeric',
          costMult: 0.9,
          fcrDelta: 0.03,
          sourceIds: ['2609.01428'],
        },
      },
      {
        id: 'skill-slim',
        label: 'Skills slim (anti-bloat)',
        description: 'Skill Issue: menos skills cargados = menos tokens de schema.',
        paperIds: ['2609.12742', '2609.05019'],
        defaultOn: true,
        effect: {
          kind: 'numeric',
          tokenMult: 0.92,
          sourceIds: ['2609.12742', '2609.05019'],
        },
      },
      {
        id: 'tofu-fuzz',
        label: 'ToFu fuzz (red)',
        description: 'Fuzz de argumentos de tools en pre-ship.',
        paperIds: ['2607.11423'],
        defaultOn: false,
        effect: {
          kind: 'qualitative',
          note: 'Mejora robustez; costo de sesión de fuzz aparte del $/solve.',
          sourceIds: ['2607.11423'],
        },
      },
    ],
    deepDiveIds: ['2609.01428', '2609.05019', '2609.12742', '2607.11423'],
    metrics: [
      { label: 'Skills cargados', paperIds: ['2609.12742'] },
      { label: 'Hit rate de routing', paperIds: ['2609.01428'] },
    ],
  },
  {
    id: 'G',
    title: 'Memoria',
    subtitle: 'MERIT · MemForest · Declarative Attention',
    blurb:
      'Memoria durable con presupuesto (MERIT), estructuras de recuerdo (MemForest), y atención declarativa sobre qué retener.',
    checklist: [
      {
        text: 'Presupuesto de memoria cross-session (MERIT)',
        paperIds: ['2609.05441'],
      },
      {
        text: 'Índice MemForest para recall selectivo',
        paperIds: ['2609.08273'],
      },
      {
        text: 'Política declarativa de atención/retención',
        paperIds: ['2609.02737'],
      },
    ],
    policies: [
      {
        id: 'merit-budget',
        label: 'MERIT memory budget',
        description: 'Techo de memoria persistente; decay de entradas frías.',
        paperIds: ['2609.05441'],
        defaultOn: true,
        effect: {
          kind: 'numeric',
          tokenMult: 0.96,
          fcrDelta: 0.04,
          sourceIds: ['2609.05441'],
        },
      },
      {
        id: 'memforest',
        label: 'MemForest retrieval',
        description: 'Recall por árbol en vez de dump de historial.',
        paperIds: ['2609.08273'],
        defaultOn: false,
        effect: {
          kind: 'numeric',
          tokenMult: 0.93,
          sourceIds: ['2609.08273'],
        },
      },
      {
        id: 'decl-attn',
        label: 'Declarative Attention',
        description: 'Declarar qué tokens/bloques merecen retención en KV.',
        paperIds: ['2609.02737'],
        defaultOn: false,
        effect: {
          kind: 'numeric',
          cacheHitDelta: 5,
          sourceIds: ['2609.02737'],
        },
      },
    ],
    deepDiveIds: ['2609.05441', '2609.08273', '2609.02737'],
    metrics: [
      { label: 'Memoria activa (tok)', paperIds: ['2609.05441'] },
      { label: 'Recall hit', paperIds: ['2609.08273'] },
    ],
  },
  {
    id: 'H',
    title: 'Serving / KV',
    subtitle: 'Eviction agent-aware · share · scout',
    blurb:
      'Continuum, CacheWise/Scout, KVFlow, PBKV, MetaKV, UNISON, Leyline, py-kvcache, KVShareArena, CodeComp: el serving decide si el ahorrado en prompt se traduce a $.',
    checklist: [
      {
        text: 'Eviction agent-aware (KVFlow / PBKV / MetaKV)',
        paperIds: ['2507.07400', '2605.06472', '2609.07966'],
      },
      {
        text: 'Observabilidad de caché (CacheWise / CacheScout)',
        paperIds: ['2606.16824', '2608.14624'],
      },
      {
        text: 'Share/arena + backends (KVShareArena, py-kvcache, Leyline)',
        paperIds: ['2609.10266', '2609.11744', '2606.01065'],
      },
    ],
    policies: [
      {
        id: 'agent-aware-kv',
        label: 'KV eviction agent-aware',
        description: 'KVFlow/PBKV/MetaKV vs LRU ciego.',
        paperIds: ['2507.07400', '2605.06472', '2609.07966'],
        defaultOn: true,
        effect: {
          kind: 'numeric',
          cacheHitDelta: 10,
          latencyMult: 0.92,
          costMult: 0.94,
          sourceIds: ['2507.07400', '2605.06472', '2609.07966'],
        },
      },
      {
        id: 'cache-observe',
        label: 'CacheWise + CacheScout',
        description: 'Telemetría de hits/misses para no optimizar a ciegas.',
        paperIds: ['2606.16824', '2608.14624'],
        defaultOn: true,
        effect: {
          kind: 'qualitative',
          note: 'Habilita medición; sin número inventado de $.',
          sourceIds: ['2606.16824', '2608.14624'],
        },
      },
      {
        id: 'kv-share',
        label: 'KV share / Continuum',
        description: 'Reuso cross-request (KVShareArena, Continuum, UNISON).',
        paperIds: ['2609.10266', '2511.02230', '2609.09643'],
        defaultOn: false,
        effect: {
          kind: 'numeric',
          cacheHitDelta: 7,
          costMult: 0.95,
          sourceIds: ['2609.10266', '2511.02230', '2609.09643'],
        },
      },
      {
        id: 'codecomp-serving',
        label: 'CodeComp + Leyline path',
        description: 'Compresión/serving paths para código (CodeComp, Leyline, py-kvcache).',
        paperIds: ['2604.10235', '2606.01065', '2609.11744'],
        defaultOn: false,
        effect: {
          kind: 'numeric',
          tokenMult: 0.97,
          latencyMult: 0.96,
          sourceIds: ['2604.10235', '2606.01065', '2609.11744'],
        },
      },
    ],
    deepDiveIds: [
      '2511.02230',
      '2606.16824',
      '2608.14624',
      '2507.07400',
      '2605.06472',
      '2609.07966',
      '2609.09643',
      '2606.01065',
      '2609.11744',
      '2609.10266',
      '2604.10235',
    ],
    metrics: [
      { label: 'KV hit rate', paperIds: ['2507.07400', '2606.16824'] },
      { label: 'p95 latency', paperIds: ['2609.07966'] },
    ],
  },
  {
    id: 'I',
    title: 'Economía',
    subtitle: 'Tokens ≠ dólares',
    blurb:
      'Token Reduction Is Not Cost Reduction, Inference Economics, How Do AI Agents Spend Your Money, Substrate, Speculative Uncertainty, RLM-Cascade, Agent ATO timelines, Can your AI agent be cheaper, Beyond Code Generation.',
    checklist: [
      {
        text: 'Optimizar $/solve, no vanity token count',
        paperIds: ['2607.12161', '2607.13080'],
      },
      {
        text: 'Budgets hard + visibilidad de spend',
        paperIds: ['2604.22750', '2608.25399'],
      },
      {
        text: 'Substrate-aware + incertidumbre especulativa + timelines ATO',
        paperIds: ['2609.05232', '2609.05274', '2609.08301'],
      },
    ],
    policies: [
      {
        id: 'optimize-dollars',
        label: 'Optimizar $ (no solo tokens)',
        description: 'Token cut ≠ cost cut; alinear a precio de caché/serving.',
        paperIds: ['2607.12161', '2607.13080'],
        defaultOn: true,
        effect: {
          kind: 'numeric',
          costMult: 0.85,
          sourceIds: ['2607.12161', '2607.13080'],
        },
      },
      {
        id: 'hard-budget',
        label: 'Budget hard-fail',
        description: 'Techos de $ y turns; fail visible (How Do AI Agents Spend Your Money).',
        paperIds: ['2604.22750', '2608.25399', '2609.04681'],
        defaultOn: true,
        effect: {
          kind: 'numeric',
          costMult: 0.92,
          fcrDelta: -0.02,
          sourceIds: ['2604.22750', '2608.25399', '2609.04681'],
        },
      },
      {
        id: 'cascade-spec',
        label: 'RLM-Cascade + speculative',
        description: 'Cascadas baratas + speculative uncertainty para early-exit.',
        paperIds: ['2606.22840', '2609.05274', '2609.05232'],
        defaultOn: false,
        effect: {
          kind: 'numeric',
          costMult: 0.88,
          latencyMult: 0.9,
          sourceIds: ['2606.22840', '2609.05274', '2609.05232'],
        },
      },
      {
        id: 'ato-timeline',
        label: 'Agent ATO timelines',
        description: 'Visualizar timelines de interacción desde logs para debug de spend y fallos.',
        paperIds: ['2609.08301'],
        defaultOn: true,
        effect: {
          kind: 'qualitative',
          note: 'Observabilidad de trayectoria; habilita Green Team sin inventar $.',
          sourceIds: ['2609.08301'],
        },
      },
    ],
    deepDiveIds: [
      '2607.12161',
      '2604.22750',
      '2607.13080',
      '2609.04681',
      '2609.05232',
      '2609.05274',
      '2606.22840',
      '2609.08301',
      '2608.25399',
    ],
    metrics: [
      { label: '$/solve', paperIds: ['2607.12161', '2607.13080'] },
      { label: 'Spend visibility', paperIds: ['2604.22750'] },
    ],
  },
  {
    id: 'J',
    title: 'Harness',
    subtitle: 'Plataforma · wild · beyond prompts',
    blurb:
      'Harness or Model?, Ecdysis, FlexComp, Rendered Code, ACToR, RefactorPlatform, Beyond Prompts, Agentic Coding in the Wild, Paritok: el producto es el harness, no solo el modelo.',
    checklist: [
      {
        text: 'Medir harness vs model ablations',
        paperIds: ['2609.11987'],
      },
      {
        text: 'Mudar reglas (Ecdysis) y FlexComp en contexto',
        paperIds: ['2609.11677', '2609.11192'],
      },
      {
        text: 'Rendered Code / ACToR / RefactorPlatform en el loop',
        paperIds: ['2608.09268', '2609.01601', '2609.04898'],
      },
    ],
    policies: [
      {
        id: 'harness-over-model',
        label: 'Invertir en harness (vs solo modelo)',
        description: 'Harness or Model?: gains de plataforma antes de upsize.',
        paperIds: ['2609.11987', '2609.05736'],
        defaultOn: true,
        effect: {
          kind: 'numeric',
          fcrDelta: 0.06,
          costMult: 0.95,
          sourceIds: ['2609.11987', '2609.05736'],
        },
      },
      {
        id: 'ecdysis-flex',
        label: 'Ecdysis + FlexComp',
        description: 'Mudar reglas obsoletas; compresión flexible del harness.',
        paperIds: ['2609.11677', '2609.11192'],
        defaultOn: true,
        effect: {
          kind: 'numeric',
          tokenMult: 0.94,
          sourceIds: ['2609.11677', '2609.11192'],
        },
      },
      {
        id: 'rendered-actor',
        label: 'Rendered Code + ACToR',
        description: 'Representaciones renderizadas y actor loop estructurado.',
        paperIds: ['2608.09268', '2609.01601', '2609.04898'],
        defaultOn: false,
        effect: {
          kind: 'numeric',
          fcrDelta: 0.03,
          tokenMult: 0.97,
          sourceIds: ['2608.09268', '2609.01601', '2609.04898'],
        },
      },
      {
        id: 'wild-paritok',
        label: 'Wild practices + Paritok',
        description: 'Lecciones de Agentic Coding in the Wild; Paritok-style budgeting.',
        paperIds: ['2608.00101', '2608.24188'],
        defaultOn: false,
        effect: {
          kind: 'numeric',
          costMult: 0.96,
          sourceIds: ['2608.00101', '2608.24188'],
        },
      },
    ],
    deepDiveIds: [
      '2609.11987',
      '2609.11677',
      '2609.11192',
      '2608.09268',
      '2609.01601',
      '2609.04898',
      '2609.05736',
      '2608.00101',
      '2608.24188',
    ],
    metrics: [
      { label: 'Harness gain vs model', paperIds: ['2609.11987'] },
      { label: 'Reglas mudadas', paperIds: ['2609.11677'] },
    ],
  },
]

export const LAB_STAGE_IDS = LAB_STAGES.map((s) => s.id)

export function labStageById(id: string): LabStage | undefined {
  return LAB_STAGES.find((s) => s.id === id)
}

/** All paper ids referenced anywhere in the lab config. */
export function allLabPaperIds(): string[] {
  const set = new Set<string>()
  for (const s of LAB_STAGES) {
    for (const p of s.policies) for (const id of p.paperIds) set.add(id)
    for (const c of s.checklist) for (const id of c.paperIds) set.add(id)
    for (const id of s.deepDiveIds) set.add(id)
    for (const m of s.metrics) for (const id of m.paperIds) set.add(id)
    for (const p of s.policies) {
      if (p.effect.kind === 'numeric' || p.effect.kind === 'qualitative') {
        for (const id of p.effect.sourceIds) set.add(id)
      }
    }
  }
  return [...set]
}
