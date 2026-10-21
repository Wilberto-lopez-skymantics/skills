<!-- CAVEMAN-ENCODED. DECODER: ! = must/required | ⊥ = forbidden/never | → = leads to/becomes | ∀ = for all | ∃ = exists | ∄ = does not exist | ∈ = in | § = section ref | & = and | | = or -->

# Stage 03: Interactive Wireframing

Turn text-based layout rules & design tokens from `DESIGN.md` → tangible interactive HTML wireframes via local Visual Companion server.

Bridge between requirements gathering (Stage 01) & production implementation (Stage 05). Relies purely on Agent code-generation → HTML. Zero external API dependencies. Approved wireframes are part of the frozen set: they pin layout, copy and test ids so that two builders render the same screens.

## Inputs
- Layer 4 (working): `specs/DESIGN.md`
- Layer 4 (working): `specs/SPEC.md`
- Layer 4 (working): `specs/wireframes/*.html` (if exists)
- Layer 4 (working): `specs/logs/02-deferred-ui.md` (UI-only findings Stage 02 deferred here, if any)
- Layer 3 (reference): `../_config/visual-companion.md`
- Layer 3 (reference): `../_config/references/systems-standards.md` §11 (UI-1…UI-4: test ids, copy, state ids)
- Layer 3 (reference): `../_config/references/ui-state-matrix.md`

## Process

### Checklist

! complete in order:

1. **Verify Prerequisites** — Read `specs/DESIGN.md` & `specs/SPEC.md` → extract layout rules, tokens, component hierarchy. Missing → flag to user.
1b. **Test-id & copy preflight** (before the first screen) — per screen, list every SPEC §14 component, every UI State Matrix state id and every copy key it must show. Each component and state needs its test id (UI-1, UI-4) and each visible string a copy-table key (UI-2). A missing one → add it to SPEC/DESIGN now (user approval for new copy), not inside a wireframe.
2. **Start Visual Server** — Launch local Visual Companion server.
3. **Scaffold / Load Base HTML** — Load existing HTML files if they exist, or create new base HTML ∈ `specs/wireframes/` ∀ screens ∈ architecture.
4. **Iterative Feedback Loop** — Present wireframes via Visual Companion, iterate on user feedback.
5. **Finalization** — Save final HTML as definitive visual spec, fold every approved deviation back into `DESIGN.md` tokens, link the wireframes from `DESIGN.md`, close every `specs/logs/02-deferred-ui.md` item (`- [x]` + where it landed).
5b. **Exit audit** — the wireframe is still the artifact under approval, so contradictions with DESIGN and SPEC are caught here, not by a builder who copies it:
   - **Tokens:** `node specs/.sdd/scripts/sdd.cjs token-audit --stage 03 > specs/logs/03-token-audit.md`, then fill `Measured` for every row from the wireframe CSS that styles that component's `data-testid` (and state: hover, focus, disabled…), and `Match` ✅ | ❌. A component with no rule for a tokened property (e.g. no background where DESIGN says `colors.surface`) is ❌. Fix the CSS (or, with the user, the token) until every row is ✅.
   - **Named states:** every state SPEC, DESIGN's UI State Matrix and the UI spec name for a screen (e.g. an "archived" banner) appears in that screen's wireframe.
6. **Update state** — `node specs/.sdd/scripts/sdd.cjs transition --completed 03` (refuses without wireframes and a relative-linked `## Approved Wireframes` section, when a DESIGN component / state id lacks a wireframe `data-testid`, a static copy string appears in no wireframe, `03-token-audit.md` is incomplete or has a ❌, or a deferred Stage 02 UI item is open).
7. **Transition** — Prompt user to proceed to `04_writing_implementation_phases`.

### 1. Verify Prerequisites

Read `specs/DESIGN.md` & `specs/SPEC.md`:
- Extract 10 Design Token Categories (Colors, Typography, Spacing, etc.)
- Extract Component Hierarchy & list of distinct screens needing wireframes
- Files missing | incomplete → user needs `01_brainstorming` first

### 2. Start Visual Server

Server watches directory for HTML files, serves to browser.

```bash
# Start server with persistence
specs/.sdd/scripts/start-server.sh --project-dir /path/to/project
```

- Save `screen_dir` & `state_dir` from response.
- Wireframes are served live from `specs/wireframes/`: tell the user to open `<url>/wireframes/<screen-name>.html`. The page reloads on every save.
- **One server, one URL.** Start it from the orchestrator (not a subagent) with `--detach`, so it outlives each author. Running the script again with the same `--project-dir` returns the live server (`"reused": true`) or restarts on the recorded port; `specs/brainstorming/current-server.json` always holds the current URL. A response with `"port_changed": true` → send the new URL to the user and every author before the next edit. ⊥ cite a URL from an earlier session.

*See `../_config/visual-companion.md` for detailed server instructions.*

### 3. Scaffold / Load Base HTML

! generate, iterate, finalize **one screen at a time**. ⊥ scaffold all screens ∈ single turn.

