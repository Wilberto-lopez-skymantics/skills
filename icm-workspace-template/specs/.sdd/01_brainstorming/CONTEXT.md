<!-- CAVEMAN-ENCODED. DECODER: ! = must/required | ⊥ = forbidden/never | → = leads to/becomes | ∀ = for all | ∃ = exists | § = section ref | & = and | | = or -->

# Stage 01: Brainstorming Ideas Into Designs

Turn ideas → fully formed designs & specs through collaborative dialogue.

## Inputs
- Layer 4 (working): User request or brief
- Layer 3 (reference): `../_config/decision-log-template.md`
- Layer 3 (reference): `../_config/design-template.md`
- Layer 3 (reference): `../_config/references/confidence-assessment.md`
- Layer 3 (reference): `../_config/references/theme-brainstorming.md`
- Layer 3 (reference): `../_config/references/ui-state-matrix.md`
- Layer 3 (reference): `../_config/visual-companion.md`

## Process

Start: understand project context → ask questions one at a time → present design → get user approval.

**⛔ GATE:** ⊥ invoke implementation skills, write code, scaffold projects, or take implementation action until design presented & user approved. Applies to EVERY project regardless of perceived simplicity.

**⛔ GATE (UI Projects):** ⊥ generate design system tokens (e.g. `colors`, `typography` in `DESIGN.md`) or present pre-styled high-fidelity mockups until Step 2b (Theme & Vibe Brainstorming) is complete and the theme is approved. Presenting styled visuals prior to theme selection is forbidden to avoid anchoring bias.

**⛔ GATE (Visual Default):** ∃ enabled visual companion → ∀ UI proposal (layout | theme | color palette | component option) ! present via browser visual companion. Proposing | discussing visual variations in text first = process violation.

> [!NOTE]
> **Iterative Cycle:** If `specs/SPEC.md` & `specs/DESIGN.md` already exist, reuse them as baseline. Skip Step 2b (Theme & Vibe) & reuse existing design tokens unless redesign requested.

### Checklist

! create task for each item, complete in order:

1. **Explore project context** — check files, docs, recent commits
2. **Offer visual companion** (if visual questions ahead) — own message, not combined with clarifying question. See Visual Companion section.
2b. **Theme & Vibe Brainstorming** (UI only) — ask user for theme/aesthetic/vibe → propose 2-3 matching designs → iterate until approved. Read `../_config/references/theme-brainstorming.md`.
3. **Ask clarifying questions** — one at a time, understand purpose/constraints/success criteria
3b. **Confidence Self-Assessment** — score understanding across 5 dimensions, ! reach ≥85 before proposing approaches. Read `../_config/references/confidence-assessment.md`.

**⛔ GATE:** ⊥ propose approaches (Step 4) until Confidence Self-Assessment score ≥85. ! re-score after each round of clarifying questions.
4. **Propose 2-3 approaches** — with trade-offs & recommendation
5. **Present design** — sections scaled to complexity, get approval after each
6. **Write decision log** — consolidate decisions → `specs/DECISION_LOG.md` (append new entries; ⊥ overwrite existing). See `../_config/decision-log-template.md`.
7. **Write DESIGN.md** (UI only) — update existing or produce `specs/DESIGN.md`. ! pass Design Token Completeness Checklist. See `../_config/design-template.md`.

**⛔ GATE:** DESIGN.md ⊥ be written until ∀ mandatory category ∈ Design Token Completeness Checklist has defined tokens. Agent ! generate best-practice defaults matching approved theme ∀ categories.
8. **UI State Matrix** (UI only) — walk ∀ interactive component through 5 states (Empty, Loading, Success, Error, Edge Case). NOT optional. Read `../_config/references/ui-state-matrix.md`.
9. **Spec Merge** — update `specs/SPEC.md` with structural decisions.
10. **User reviews spec** — ask user to review before proceeding
11. **Update state** — Update `specs/.sdd/_config/sdd-state.json` (schema: `specs/.sdd/_config/sdd-state.json.template`) with `lastCompletedStep: 1` & `stepName: "01_brainstorming"`.
12. **Transition** — Prompt the user to proceed to `02_adversarial_swarm_analysis`.

### The Process

**Understanding the idea:**
- Check current project state first (files, docs, recent commits)
- Before detailed questions, assess scope: request describes multiple independent subsystems → flag immediately. Don't refine details of project needing decomposition first.
- Project too large for single spec → help decompose into sub-projects. Each sub-project gets own spec → plan → implementation cycle.
- For appropriately-scoped projects, ask questions one at a time
- Prefer multiple choice when possible, open-ended fine too
- Only one question per message — if topic needs more exploration, break into multiple questions
- Focus: purpose, constraints, success criteria

**⛔ GATE:** ∀ message during clarifying questions (Step 3) ! contain exactly ONE question. Multiple questions | bullet-pointed sub-questions | batched categories = process violation. Need multiple topics → send multiple messages across multiple turns. "Being helpful" by batching = anti-pattern → partial answers & unexamined assumptions.

**Exploring approaches:**
- Propose 2-3 approaches with trade-offs
- Lead with recommended option & explain why

### Presenting the design:
- Present design when you understand what you're building
- Scale each section to complexity: few sentences if straightforward, up to 200-300 words if nuanced
- Ask after each section whether it looks right
- Cover: architecture, components, data flow, error handling, testing
- Ready to go back & clarify if something doesn't make sense

**⛔ GATE:** ⊥ write to `specs/SPEC.md`, `specs/DESIGN.md`, or any spec file until Present Design step complete AND user explicitly approved each design section.

### Spec Merge

After user approves design, merge decisions into spec:

**⛔ GATE:** ⊥ proceed to next stage until `SPEC.md` updated & saved to disk.

1. Read current `specs/SPEC.md` (if exists)
2. ∀ decision → determine if it introduces: new component | data flow | API contract | behavioral change
3. Draft `specs/SPEC.md` modifications, present to user
4. `specs/DECISION_LOG.md` = "why" behind each decision. Both ! reflect same decisions as `SPEC.md`.
5. Save updated `specs/SPEC.md`

## Outputs
- `specs/SPEC.md`
- `specs/DESIGN.md` (if UI project)
- `specs/DECISION_LOG.md`
- `specs/.sdd/_config/sdd-state.json`
