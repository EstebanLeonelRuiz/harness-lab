# Harness Lab

Lab web **sin backend** sobre economía de agentes, caché KV/prompt, compresión de trayectorias y capa de control (AGENTS.md / CLAUDE.md).

## Producto principal: Integrated Lab

La experiencia primaria es **`/lab`**: una simulación coherente end-to-end de una sesión de coding-agent (etapas **A–J**).

1. El usuario recorre etapas (control → cache → nav → tools → trayectoria → skills → memoria → serving/KV → economía → harness).
2. Activa/desactiva **políticas** (palancas ancladas a papers + mediciones MVP).
3. Un panel de **tokenomics en vivo** actualiza tokens, $/solve, cache hit y FCR.
4. Al final: tableros **Red / Blue / Green** + comparación baseline vs optimizado + **copiar resumen Markdown**.

Home CTA → Lab primero. **`/audit`** lista experiments E1–E8. `/pipeline`, `/catalog` y `/demos/*` son deep-dives secundarios.

**Demo live:** https://estebanleonelruiz.github.io/harness-lab/

**Repo:** https://github.com/EstebanLeonelRuiz/harness-lab

---

## Cómo medimos (MVP real vs precio asumido)

No hay API keys de Anthropic/OpenAI/xAI en esta máquina. **No fingimos facturación**. Medimos lo que se puede medir en local:

| Qué | Cómo | Etiqueta UI |
|-----|------|-------------|
| Tokens | `js-tiktoken`, encoding **`o200k_base`** | **medido (MVP)** |
| Identidad de prefijo | sha256 UTF-8 del prefijo estable | **medido (MVP)** |
| Transforms | wall-clock ms (secundario) | **medido (MVP)** |
| Scores estructurales | p.ej. % nombres de tools preservados | **medido (MVP)** |
| Cache hit simulado | traza de acceso con RNG **Mulberry32(seed=42)** | **medido (MVP)** |
| Proxy $ | precios lista **asumidos** (`ASSUMED_PRICE_PER_MTOK_*` en audit) | **asumido (precio lista)** |
| Papers sin experimento local | notas / FCR residuales | **cualitativo** |

### Reproducir

```bash
npm run measure   # escribe src/data/measurements.json + measurement-audit.json (<30s)
npm run build     # prebuild corre measure automáticamente
```

Experiments:

| ID | Tema | Fixture |
|----|------|---------|
| E1 | prefix-cache | `fixtures/e1/` |
| E2 | bash-vs-typed | `fixtures/e2/` |
| E3 | trajectory-prune | `fixtures/e3/` |
| E4 | control-compression | `fixtures/e4/` |
| E5 | repo-nav | `fixtures/e5/` |
| E6 | agents-md-growth | `fixtures/e6/` |
| E7 | kv-access-sim (seed 42) | `fixtures/e7/` |
| E8 | economics-identity (proxy $) | derivado de E1–E3 |

Auditoría humana: **`/audit`**.

---

## Cómo correr

```bash
cd harness-lab
npm i
npm run measure
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
fixtures/               # Inputs reproducibles E1–E7
scripts/measure.mjs     # Runner MVP → measurements*.json
src/
  data/papers.json
  data/labStages.ts
  data/measurements.json
  data/measurement-audit.json
  lib/costModel.ts      # Prefiere deltas medidos (policyEffects)
  pages/Lab.tsx
  pages/Audit.tsx
  ...
```

### Rutas

| Ruta | Rol |
|------|-----|
| `/` | Hero; CTA → Lab + Audit |
| `/lab` | **Integrated Lab** |
| `/audit` | Experiments E1–E8 (método, limitaciones, raw) |
| `/pipeline` | Spec…Ship → /lab#A…J |
| `/catalog` | Tabla DMBOK |
| `/demos`, `/demos/:id` | Deep-dives opcionales |

## Licencia

Demo educativa; papers pertenecen a sus autores (arXiv).
