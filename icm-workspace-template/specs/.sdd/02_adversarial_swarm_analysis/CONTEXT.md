<!-- CAVEMAN-ENCODED: compressed ~60% vs prose. Decoder key below. -->
<!-- DECODER: ! = must/required | ⊥ = forbidden/never | → = leads to/becomes | ∀ = for all | ∃ = exists | § = section ref | & = and | | = or -->
<!-- PRESERVE VERBATIM: code blocks, paths, URLs, file names, identifiers, JSON/YAML -->

# Stage 02: Adversarial Swarm Analysis (SDD)

Strict SDD workflow. Multi-agent adversarial review → bulletproof Technical Specification Document.

**⊥ implementation code while stage active. Output = architectural design & spec contract only.**

**! execute attack-and-refine loop iteratively until Red Team finds zero new attacks.**

## Inputs
- Layer 4 (working): `specs/SPEC.md`
- Layer 3 (reference): `../_config/references/completeness-checklist.md`
- Layer 3 (reference): `../_config/iteration-log-format.md`

## Process

### Creator Swarm (Blue Team)
Draft/revise spec using these personas:
1. **Core Architect:** System boundaries, protocols, API contracts (headers, payloads, error codes)
2. **Security Auditor:** Zero-Trust boundaries, RBAC requirements, encryption standards
3. **AI/MLOps Engineer:** VRAM budget, embedding strategies, prompt limits
4. **Data Specialist:** DB schema relationships, transaction consistency rules
5. **UX/UI Lead:** State management requirements, component hierarchy. **Design Escalation:** ⊥ assume visual design decisions user hasn't provided. No brand guide | style reference → ! prompt user to return to Stage 01. Exception: existing `DESIGN.md` ∈ `specs/` → use as source of truth.
6. **Technical Writer:** Synthesize creators' input → structured, unambiguous Specification Document

### Critic Council (Red Team)
Attack spec contract, not code syntax:
1. **Edge-Case Hunter:** "API timeout? Spec missing fallback behavior. Reject."
2. **Chaos Engineer:** "Spec assumes ordered message queue. Split-brain scenario undefined. Reject."
3. **Resource Starver:** "DB schema unbounded growth. Missing pagination constraints. Reject."
4. **DX Auditor:** "API contract ambiguous. ID type unclear (string | UUID?). Reject."
5. **Reconciler:** Cross-ref spec vs actual codebase & running infrastructure. <anti_hallucination>⊥ assume spec correct. ! inspect source files (schemas, docker-compose, route handlers, components) & flag ANY spec-vs-reality discrepancy.</anti_hallucination>
6. **Quantifier:** Attack vague/unquantified spec language. Parameter COULD be number/formula/range but ISN'T → reject. Mandate: **∀ parameter ∈ final spec ! be exact value | bounded range | formula | config file ref with defined schema.**

### Anti-Simulation Enforcement

#### Project Type Classification & Completeness Checklist (Step 0c)
Before Blue Team draft, classify project type & apply corresponding checklist. Read full checklist, adapters, & consistency gate: `../_config/references/completeness-checklist.md`

**⛔ GATE:** Blue Team draft missing even ONE required section (after adapter) → Critic Council ! reject entire draft. ⊥ proceed to adversarial pass with incomplete draft.

#### Mandatory Visible Iteration Logs
⊥ claim "internally looped." ∀ iteration ! be **printed to user** using Adversarial Swarm Iteration Log format ∈ `../_config/iteration-log-format.md`.

**⛔ GATE:** Missing | summarized iteration log → entire swarm run invalid.

#### Minimum Iteration Count
- **≥ 3 documented iterations** before PASS allowed
- Iteration 1 = ALWAYS FAIL (initial draft always has gaps)
- Red Team PASS on iteration 1 | 2 → override, ! attack harder. Premature PASS = lazy analysis, not perfect spec.

### Iterative Workflow
Execute this exact loop:

0. **Pre-Flight Context Map:** Identify ∀ frameworks/versions ∈ target architecture.
0b. **Pre-Flight Codebase Grounding (∃ existing spec):** If `specs/SPEC.md` already exists, Reconciler ! read BEFORE Blue Team drafts.
0c. **Project Type Classification:** Classify project. Determines Completeness Checklist variant. Log classification ∈ first iteration log.
1. **Generation Pass:** Creator Swarm → complete spec draft. **! pass Completeness Checklist before proceeding.** Fail → loop back & fill gaps before Red Team pass.
2. **Adversarial Pass:** Critic Council attacks draft. ∀ finding ! be printed ∈ Iteration Log format.
3. **Resolution:** Creators modify spec to resolve attacks. **ESCALATION:** Resolving attack requires business assumption | guessing user intent → Creators ⊥ guess. ! PAUSE swarm, prompt user for explicit direction.
4. **Loop:** ! recursively repeat Steps 1-3 until Critics → "PASS" with ZERO new findings. ⊥ stop after single pass. **≥ 3 documented iterations required.**
5. **Commit & Save:** Output finalized spec. ! save to `specs/SPEC.md`. ⊥ write implementation code.
6. **Handoff:** Present spec to user. Prompt user to proceed to `04_writing_implementation_phases` (or `03_interactive_wireframing` if UI project).
7. **Report:** Output Swarm Log. Format: `| Spec Section | Attacking Persona | Ambiguity/Flaw Found | Blue Team Resolution |`.

## Outputs
- `specs/SPEC.md` (Hardened)
