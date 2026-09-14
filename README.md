# Harness Lab

Demo web interactiva (sin backend) sobre **economía de agentes**, **caché KV/prompt**, **compresión de trayectorias** y **capa de control** (AGENTS.md).

## Explorar

**Demo live:** https://estebanleonelruiz.github.io/harness-lab/

**Repo:** https://github.com/EstebanLeonelRuiz/harness-lab

> **Importante:** las métricas de las demos son **ejemplo / ilustrativas** tomadas de papers (p. ej. TraceLab ~59% prefijo, Bash All You Need 19–72% menos tokens, ahorros de caché 41–80%). **No** están medidas sobre tus repositorios.

## Cómo correr

```bash
cd /workspace/harness-lab
npm i
npm run dev
```

Build de producción:

```bash
npm run build
npm run preview   # opcional
```

Stack: **Vite + React + TypeScript + Tailwind CSS v4** + React Router.

## Arquitectura

```
src/
  data/papers.json     # Catálogo DMBOK — única fuente de verdad
  lib/papers.ts        # Helpers de catálogo / temas
  lib/demos.ts         # Metadatos de demos
  components/          # Card, StageRail, Metric, PaperChip, Layout
  pages/               # Home, Pipeline, Demos, DemoDetail, Catalog
  demos/               # Widgets interactivos por demoId
```

- UI en **español**; títulos de papers en **inglés**.
- Sin API ni persistencia: todo es cliente.

### Rutas

| Ruta | Descripción |
|------|-------------|
| `/` | Hero + overview del pipeline + CTAs |
| `/pipeline` | Spec → … → Ship con papers y checklists |
| `/demos` | Galería filtrable por tema |
| `/demos/:demoId` | Demo interactiva |
| `/catalog` | Tabla DMBOK searchable/filterable |

## Schema del catálogo (DMBOK)

Cada entrada en `src/data/papers.json`:

| Campo | Tipo | Notas |
|-------|------|--------|
| `id` | string | arXiv id (`2607.12161`) |
| `title` | string | Título en inglés |
| `authors` | string[] | Autores (aprox. si `verified:false`) |
| `url` | string | `https://arxiv.org/abs/{id}` |
| `themes` | string[] | Enum: `cache`, `compression`, `harness`, `serving`, `memory`, `economics`, `navigation`, `skills`, `security` |
| `firstSeen` | string | Mes/fecha de primera aparición en digest |
| `takeaway` | string | Resumen accionable |
| `demoId` | string? | Link a demo interactiva |
| `verified` | boolean | `true` si título confirmado en digest/arXiv |

`verified:false` = título/autores best-effort; conviene contrastar con arXiv.

## Mapa demo ↔ papers

| demoId | Idea | Papers (vía `demoId` en JSON) |
|--------|------|-------------------------------|
| `prompt-cache` | Reordenar bloques; costo con/sin caché | Don't Break the Cache, ReCache, TraceLab, CacheWise, CacheScout, CAPC, … |
| `trajectory-prune` | Slider; warn si control &lt; ~50% | CompressAgent, SWE-Pruner(+Pro), AgentDiet, AttnCompress, ContextPipe, FlexComp |
| `agents-md-hygiene` | Reglas + deletion signal + crecimiento | CLAUDE.md Catastrophic Remembering, Ecdysis |
| `repo-nav` | File-centered vs flat | RepoNav, Cost-Effective Repository Exploration, TROVE, Leyline, MemForest |
| `bash-vs-typed` | Tokens/costo bash vs tipado | Bash All You Need, Skill Issue, Agentic Coding in the Wild |
| `economics` | $/tarea, budgets; tokens≠$ | Token Reduction Is Not Cost Reduction, Inference Economics, How Do AI Agents Spend Your Money, TRIAGE, MERIT, Harness or Model?, … |
| `kv-eviction` | LRU vs agent-aware (bonus) | KVFlow, PBKV, MetaKV, Declarative Attention, CommitKV, KVShareArena, py-kvcache |

## Pipeline (equipos)

- **Red Team:** harness/tools adversariales (inyección, ATO, fuzz).
- **Blue Team:** sandbox, budgets, **never-touch** control layer.
- **Green Team:** métricas PQC — `$/solve`, cache hit, FCR.

## Licencia

Demo educativa local; papers pertenecen a sus autores (arXiv).
