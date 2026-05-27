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

## Base Checklist
Before ANY Red Team pass, Blue Team draft ! contain ALL sections. Missing | placeholder only → auto-reject.

| # | Required Section | Persona | What ! Be Defined |
|---|---|---|---|
| 1 | **System Architecture** | Core Architect | ∀ services, communication, protocol choices |
| 2 | **API Contracts** | Core Architect | ∀ HTTP endpoint: method, path, req/res schema, error codes |
| 3 | **Data Models & Persistence** | Data Specialist | DB choice, schema, relationships, retention/cleanup |
| 4 | **Auth & Authorization** | Security Auditor | Auth mechanism, RBAC model, or explicit "none required" + justification |
| 5 | **LLM/AI Configuration** | AI/MLOps Engineer | Provider, model, token limits, API key strategy, cost guardrails |
| 6 | **Frontend Component Hierarchy** | UX/UI Lead | Named components, state management, layout specs |
| 7 | **Infrastructure & DevOps** | Core Architect | Docker services, networking, env vars table, port mappings, `.dockerignore` rules |
| 8 | **Error Handling & Resilience** | Edge-Case Hunter | Timeout values, retry strategies, fallback behaviors ∀ integration point |
| 9 | **Cross-Section Consistency** | Reconciler | Field names, types, port mappings, env vars ! be identical across ∀ sections |
| 10 | **Visual Design & Styling** | UX/UI Lead | Color palette, typography, spacing, dark/light mode, animation style — ! ref user direction | brand guide. Neither ∃ → ! contain `[USER INPUT REQUIRED]` placeholders triggering escalation |

## Adapter: `client-side-app`
Apply these substitutions to Base Checklist:

| Base Section | Replaced With | What ! Be Defined |
|---|---|---|
| 2. API Contracts | **State Machine & Event Contracts** | ∀ app states, valid transitions, trigger events, payloads |
| 4. Auth | **N/A — Justification Required** | Explicit: "No auth required because [reason]." ⊥ silently omit. |
| 5. LLM/AI | **N/A — Justification Required** | Explicit: "No AI/LLM because [reason]." ⊥ silently omit. |
| 7. Infrastructure | **Build & Deployment Target** | Build tool (Vite, Webpack), output format, deployment target, env vars |

## Adapter: `game`
Apply ALL `client-side-app` substitutions PLUS:

| # | Additional Section | Persona | What ! Be Defined |
|---|---|---|---|
| 11 | **Game Loop Spec** | Core Architect | Tick rate (rAF vs fixed timestep), update/render separation, pause/resume, frame budget |
| 12 | **Level/Config Schema** | Data Specialist | Exact JSON schema ∀ level config: fields, types, valid ranges, complete example |
| 13 | **Scoring & Progression** | Data Specialist | Exact formula with ∀ variables defined, star/rank thresholds as concrete numbers, unlock conditions |
| 14 | **Screen Flow Diagram** | UX/UI Lead | ∀ screens, transitions between them, triggers |
| 15 | **Input & Interaction Contract** | Core Architect | ∀ user input (tap/swipe/click/key), behavior per game state, valid/invalid feedback, debounce/cooldown |

**⛔ GATE:** Blue Team draft missing even ONE required section (after adapter) → Critic Council ! reject entire draft. ⊥ proceed to adversarial pass with incomplete draft.

## Cross-Section Consistency Gate
Before PASS verdict, Reconciler ! execute:
1. **Field Name Consistency:** ∀ field ∈ API/Event Contracts (§2) ! match Data Models (§3) exactly. API says `message` → schema ! say `message`, not `content`.
2. **Port/Build Config Consistency:** ∀ port ∈ Infrastructure (§7) | Build Target ! match System Architecture (§1) & env vars.
3. **Component Existence:** ∀ component ∈ Frontend Hierarchy (§6) ! ∃ ∈ codebase OR marked `[NEW]`.
4. **Schema Boundary:** Spec ! define which data model fields = frontend (public) vs backend-only (private). API response schemas & internal config schemas ⊥ be conflated.
5. **Quantification:** Quantifier ! scan ENTIRE final spec for vague language. "approximately" | "around" | "e.g." | "periodically" | "sometimes" | "fast" | "slow" | "large" | "small" (as parameter values) → ! be replaced with exact values | ranges | formulas. Spec with vague parameters = FAILED spec.
