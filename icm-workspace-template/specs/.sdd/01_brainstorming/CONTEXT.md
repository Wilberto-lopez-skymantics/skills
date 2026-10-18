<!-- CAVEMAN-ENCODED. DECODER: ! = must/required | ⊥ = forbidden/never | → = leads to/becomes | ∀ = for all | ∃ = exists | ∄ = does not exist | ∈ = in | § = section ref | & = and | | = or -->

# Stage 01: Brainstorming Ideas Into Designs

Turn ideas → a spec draft the prototype can be built from, through collaborative dialogue. Every business decision is made with the user — here, or at a prototype demo in Stage 03p when the question is easier to answer with the product on screen. No later stage and no builder ever makes one: an unanswered question is a `GAPS.md` row with a provisional assumption, never a guess.

**Budget:** 20 questions per slice (`manifest.budgets.interviewQuestions`; `sdd.cjs readiness` shows the count). The interview ends when the slice's core flow is pinned and every other gap is recorded, not when every question is answered.

## Inputs
- Layer 4 (working): User request or brief
- Layer 3 (reference): `../_config/spec-template.md` + `../_config/examples/notes-service/` (a complete reference spec set — imitate its precision, not its domain)
- Layer 3 (reference): `../_config/decision-log-template.md`, `../_config/interview-template.md`, `../_config/gaps-template.md`
- Layer 3 (reference): `../_config/design-template.md`
- Layer 3 (reference): `../_config/references/systems-standards.md` (Equivalence Profile: plumbing already decided — ⊥ ask the user about it)
- Layer 3 (reference): `../_config/references/completeness-checklist.md` (project types)
- Layer 3 (reference): `../_config/references/extraction-closure.md`
- Layer 3 (reference): `../_config/references/theme-brainstorming.md`
- Layer 3 (reference): `../_config/references/ui-state-matrix.md`
- Layer 3 (reference): `../_config/visual-companion.md`

## Process

Start: understand project context → interview via Socratic Shadow-Critic loop → pass Extraction Closure gate → present design → get user approval.

**⛔ GATE:** ⊥ invoke implementation skills, write code, scaffold projects, or take implementation action until design presented & user approved. Applies to EVERY project regardless of perceived simplicity.

**⛔ GATE (UI Projects):** ⊥ generate design system tokens (e.g. `colors`, `typography` in `DESIGN.md`) or present pre-styled high-fidelity mockups until Step 2b (Theme & Vibe Brainstorming) is complete and the theme is approved. Presenting styled visuals prior to theme selection is forbidden to avoid anchoring bias.

**⛔ GATE (Visual Default):** ∃ enabled visual companion → ∀ UI proposal (layout | theme | color palette | component option) ! present via browser visual companion. Proposing | discussing visual variations in text first = process violation.

