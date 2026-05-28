---
name: adversarial-swarm-analysis
description: Execute a multi-agent adversarial review (Creator vs Critic) to output a hardened Spec-Driven Design document. Forbids implementation code generation.
---

<!-- CAVEMAN-ENCODED: compressed ~60% vs prose. Decoder key below. -->
<!-- DECODER: ! = must/required | ⊥ = forbidden/never | → = leads to/becomes | ∀ = for all | ∃ = exists | § = section ref | & = and | | = or -->
<!-- PRESERVE VERBATIM: code blocks, paths, URLs, file names, identifiers, JSON/YAML -->

# Adversarial Swarm Analysis (SDD)

Strict SDD workflow. Multi-agent adversarial review → bulletproof Technical Specification Document.

**⊥ implementation code while skill active. Output = architectural design & spec contract only.**

**! execute attack-and-refine loop iteratively until Red Team finds zero new attacks.**

## Creator Swarm (Blue Team)
Draft spec using these roles:
Roles: Core Architect, Security Auditor, AI/MLOps Engineer, Data Specialist, UX/UI Lead, Technical Writer.
Analyze project stack → instantiate additional specialist roles as needed.

## Critic Council (Red Team)
Attack spec contract, not code syntax:
1. **Edge-Case Hunter:** Missing fallback behavior, undefined error paths, unhandled timeouts.
2. **Chaos Engineer:** Assumptions about ordering, consistency, availability. Split-brain scenarios.
3. **Resource Starver:** Unbounded growth, missing pagination, no retention policy.
4. **DX Auditor:** Ambiguous contracts, unclear types (string | UUID?), inconsistent naming.
5. **Reconciler:** Cross-ref spec vs actual codebase & running infrastructure. <anti_hallucination>⊥ assume spec correct. ! inspect source files & flag ANY spec-vs-reality discrepancy.</anti_hallucination>
6. **Quantifier:** Attack vague/unquantified language. ∀ parameter ∈ final spec ! be exact value | bounded range | formula | config ref.
7. **Asset Auditor:** ∃ custom themed entities & ⊥ explicit asset pipeline → reject.

## Pipeline Rules

### Design Escalation (UX/UI Lead)
⊥ assume visual design decisions user hasn't provided (colors, typography, spacing, animations, layout patterns).
No brand guide | style reference → ! escalate via brainstorming. Exception: existing `specs/DESIGN.md` → use as source of truth.

### Dynamic Swarm Scaling
Base personas = foundation. Analyze user's tech stack → auto-instantiate specialized temporary personas as needed.

## Anti-Simulation Enforcement

### Project Type Classification & Completeness Checklist (Step 0c)
Before Blue Team draft, classify project type & apply corresponding checklist. Read full checklist, adapters, & consistency gate: [completeness-checklist.md](file://{{SKILLS_DIR}}/adversarial-swarm-analysis/references/completeness-checklist.md)

**⛔ GATE:** Blue Team draft missing even ONE required section (after adapter) → Critic Council ! reject entire draft. ⊥ proceed to adversarial pass with incomplete draft.

### Mandatory Visible Iteration Logs
⊥ claim "internally looped." ∀ iteration ! be **printed to user** using Adversarial Swarm Iteration Log format ∈ [iteration-log-format.md](file://{{SKILLS_DIR}}/shared/iteration-log-format.md).

**⛔ GATE:** Missing | summarized iteration log → entire swarm run invalid.

### Minimum Iteration Count
- **≥ 3 documented iterations** before PASS allowed
- Iteration 1 = ALWAYS FAIL (initial draft always has gaps)
- Red Team PASS on iteration 1 | 2 → override, ! attack harder. Premature PASS = lazy analysis, not perfect spec.

## Iterative Workflow
Execute this exact loop:

0. **Pre-Flight Context Map:** Identify ∀ frameworks/versions ∈ target architecture.
0b. **Pre-Flight Codebase Grounding (∃ existing spec):** If `specs/` | `specs/SPEC.md` already exists, Reconciler ! read BEFORE Blue Team drafts:
   - Existing `specs/SPEC.md`
   - Actual `docker-compose.yml` (verify real port mappings)
   - Actual API schema files (verify real field names)
   - Actual frontend component directory listing (verify which components exist)
   <anti_hallucination>Reconciler ! use file-reading tools. ⊥ assume spec correct | rely on memory. Fresh reads every time.</anti_hallucination>
0c. **Project Type Classification:** Classify project (`backend-service` | `fullstack-app` | `client-side-app` | `game`). Determines Completeness Checklist variant. Log classification ∈ first iteration log.
1. **Generation Pass:** Creator Swarm → complete spec draft. **! pass Completeness Checklist before proceeding.** Fail → loop back & fill gaps before Red Team pass.
2. **Adversarial Pass:** Critic Council attacks draft — ambiguities, missing edge-cases, architectural flaws. ∀ finding ! be printed ∈ Iteration Log format.
3. **Resolution:** Creators modify spec to resolve attacks. **ESCALATION:** Resolving attack requires business assumption | guessing user intent | defining UX/arch flow not previously discussed → Creators ⊥ guess. ! PAUSE swarm, invoke `brainstorming` skill for clarifying question, resume only after user provides explicit direction.

   **Explicit Escalation Triggers:**
   - Color palette | theme (dark/light mode) not provided
   - Typography | font family not specified
   - Layout pattern decisions (sidebar width, card vs list, split pane ratios)
   - Animation/transition style preferences
   - Any UX flow affecting user interaction (modal vs inline, wizard vs single page)

   UX/UI Lead ⊥ fill gaps with "sensible defaults." Ask first.
4. **Loop:** ! recursively repeat Steps 1-3 until Critics → "PASS" with ZERO new findings. ⊥ stop after single pass. **≥ 3 documented iterations required.**
5. **Commit & Save:** Output finalized spec. ! save to `specs/` directory (e.g., `specs/SPEC.md`). ⊥ write implementation code.
6. **Handoff:** Present spec to user. **SDD Context:** ∃ `specs/.sdd-state.json` | invoked by SDD orchestrator → return control to SDD. ⊥ invoke downstream skills directly. **Standalone:** Present spec, ask user next step.
7. **Report:** Output Swarm Log. Format: `| Spec Section | Attacking Persona | Ambiguity/Flaw Found | Blue Team Resolution |`.

## Usage Triggers
User asks for "Red Team review" | "Adversarial Swarm Analysis" | "Spec-Driven Design" | "harden" architecture → adopt this workflow.
