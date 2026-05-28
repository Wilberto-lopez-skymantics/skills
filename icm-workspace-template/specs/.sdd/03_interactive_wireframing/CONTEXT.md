<!-- CAVEMAN-ENCODED. DECODER: ! = must/required | ⊥ = forbidden/never | → = leads to/becomes | ∀ = for all | ∃ = exists | & = and | | = or -->

# Stage 03: Interactive Wireframing

Turn text-based layout rules & design tokens from `DESIGN.md` → tangible interactive HTML wireframes via local Visual Companion server.

Bridge between requirements gathering (Stage 01) & production implementation (Stage 05). Relies purely on Agent code-generation → HTML. Zero external API dependencies.

## Inputs
- Layer 4 (working): `specs/DESIGN.md`
- Layer 4 (working): `specs/SPEC.md`
- Layer 3 (reference): `../_config/visual-companion.md`

## Process

### Checklist

! complete in order:

1. **Verify Prerequisites** — Read `specs/DESIGN.md` & `specs/SPEC.md` → extract layout rules, tokens, component hierarchy. Missing → flag to user.
2. **Start Visual Server** — Launch local Visual Companion server.
3. **Scaffold Base HTML** — Create base HTML ∈ `specs/wireframes/` ∀ screens ∈ architecture.
4. **Iterative Feedback Loop** — Present wireframes via Visual Companion, iterate on user feedback.
5. **Finalization** — Save final HTML as definitive visual spec, update `DESIGN.md` to reference them.
6. **Transition** — Prompt user to proceed to `04_writing_implementation_phases`.

### 1. Verify Prerequisites

Read `specs/DESIGN.md` & `specs/SPEC.md`:
- Extract 10 Design Token Categories (Colors, Typography, Spacing, etc.)
- Extract Component Hierarchy & list of distinct screens needing wireframes
- Files missing | incomplete → user needs `01_brainstorming` first

### 2. Start Visual Server

Server watches directory for HTML files, serves to browser.

```bash
# Start server with persistence
scripts/start-server.sh --project-dir /path/to/project
```

- Save `screen_dir` & `state_dir` from response.
- Tell user to open returned URL.

*See `../_config/visual-companion.md` for detailed server instructions.*

### 3. Scaffold Base HTML

! generate, iterate, finalize **one screen at a time**. ⊥ scaffold all screens ∈ single turn.

For first screen ∈ Component Hierarchy, generate base HTML using precise tokens from `DESIGN.md`:

- Write to `specs/wireframes/<screen-name>.html` (or `screen_dir` if iterating)
- Use Vanilla CSS | Tailwind. ⊥ rely on external UI libraries unless specified ∈ architecture.
- **Initial Token Compliance:** ∀ CSS values (colors, spacing, fonts, border-radii) ! use exact values from `DESIGN.md` YAML. ⊥ use arbitrary values ≠ token. **User Override:** During iterative feedback (Step 4), user may instruct deviations → permitted & ! be captured ∈ wireframe state file with note. Approved wireframes (including deviations) = visual source of truth, superseding DESIGN.md.
- **No Inline Styles:** ! place ∀ CSS ∈ `<style>` block | linked stylesheet. HTML body = class names only. Critical for targeted edits later.
- **Semantic Placeholders:** ⊥ generate complex SVGs | base64 images. Use simple `<div>` placeholders (e.g., `<div class="placeholder asset">Spaceship Icon</div>`).
- CSS ! accurately reflect hex codes, spacing units, typography from spec.

### 4. Iterative Feedback Loop

Highly interactive phase:
1. Serve generated HTML via Visual Companion
2. Ask user for feedback on specific screen layout
3. User requests change → **directly edit HTML using targeted edits**
   - ⊥ rewrite entire file for small edits (slow, truncation-prone)
   - Use `replace_file_content` targeting specific lines ∈ `<style>` block. Provide enough surrounding context for unique match.
4. Visual Companion auto-shows updated file
5. Repeat until user approves screen
6. Move to next screen, repeat

**⛔ GATE:** ⊥ ask user to choose between "A or B" text options. ! generate actual HTML code → have them review visual output.

### 5. Finalization

∀ screens approved:
1. Final HTML cleanly saved ∈ `specs/wireframes/`
2. Update `## Approved Wireframes` section of `DESIGN.md` with clickable absolute links + layout structure summary, key HTML tags, interactive components
3. Delete state file (`specs/.wireframe-state.json`) → signal completion

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
  "timestamp": "2026-05-26T12:00:00Z"
}
```

Update after each screen approved | starting new screen. On invocation, check file → resume from last incomplete screen.

## Outputs
- `specs/wireframes/*.html`
- Updated `specs/DESIGN.md`