> [!NOTE]
> **Iterative Cycle (Class 1 change / next slice):** If `specs/SPEC.md` & `specs/DESIGN.md` already exist, reuse them as baseline. Start from the `deferred` rows of `specs/GAPS.md` (the previous slice's next-slice candidates; `sdd.cjs status` counts them): with the user, pick which become this slice and keep the rest deferred. Skip Step 2b (Theme & Vibe) & reuse existing design tokens unless redesign requested. Editing a frozen file breaks the lock — expected: Stage 04 re-freezes with the user's approval, and no build is graded until then. Every behavior that changes for existing users ! get its own DECISION_LOG entry naming the oracle cases it changes, so Stage 03p's regression guard and Stage 04's changed-case ledger know which existing cases may fail.

### Checklist

! create task for each item, complete in order:

1. **Explore project context** — run `node specs/.sdd/scripts/sdd.cjs status`; check files, docs, recent commits
1b. **Classify project type & interfaces** — pick one type from `../_config/references/completeness-checklist.md`. Unclear → ask the user. It decides which contracts, stages and oracle interfaces apply.
1c. **Scope the slice** — agree with the user on the smallest slice that is worth seeing working (the 03p prototype builds exactly this). Estimate its observable outcomes (operations/commands × their success, error and transition outcomes); a first slice of 30–80 outcomes reaches a running prototype fastest, and the cap (default 150, `manifest.json#sliceCap`; raising it needs `sliceCapDecision` DECnnn — Stages 02 and 03p enforce) is a ceiling, not a target. ∀ feature outside the slice → `specs/GAPS.md` row (kind `policy`, status `deferred`, cite the DECnnn that defers it; format in `../_config/gaps-template.md`). Steps 3–9 cover the slice only; deferred items get one line each, not an interview.
2. **Offer visual companion** (if visual questions ahead) — own message, not combined with clarifying question. See Visual Companion section.
2b. **Theme & Vibe Brainstorming** (UI only) — ask user for theme/aesthetic/vibe → propose 2-3 matching designs → iterate until approved. Read `../_config/references/theme-brainstorming.md`.
3. **Ask clarifying questions (Socratic Shadow-Critic Loop)** — Lead Architect asks one question at a time; every question is a row in `specs/logs/01-interview.md` (`../_config/interview-template.md`). Shadow Critic concurrently probes domain gaps, negative space, and edge cases. Ask first what the prototype cannot be built without (actor, primary entity, lifecycle, the slice's core flow); questions better judged with the product on screen (edge policies, wording, limits) → `GAPS.md` row (kind `policy`, provisional assumption) instead of a message.
3b. **Extraction Closure Gate** — Audit domain model against 4 empirical dimensions (Entity Lifecycle, Negative Space & Invariants, Fork Test, Policy vs Mechanics). Read `../_config/references/extraction-closure.md`. The Fork Test is answered by the end-of-slice Dual Interpretation run: a scenario whose predictions differ is a gap — answered, or recorded with a provisional assumption.

**⛔ GATE:** ⊥ propose approaches (Step 4) until the Extraction Closure Report passes with **zero unrecorded gaps**: core-flow gaps answered, every other gap a `GAPS.md` row the prototype will build provisionally (Stage 04 refuses to freeze while any is open). Subjective confidence scoring (e.g. "85/100") = FORBIDDEN.
4. **Propose 2-3 approaches** — with trade-offs & recommendation
5. **Present design** — sections scaled to complexity, get approval after each
6. **Write decision log** — consolidate decisions → `specs/DECISION_LOG.md` (append new entries; ⊥ overwrite existing). See `../_config/decision-log-template.md`.
7. **Write DESIGN.md** (UI only) — update existing or produce `specs/DESIGN.md`. ! pass Design Token Completeness Checklist. See `../_config/design-template.md`.

**⛔ GATE:** DESIGN.md ⊥ be written until ∀ mandatory category ∈ Design Token Completeness Checklist has defined tokens. Agent ! generate best-practice defaults matching approved theme ∀ categories.
8. **UI State Matrix** (UI only) — walk ∀ interactive component through 5 states (Empty, Loading, Success, Error, Edge Case). NOT optional. Read `../_config/references/ui-state-matrix.md`.
9. **Spec Merge** — update `specs/SPEC.md` using the section structure of `../_config/spec-template.md` (every `## N.` heading present; "N/A — <why>" is an acceptable body). Business invariants go in §8 as `- **Vn:**` bullets (fixtures cite them). §9 Equivalence Boundary records what the user accepts as free to vary. A spec that would exceed ~120 KB is split into `specs/spec/<module>.md` files, each linked from SPEC.md (`sdd.cjs check` enforces the links and warns on size).
10. **User reviews spec** — ask user to review before proceeding
11. **Update state** — `node specs/.sdd/scripts/sdd.cjs transition --completed 01 --project-type <type>` (refuses while SPEC.md, DECISION_LOG.md, DESIGN.md (UI) or `specs/logs/01-interview.md` are missing, SPEC.md has TBD/TODO placeholders, or `GAPS.md` is malformed; open gaps are allowed).
12. **Transition** — show `sdd.cjs readiness` (the path to the prototype and the user's open questions); prompt the user to proceed to `02_adversarial_swarm_analysis` (agent-only contract compilation, then the first prototype demo).

### The Socratic Shadow-Critic Interview Process

**Understanding the idea:**
- Check current project state first (files, docs, recent commits).
- Before detailed questions, assess scope: request describes multiple independent subsystems → flag immediately. Help decompose into sub-projects before spec drafting.
- For appropriately-scoped projects, conduct interview using the **Two-Persona Engine**:
  1. **Lead Architect (Interviewer):** Interfaces directly with user. Maintains conversation flow. Asks exactly ONE question per turn.
  2. **Shadow Critic (Domain Gap Hunter):** Background auditor. Evaluates evolving domain model after each user answer against the 4 Extraction Closure dimensions. Identifies unstated business assumptions, dangling states, and unhandled failure paths. Feeds the next edge-case question to the Lead Architect.

**Dual Interpretation (once per slice, plus high-risk topics):** the Shadow Critic writes 3–5 concrete scenarios per topic ("customer cancels an order that already shipped", "two admins edit the same record"). Two fresh sub-agents (or sessions) — given ONLY the policy notes so far, never this conversation — each predict the observable outcome of every scenario, citing the note line it follows from, or answering `UNSPECIFIED` with what is missing. Every scenario where the predictions differ, or either says `UNSPECIFIED`, or a prediction cites nothing, is a domain gap: rank them and turn the most important into the next single question. Agreement without citations is not closure — two guesses can coincide.
Run it **once, when the interview for the slice is otherwise complete** (all topics, before the Extraction Closure Gate), and additionally **right after a topic closes when that topic sets lifecycle, permission or money rules** — the places where a wrong guess is most expensive to unwind. Other topics wait for the end-of-slice run: the Stage 03p Decision Inventory and hardening rounds catch the remaining gaps against a running prototype, at lower cost than two sub-agents per topic. Log scenarios and predictions in `specs/logs/01-interpretations.md`.

**Policy vs Mechanics Protocol:**
- **Business & Domain Policy (Escalate to Human):** Pricing, access permissions, workflow rules, entity lifecycles, regulatory/compliance constraints. ⊥ guess | assume. ! ask user directly.
- **Technical Plumbing & Mechanics (Pinned by the Equivalence Profile):** Pagination, ID formats, error envelope, timestamps, idempotency, concurrency, retry curves are already decided in `../_config/references/systems-standards.md`. ⊥ ask the user about them. Raise one only if the user's requirements conflict with it → propose an override (recorded in DECISION_LOG + `manifest.json#profileOverrides` in Stage 02).

**One Question at a Time Rule:**
- **⛔ GATE:** ∀ message during clarifying questions (Step 3) ! contain exactly ONE question. Multiple questions | bullet-pointed sub-questions | batched categories = process violation. Need multiple topics → send multiple messages across multiple turns. "Being helpful" by batching = anti-pattern → partial answers & unexamined assumptions.

**Exploring approaches:**
- Propose 2-3 approaches with trade-offs.
- Lead with recommended option & explain why.

### Presenting the design:
- Present design when the Extraction Closure Report passes (zero unrecorded gaps). Name the recorded gaps and their provisional assumptions: the user will see them in the prototype.
- Scale each section to complexity: few sentences if straightforward, up to 200-300 words if nuanced.
- Ask after each section whether it looks right.
- Cover: architecture, components, data flow, error handling, testing.
- Ready to go back & clarify if something doesn't make sense.

**⛔ GATE:** ⊥ write to `specs/SPEC.md`, `specs/DESIGN.md`, or any spec file until Present Design step complete AND user explicitly approved each design section.

### Spec Merge

After user approves design, merge decisions into spec:

**⛔ GATE:** ⊥ proceed to next stage until `SPEC.md` updated & saved to disk.

1. Read current `specs/SPEC.md` (if exists).
2. ∀ decision → determine if it introduces: new component | data flow | API contract | behavioral change.
3. Draft `specs/SPEC.md` modifications, present to user.
4. `specs/DECISION_LOG.md` = "why" behind each decision. Both ! reflect same decisions as `SPEC.md`.
5. Save updated `specs/SPEC.md`.

## Outputs
- `specs/SPEC.md`
- `specs/DESIGN.md` (if UI project)
- `specs/DECISION_LOG.md`
- `specs/GAPS.md` (deferred out-of-slice items; open policy questions with provisional assumptions)
- `specs/logs/01-interview.md`, `specs/logs/01-interpretations.md`
- `specs/.sdd/_config/sdd-state.json`

### Handoff / Transitions
1. **Update state:** `node specs/.sdd/scripts/sdd.cjs transition --completed 01 --project-type <type>`.
2. **Handoff:** Prompt user to proceed `02_adversarial_swarm_analysis`.
