<!-- CAVEMAN-ENCODED. DECODER: ! = must/required | ⊥ = forbidden/never | → = leads to/becomes | ∀ = for all | ∃ = exists | ∄ = does not exist | ∈ = in | § = section ref | & = and | | = or -->

# Stage 03: Wireframes From the Prototype

Turn the accepted prototype's screens (Stage 03p) → frozen HTML wireframes in `specs/wireframes/`. UI projects only, after 03p.

Approved wireframes are part of the frozen set: they pin layout, copy, state ids and test ids so that two builders render the same screens. Build B never sees the prototype; the wireframes are its only channel for layout. Capturing them from the running prototype means every layout decision the prototype made is either frozen here or caught as a gap — nothing stays folklore in the prototype's code.

## Inputs
- Layer 4 (working): the running prototype (`Run:` line in `specs/logs/03p-prototype.md`)
- Layer 4 (working): `specs/DESIGN.md`, `specs/SPEC.md` (§14 UI: component hierarchy, copy table, state matrix)
- Layer 4 (working): `specs/wireframes/*.html` (if exists — iterations re-capture changed screens only)
- Layer 3 (reference): `../_config/visual-companion.md`
- Layer 3 (reference): `../_config/references/systems-standards.md` §11 (UI-1…UI-4: test ids, copy, state ids)
- Layer 3 (reference): `../_config/references/ui-state-matrix.md`

## Process

### Checklist

! complete in order:

1. **Verify Prerequisites** — prototype runs; `DESIGN.md` tokens and SPEC §14 exist. Missing → flag to user (Stage 01 / 03p first).
2. **Capture one screen state at a time** — ∀ screen ∈ SPEC Component Hierarchy × ∀ UI State Matrix state reachable in the prototype → `specs/wireframes/<screen>[-<state>].html`.
3. **Verify the contract** — test ids, copy, tokens, states (below). Every miss is fixed **in the prototype first**, then re-captured.
4. **User review via Visual Companion** — serve `specs/wireframes/`; the user confirms each screen matches what they accepted.
5. **Finalization** — fold token deviations into `DESIGN.md`, link every wireframe from `DESIGN.md` §Approved Wireframes.
6. **Update state** — `node specs/.sdd/scripts/sdd.cjs transition --completed 03` (refuses without wireframes and a relative-linked `## Approved Wireframes` section).
7. **Transition** — Prompt user to proceed to `04_writing_implementation_phases`.

### 2. Capture

Start the prototype with its `Run:` line and the frozen build environment (`eval "$(node specs/.sdd/scripts/oracle.cjs env)"` once `oracle.config.json` exists; before that, SPEC §12 defaults). For each screen state:

```bash
node specs/.sdd/scripts/ui-capture.cjs --url <prototype url> --name <screen>[-<state>] [--wait "[data-testid=<id>]"] [--setup ./capture-setup.cjs] --aria
```

The tool (Playwright, already required for UI projects) performs the same capture for every agent: it inlines every same-origin stylesheet rule into one `<style>` block, removes scripts and framework attributes, replaces images/SVGs/media with `<div class="placeholder asset">` carrying their label, freezes form-control state into attributes, and keeps every `data-testid`, `data-key`, ARIA attribute, visible text and the DOM order. `--setup` runs a module `async (page) => {}` to drive the prototype into the state (log in, open a modal, trigger the empty state). `--aria` also writes `<name>.aria.json` (ARIA snapshot + test-id sequence, the `diff-ui` reference). It warns when a screen has no test ids.

- One file per screen state in `specs/wireframes/`; re-capture in place on iterations. ⊥ hand-edit a capture into something the prototype does not do; ⊥ hand-draw a screen the prototype lacks — build it in the prototype first (03p re-run).

### 3. Verify the contract

- **Test-ID Contract (UI-1, UI-4):** ∀ component ∈ SPEC Component Hierarchy carries `data-testid="<kebab-case name>"`; repeated items add `data-key`; empty / loading / error states use `<component>-empty|loading|error`. The frozen UI specs (Stage 04) select by these ids, so builders ! reproduce them exactly. Missing id → fix the prototype, re-capture.
- **Copy (UI-2):** ∀ visible static text = SPEC §14 Copy table, character-exact. Text ∄ in the copy table → add it there (with user approval) — never only in the HTML.
- **Tokens:** ∀ CSS color / spacing / font / radius value ∈ the captured `<style>` ! equal a `DESIGN.md` token value. A value with no token = a deviation: either the user approves it → new or changed token in `DESIGN.md` + DECISION_LOG entry, or the prototype is fixed to the token and re-captured. Wireframes and DESIGN.md never disagree — Stage 05's Design Token Auditor and Stage 06 grade against DESIGN.md.
- **States:** ∀ interactive component has a wireframe for every UI State Matrix state (Empty, Loading, Success, Error, Edge Case). A state the prototype cannot reach → `GAPS.md` row (kind `ui`) → prototype fix.
- **No Inline Styles:** HTML body = class names only; CSS in the `<style>` block. Keeps targeted edits possible later.

### 4. User review

```bash
specs/.sdd/scripts/start-server.sh --project-dir /path/to/project
```
Wireframes are served live from `specs/wireframes/`: `<url>/wireframes/<screen-name>.html`. Walk the user through every screen state; the question is "is this the product you accepted?", not "which option?" A change the user asks for here → prototype first (03p feedback rule: spec + code in the same step), then re-capture. ⊥ edit a wireframe into something the prototype does not do.

*See `../_config/visual-companion.md` for server details.*

### 5. Finalization

1. Every captured file cleanly saved ∈ `specs/wireframes/`.
2. **Fold deviations:** ∀ approved deviation → `DESIGN.md` token change + `specs/DECISION_LOG.md` entry; wireframe CSS references the token value.
3. Update `## Approved Wireframes` in `DESIGN.md` with relative links (`[title-screen](wireframes/title-screen.html)`) + per screen: layout summary, interactive components, state files, test ids. ⊥ absolute `file:///` paths (they break on every other machine).
4. Delete the capture tracker (`specs/.wireframe-state.json`) → signal completion.

### State Tracking

Cross-conversation resumption via `specs/.wireframe-state.json`:

```json
{
  "screens": [
    { "name": "TitleScreen", "states": ["default", "loading"], "status": "approved" },
    { "name": "LevelSelect", "states": ["default", "empty", "error"], "status": "in-progress" }
  ],
  "deviations": [
    { "screen": "TitleScreen", "property": "play-button backgroundColor", "token": "colors.accent", "approved": "#E4572E", "note": "User wants warmer CTA" }
  ],
  "timestamp": "2026-05-26T12:00:00Z"
}
```

## Outputs
- `specs/wireframes/*.html` (+ optional `*.aria.json`)
- Updated `specs/DESIGN.md` (deviations folded in, relative links)
- `specs/DECISION_LOG.md` entries for approved deviations
- `specs/GAPS.md` rows (kind `ui`) for states or components the prototype lacks
- `specs/.sdd/_config/sdd-state.json` (via `sdd.cjs transition`)