**Deadline waves (off by default).** Only when a DECISION_LOG entry records a deadline and the user's choice to use waves:
1. **Wave 1** — screens whose layout does not depend on another screen, one author each, each with its own CSS file.
2. **Wave 2** — screens that reuse an approved wave-1 layout (e.g. a baseline view after the module view).
3. **Merge** — the orchestrator merges shared CSS into the token-referencing stylesheet, re-runs the test-id preflight and the exit audit over all screens.
4. **One user review** of the merged set; every change request goes back through Step 4 for that screen.
Without that entry, one-screen approval is the rule.

For the screen being built/modified:
- **∃ Existing Wireframe**: If `specs/wireframes/<screen-name>.html` already exists, load and use it as the base. Identify spec modifications and plan targeted edits.
- **∄ Existing Wireframe**: Generate new base HTML using precise tokens from `DESIGN.md`.

- Write to `specs/wireframes/<screen-name>.html` and edit it in place (`screen_dir` is only for throwaway A/B option pages).
- Use Vanilla CSS | Tailwind. ⊥ rely on external UI libraries unless specified ∈ architecture.
- **Initial Token Compliance:** ∀ CSS values (colors, spacing, fonts, border-radii) ! use exact values from `DESIGN.md` YAML. ⊥ use arbitrary values ≠ token. **User Override:** During iterative feedback (Step 4), user may instruct deviations → permitted & ! be captured ∈ the `deviations` list of the wireframe state file. At finalization every deviation becomes a DESIGN.md token change (Step 5), so wireframes and DESIGN.md never disagree — Stage 05's Design Token Auditor and Stage 06 grade against DESIGN.md.
- **No Inline Styles:** ! place ∀ CSS ∈ `<style>` block | linked stylesheet. HTML body = class names only. Critical for targeted edits later.
- **Semantic Placeholders:** ⊥ generate complex SVGs | base64 images. Use simple `<div>` placeholders (e.g., `<div class="placeholder asset">Spaceship Icon</div>`).
- **Test-ID Contract (UI-1, UI-4):** ∀ component ∈ SPEC Component Hierarchy carries `data-testid="<kebab-case name>"`; repeated items add `data-key`. Empty / loading / error states use `<component>-empty|loading|error`. The frozen UI specs (Stage 04) select by these ids, so builders ! reproduce them exactly.
- **Copy (UI-2):** ∀ visible static text = SPEC §14 Copy table, character-exact. Text ∄ in the copy table → add it there (with user approval), never only in the HTML.
- **States:** ∀ interactive component, wireframe every UI State Matrix state (Empty, Loading, Success, Error, Edge Case) — as separate screens or toggleable sections.
- CSS ! accurately reflect hex codes, spacing units, typography from spec.

### 4. Iterative Feedback Loop

Highly interactive phase:
1. Serve generated HTML via Visual Companion
2. Ask user for feedback on specific screen layout
3. User requests change → **directly edit HTML using targeted edits**
   - ⊥ rewrite entire file for small edits (slow, truncation-prone)
   - Use the editor's targeted-edit (string replace) tool on specific lines ∈ `<style>` block. Provide enough surrounding context for unique match.
4. Visual Companion auto-shows updated file
5. Repeat until user approves screen
6. Move to next screen, repeat

**⛔ GATE:** ⊥ ask user to choose between "A or B" text options. ! generate actual HTML code → have them review visual output.

### 5. Finalization

∀ screens approved:
1. Final HTML cleanly saved ∈ `specs/wireframes/`
2. **Fold deviations:** ∀ entry in the state file's `deviations` → update the DESIGN.md token (or add a new token / component variant) to the approved value, and update the wireframe CSS to reference that token. Record each in `specs/DECISION_LOG.md`.
3. Update `## Approved Wireframes` section of `DESIGN.md` with relative links (`[title-screen](wireframes/title-screen.html)`) + layout structure summary, key HTML tags, interactive components, test ids. ⊥ absolute `file:///` paths (they break on every other machine).
4. Delete state file (`specs/.wireframe-state.json`) → signal completion

### State Tracking

Enable cross-conversation resumption via `specs/.wireframe-state.json`:

```json
{
  "totalScreens": 6,
  "screens": [
    { "name": "TitleScreen", "status": "approved", "file": "specs/wireframes/title-screen.html" },
    { "name": "LevelSelectScreen", "status": "in-progress", "file": "specs/wireframes/level-select.html" },
    { "name": "GameplayScreen", "status": "pending", "file": null }
  ],
  "deviations": [
    { "screen": "TitleScreen", "property": "play-button backgroundColor", "token": "colors.accent", "approved": "#E4572E", "note": "User wants warmer CTA" }
  ],
  "timestamp": "2026-05-26T12:00:00Z"
}
```

Update after each screen approved | starting new screen. On invocation, check file → resume from last incomplete screen.

## Outputs
- `specs/wireframes/*.html`
- Updated `specs/DESIGN.md` (deviations folded in, relative links)
- `specs/DECISION_LOG.md` entries for approved deviations
- `specs/.sdd/_config/sdd-state.json` (via `sdd.cjs transition`)
