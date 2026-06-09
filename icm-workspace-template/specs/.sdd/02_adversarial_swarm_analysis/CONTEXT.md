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
Draft/revise spec using these roles:
Roles: Core Architect, Security Auditor, AI/MLOps Engineer, Data Specialist, UX/UI Lead, Technical Writer.
Analyze project stack → instantiate additional specialist roles as needed.

### Critic Council (Red Team)
Attack spec contract, not code syntax:
1. **Edge-Case Hunter:** Missing fallback behavior, undefined error paths, unhandled timeouts.
2. **Chaos Engineer:** Assumptions about ordering, consistency, availability. Split-brain scenarios.
3. **Resource Starver:** Unbounded growth, missing pagination, no retention policy.
4. **DX Auditor:** Ambiguous contracts, unclear types (string | UUID?), inconsistent naming.
5. **Reconciler:** Cross-ref spec vs actual codebase & running infrastructure. <anti_hallucination>⊥ assume spec correct. ! inspect source files & flag ANY spec-vs-reality discrepancy.</anti_hallucination>
6. **Quantifier:** Attack vague/unquantified language. ∀ parameter ∈ final spec ! be exact value | bounded range | formula | config ref.
7. **Asset Auditor:** ∃ custom themed entities & ⊥ explicit asset pipeline → reject.

### Pipeline Rules

#### Design Escalation (UX/UI Lead)
⊥ assume visual design decisions user hasn't provided (colors, typography, spacing, animations, layout patterns).
No brand guide | style reference → ! prompt user to return to Stage 01. Exception: existing `specs/DESIGN.md` → use as source of truth.

### Anti-Simulation Enforcement

#### Project Type Classification & Completeness Checklist (Step 0c)
Before Blue Team draft, classify project type & apply corresponding checklist. Read full checklist, adapters, & consistency gate: `../_config/references/completeness-checklist.md`

**⛔ GATE:** Blue Team draft missing even ONE required section (after adapter) → Critic Council ! reject entire draft. ⊥ proceed to adversarial pass with incomplete draft.

#### Mandatory Visible Iteration Logs
⊥ claim "internally looped" (meaning all loop iterations executed inside a single hidden thought block with only the final output shown). Instead, execute all loop iterations sequentially in a single model response (turn) without stopping to wait for user input (unless a business decision or user guidance is explicitly required). You must print each iteration log in full using the Adversarial Swarm Iteration Log format ∈ `../_config/iteration-log-format.md`.

**⛔ GATE:** Missing | summarized iteration log → entire swarm run invalid.

#### Minimum Iteration Count
- **≥ 3 documented iterations** before PASS allowed
- Iteration 1 = ALWAYS FAIL (initial draft always has gaps)
- Red Team PASS on iteration 1 | 2 → override, ! attack harder. Premature PASS = lazy analysis, not perfect spec.

#### Prevent Premature Pass (Structured Verification Gates)

⊥ PASS review until Critic Council verifies spec against 4 dimensions:
- **Structural**: DB schemas, API req/res contracts, config shapes, missing §
- **Concurrency & Tx**: race conditions, request isolation, db rollback, file-to-db atomicity
- **Resource Limits**: text/paragraph limits, db scale limits, API timeout & backoff
- **Determinism**: tie-breaker ordering, random seeds, float boundaries

Pre-PASS ! include `Pre-Pass Hardening Verification Checklist` in iteration log explaining ∀ 4 dimensions. PASS ∉ checklist → process violation.


### Iterative Workflow
> [!NOTE]
> **Iterative Spec Hardening:** If `specs/SPEC.md` already exists and is being updated, the swarms ! focus their drafting and attacks primarily on the new additions and behavioral changes (the diff) while ensuring existing invariants (§V) are not violated.

Execute this exact loop:

0. **Pre-Flight Context Map:** Identify ∀ frameworks/versions ∈ target architecture.
0b. **Pre-Flight Codebase Grounding (∃ existing spec):** If `specs/SPEC.md` already exists, Reconciler ! read BEFORE Blue Team drafts.
0c. **Project Type Classification:** Classify project. Determines Completeness Checklist variant. Log classification ∈ first iteration log.
1. **Generation Pass:** Creator Swarm → complete spec draft. **! pass Completeness Checklist before proceeding.** Fail → loop back & fill gaps before Red Team pass.
2. **Adversarial Pass:** Critic Council attacks draft. ∀ finding ! be printed ∈ Iteration Log format.
3. **Resolution:** Creators modify spec to resolve attacks. **ESCALATION:** Resolving attack requires business assumption | guessing user intent → Creators ⊥ guess. ! PAUSE swarm, prompt user for explicit direction.
4. **Loop:** ! recursively repeat Steps 1-3 until Critics → "PASS" with ZERO new findings. ⊥ stop after single pass. **≥ 3 documented iterations required.**
5. **Save:** Output finalized spec. ! save to `specs/SPEC.md`. ⊥ write implementation code.
6. **Update state:** Update `specs/.sdd/_config/sdd-state.json` (schema: `specs/.sdd/_config/sdd-state.json.template`) with `lastCompletedStep: 2` & `stepName: "02_adversarial_swarm_analysis"`.
7. **Handoff:** Present spec to user. Prompt user to proceed to `04_writing_implementation_phases` (or `03_interactive_wireframing` if UI project).
8. **Report:** Output Swarm Log. Format: `| Spec Section | Attacking Persona | Ambiguity/Flaw Found | Blue Team Resolution |`.

## Outputs
- `specs/SPEC.md` (Hardened)
- `specs/.sdd/_config/sdd-state.json`
