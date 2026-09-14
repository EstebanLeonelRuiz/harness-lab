# Harness Lab

Lab web **sin backend** sobre economía de agentes, caché KV/prompt, compresión de trayectorias y capa de control (AGENTS.md / CLAUDE.md).

## Producto principal: Integrated Lab

La experiencia primaria es **`/lab`**: una simulación coherente end-to-end de una sesión de coding-agent (etapas **A–J**).

1. El usuario recorre etapas (control → cache → nav → tools → trayectoria → skills → memoria → serving/KV → economía → harness).
2. Activa/desactiva **políticas** (palancas ancladas a papers).
3. Un panel de **tokenomics en vivo** actualiza tokens, $/solve, cache hit y FCR.
4. Al final: tableros **Red / Blue / Green** + comparación baseline vs optimizado + **copiar resumen Markdown**.

Home CTA → Lab primero. `/pipeline`, `/catalog` y `/demos/*` son deep-dives secundarios.

> **Importante:** todas las métricas numéricas de UI están etiquetadas **`ilustrativo · fuente arXiv:ID`**. Se componen desde rangos reportados en papers cuando existen; si el paper solo da guía cualitativa, no se inventa precisión. **No** están medidas sobre tus repositorios.

**Demo live:** https://estebanleonelruiz.github.io/harness-lab/

**Repo:** https://github.com/EstebanLeonelRuiz/harness-lab

## Cómo correr

```bash
cd harness-lab
npm i
npm run dev
```

Build:

```bash
npm run build
npm run preview
```

Stack: **Vite + React + TypeScript (strict) + Tailwind CSS v4** + React Router.  
`base: '/harness-lab/'` + `BrowserRouter` basename. SPA `public/404.html` para GitHub Pages.

## Arquitectura

```
src/
  data/papers.json      # Catálogo DMBOK (fuente de verdad)
  data/labStages.ts     # Etapas A–J + políticas + wiring de paper ids
  lib/costModel.ts      # Modelo de costo ilustrativo (comentado)
  lib/papers.ts         # Helpers + etiqueta de fuente
  pages/Lab.tsx         # Integrated Lab
  pages/Pipeline.tsx    # SDLC → deep-links a /lab#A…J
  pages/Catalog.tsx
  pages/Demos.tsx       # Galería secundaria
  demos/                # Widgets opcionales
  components/lab/       # Tokenomics, PolicyToggle, ScoreBoards, StageRail
```

- UI en **español**; títulos de papers en **inglés**.
- Sin API ni persistencia: todo cliente.

### Rutas

| Ruta | Rol |
|------|-----|
| `/` | Hero; CTA principal → Lab |
| `/lab` | **Integrated Lab** (producto) |
| `/pipeline` | Spec…Ship con links a etapas del Lab |
| `/catalog` | Tabla DMBOK |
| `/demos`, `/demos/:id` | Deep-dives opcionales |

### Etapas del Lab

| ID | Tema | Papers (ejemplos) |
|----|------|-------------------|
| A | Capa de control | CompressAgent, CLAUDE.md, Scanning |
| B | Prompt cache | Don't Break the Cache, TraceLab, CAPC, TokenPilot, ReCache |
| C | Navegación | RepoNav, Cost-Effective Repo Exploration |
| D | Tools | Bash All You Need |
| E | Trayectoria | AgentDiet, AttnCompress, SWE-Pruner(+Pro), ContextPipe, CORVUS, CommitKV |
| F | Skills/routing | TRIAGE, TROVE, Skill Issue, ToFu |
| G | Memoria | MERIT, MemForest, Declarative Attention |
| H | Serving/KV | Continuum, CacheWise/Scout, KVFlow, PBKV, MetaKV, UNISON, Leyline, py-kvcache, KVShareArena, CodeComp |
| I | Economía | Token Reduction≠Cost, Inference Economics, Substrate, Agent ATO, … |
| J | Harness | Harness or Model?, Ecdysis, FlexComp, Rendered Code, ACToR, … |

Cada `id` de `papers.json` aparece ≥1 vez como palanca, métrica, checklist o chip deep-dive (`src/data/labStages.ts`).

## Modelo de costo (ilustrativo)

Documentado en comentarios de `src/lib/costModel.ts`:

- Baseline: sesión “desordenada” (prefijo inestable, tools tipadas, dump plano, LRU, optimizar tokens no $).
- Cada política aplica `tokenMult` / `costMult` / `cacheHitDelta` / `fcrDelta` tomados de rangos de papers cuando hay número; si no, solo nota cualitativa.
- `$` es **sublineal** en tokens (exponente 0.6) + factor por cache hit — alineado a *Token Reduction Is Not Cost Reduction*.

## Schema del catálogo

| Campo | Tipo | Notas |
|-------|------|--------|
| `id` | string | arXiv id |
| `title` | string | Inglés (sincronizado vía API arXiv cuando `verified`) |
| `authors` | string[] | De arXiv si verified |
| `published` | string? | YYYY-MM-DD de arXiv |
| `url` | string | `https://arxiv.org/abs/{id}` |
| `themes` | string[] | cache, compression, harness, serving, memory, economics, navigation, skills, security |
| `firstSeen` | string | YYYY-MM |
| `takeaway` | string | Resumen accionable (no inventar métricas de user-repo) |
| `demoId` | string? | Demo secundaria opcional |
| `verified` | boolean | `true` si metadata confirmada en arXiv API |

## Licencia

Demo educativa; papers pertenecen a sus autores (arXiv).
