# Mandatory Completeness Checklist

<!-- CAVEMAN-ENCODED. DECODER: ! = must/required | ⊥ = forbidden/never | → = leads to/becomes | ∀ = for all | ∃ = exists | & = and | | = or -->

## Project Type Classification (Step 0c)
Classify project before applying checklist:

| Project Type | How to Identify | Checklist Variant |
|---|---|---|
| `backend-service` | API-only, no frontend, server-side logic | Base Checklist as-is |
| `fullstack-app` | Backend + frontend, database, possibly auth | Base Checklist as-is |
| `client-side-app` | Browser-only, no server, no database | Client-Side Adapter |
| `game` | Interactive game loop, levels, scoring | Game Adapter (extends Client-Side) |

Unclear type → default `fullstack-app` (most comprehensive).

## Base Checklist (Machine Contract Standard)
Before ANY Red Team pass, Blue Team draft ! produce `specs/SPEC.md` AND formal artifacts in `specs/contracts/`. Missing | placeholder only → auto-reject.

| # | Required Section | Persona | What ! Be Defined & Generated | Required Machine Artifact |
|---|---|---|---|---|
| 1 | **System Architecture** | Core Architect | ∀ services, communication protocols, network boundaries, deployment topology | Diagram + port allocation table |
| 2 | **API & Wire Contracts** | Core Architect | Strict types, paths, status codes, query params, headers, pagination, error schemas. Ref `../_config/references/systems-standards.md` | `specs/contracts/openapi.yaml` (or `.proto`) |
| 2b | **State Machine & Events** | Core Architect | Finite state machine transitions for all lifecycle entities: state, trigger, guard, target, action, rollback policy | `specs/contracts/statecharts.json` |
| 3 | **Data Models & Persistence** | Data Specialist | Pinned DB engine, exact column types, primary keys (UUIDv7 vs autoincrement pinned), foreign keys, nullability, unique indices, ON DELETE rules, retention/purging window | `specs/contracts/schema.sql` (or `.prisma`) |
| 4 | **Auth & Authorization** | Security Auditor | Auth mechanism (JWT/Session/API key), token TTL, header name, RBAC permission matrix (role $\times$ resource $\to$ allow/deny), or explicit "none" + justification | Security contract in `openapi.yaml` |
| 5 | **LLM/AI Configuration** | AI/MLOps Engineer | Provider, model, temperature, token limits, system prompt location, fallback models, cost guardrails | Config schema in `SPEC.md` |
| 6 | **Frontend Component Hierarchy** | UX/UI Lead | Named components, state management, layout specs. Ref `specs/DESIGN.md` tokens | Component hierarchy in `SPEC.md` |
| 7 | **Infrastructure & DevOps** | Core Architect | Docker Compose services, env vars table (key, required, format, default), port mappings, volume mounts, `.dockerignore` rules | `docker-compose.yml` draft |
| 8 | **Systems Resilience & Errors** | Edge-Case Hunter | Idempotency keys, OCC versioning (`version INT`), tie-breaker pagination (`(sort_col, id)`), retry curves, timeout budgets. Ref `../_config/references/systems-standards.md` | `specs/contracts/errors.json` |
| 9 | **Cross-Section Consistency** | Reconciler | Field names, types, port mappings, env vars ! be identical across `SPEC.md` and ∀ files in `specs/contracts/` | Zero drift report |
| 10 | **Visual Design & Styling** | UX/UI Lead | Color palette, typography, spacing, dark/light mode, animation style — ! ref user direction | brand guide. Ref `specs/DESIGN.md` | `specs/DESIGN.md` |

## Adapter: `client-side-app`
Apply these substitutions to Base Checklist:

| Base Section | Replaced With | What ! Be Defined | Required Machine Artifact |
|---|---|---|---|
| 2. API Contracts | **State Machine & Event Contracts** | ∀ app states, valid transitions, trigger events, payloads | `specs/contracts/statecharts.json` |
| 3. Data Models | **Client Storage & Schema** | LocalStorage/IndexedDB/state store schemas with types | `specs/contracts/types.ts` |
| 4. Auth | **N/A — Justification Required** | Explicit: "No auth required because [reason]." ⊥ silently omit. | N/A |
| 5. LLM/AI | **N/A — Justification Required** | Explicit: "No AI/LLM because [reason]." ⊥ silently omit. | N/A |
| 7. Infrastructure | **Build & Deployment Target** | Build tool (Vite, Webpack), output format, deployment target, env vars | `package.json` config |
| 8. Resilience | **Client Error Handling & Recovery** | Network offline handling, validation errors, error boundaries | `specs/contracts/errors.json` |

## Adapter: `game`
Apply ALL `client-side-app` substitutions PLUS:

| # | Additional Section | Persona | What ! Be Defined | Required Machine Artifact |
|---|---|---|---|---|
| 11 | **Game Loop Spec** | Core Architect | Tick rate (rAF vs fixed timestep), update/render separation, pause/resume, frame budget | Game loop contract |
| 12 | **Level/Config Schema** | Data Specialist | Exact JSON schema ∀ level config: fields, types, valid ranges, complete example | `specs/contracts/levels.schema.json` |
| 13 | **Scoring & Progression** | Data Specialist | Exact formula with ∀ variables defined, star/rank thresholds as concrete numbers, unlock conditions | Scoring contract |
| 14 | **Screen Flow Diagram** | UX/UI Lead | ∀ screens, transitions between them, triggers | State diagram |
| 15 | **Input & Interaction Contract** | Core Architect | ∀ user input (tap/swipe/click/key), behavior per game state, valid/invalid feedback, debounce/cooldown | Input contract |

**⛔ GATE:** Blue Team draft missing even ONE required section or machine contract artifact → Critic Council ! reject entire draft. ⊥ proceed to adversarial pass with incomplete draft.

---

## Machine Contract Linting & Consistency Gate
Before PASS verdict, Reconciler & Critic Council ! execute:
1. **Machine Artifact Existence:** `specs/contracts/` contains valid `openapi.yaml`, `schema.sql`, `statecharts.json`, and `errors.json`.
2. **Field Name & Type Symmetry:** ∀ field in `openapi.yaml` ! match `schema.sql` and `SPEC.md` exactly. (e.g. `user_id` vs `userId` = FAIL).
3. **Systems Invariants Audit:** Check compliance with `../_config/references/systems-standards.md`:
   - State-mutating endpoints have `Idempotency-Key` declared.
   - Mutable tables have `version INT NOT NULL DEFAULT 1` for OCC.
   - List endpoints have cursor pagination and deterministic tie-breaker sorting.
   - Error responses conform to `errors.json` schema.
4. **Quantification Rule:** Quantifier ! scan ENTIRE spec and contracts for vague language. "approximately" | "around" | "e.g." | "periodically" | "sometimes" | "fast" | "slow" | "large" | "small" (as parameter values) → ! be replaced with exact values | ranges | formulas. Spec with vague parameters = FAILED spec.
