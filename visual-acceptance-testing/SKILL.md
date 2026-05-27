---
name: visual-acceptance-testing
description: "Browser-based visual acceptance testing for UI projects. Walks every screen in the spec's Component Hierarchy, screenshots each, verifies element presence and visibility, tests interactions, and flags debug artifacts."
---

<!-- CAVEMAN-ENCODED. DECODER: ! = must/required | ⊥ = forbidden/never | → = leads to/becomes | ∀ = for all | ∃ = exists | & = and | | = or -->

# Visual Acceptance Testing (VAT)

## Overview
Closes gap between "code compiles & tests pass" and "user actually sees what spec promised." Uses `browser_subagent` to empirically verify ∀ visual & interactive elements ∈ architecture spec.

**Why:** Unit tests verify logic. TypeScript verifies types. Neither verifies button visible, screen has content, animation plays. This skill does.

## When to Invoke

**MANDATORY** ∀ projects with UI (web apps, games, PWAs):
1. After each implementation phase ∈ dev swarm completes & code written
2. Before Post-Implementation Reconciliation (Step 6 of dev swarm)
3. User reports visual bug → run VAT first to reproduce before fixing

| Project Type | VAT Required? |
|---|---|
| `game` | ✅ Always |
| `client-side-app` | ✅ Always |
| `fullstack-app` | ✅ If frontend ∃ |
| `backend-service` | ❌ Skip |

## VAT Protocol

### Platform Fallback Rule
Platform ∄ native `browser` | `browser_subagent` tool:
1. ⊥ skip VAT.
2. ! write Node.js capture script (`puppeteer` | `playwright`) → `specs/.tmp/capture.mjs`.
3. Start dev server as background task, run capture script → screenshots, inspect via `view_file`.

**⛔ GATE:** ! create tracking artifact `vat-checklist.md`. ! document evaluation ∀ screen/interaction sequentially, check boxes only when proven by browser screenshot | computed style extraction. Mass-approving without tracker = severe process violation (rubber-stamping).

### Step 1: Identify Screen Map
Read spec's **Component Hierarchy** (e.g., `specs/SPEC.md`). Extract ∀ screens & child components → checklist:

```markdown
## VAT Checklist
- [ ] TitleScreen: Logo, PlayButton, SettingsButton
- [ ] LevelSelectScreen: BackButton, LevelGrid > LevelTile[]
- [ ] GameplayScreen: HUD, TrayGrid > Tray[], ConveyorBelt > Cup[], HoldingArea, TutorialOverlay
- [ ] LevelCompleteScreen: StarAnimation, Stats, NextLevelButton, ReplayButton, LevelSelectButton
- [ ] LevelFailedScreen: FailMessage, RetryButton, QuitButton
- [ ] SettingsScreen: SoundToggle, HapticsToggle, ColorblindModeSelector, BackButton
```

### Step 2: Screen Walk (Visual Presence Audit)
∀ screen ∈ checklist, use `browser_subagent`:

1. **Navigate** to screen (click through UI flow naturally)
2. **Screenshot** the screen
3. **Verify** ∀ child component ∈ hierarchy:
   - Present ∈ DOM (not missing)
   - Visually visible (not `display: none`, not 0-height, not transparent)
   - Non-empty (contains content — text, images, child elements)
4. **Record** PASS/FAIL per component

**Output format:** Screen Walk Report ∈ [vat-report-format.md](file://{{SKILLS_DIR}}/shared/vat-report-format.md).

### Step 3: Interaction Contract Audit
Read spec's **Input & Interaction Contract** (e.g., §2.6). ∀ interaction:

1. Navigate to correct state
2. Perform input (tap, click, etc.)
3. Verify expected result occurs
4. Verify expected feedback (animation, sound indicator, state change)

**Output format:** Interaction Audit ∈ [vat-report-format.md](file://{{SKILLS_DIR}}/shared/vat-report-format.md).

### Step 3.5: Design Token Verification (∃ `DESIGN.md` only)

∃ `specs/DESIGN.md` → verify rendered UI uses design tokens. Catches CSS correct but runtime override (parent inline style, specificity conflict) changes rendered value.

∀ major component ∈ DESIGN.md `components:` section:

1. Navigate to screen where component visible
2. `browser_subagent` → inspect computed styles
3. Compare rendered `background-color`, `color`, `font-family`, `font-size`, `border-radius` vs DESIGN.md tokens
4. Flag mismatch (tolerance: ±1px dimensions, exact match colors after normalizing format)

**Output format:** Design Token Verification ∈ [vat-report-format.md](file://{{SKILLS_DIR}}/shared/vat-report-format.md).

**Note:** Supplements dev swarm's Design Token Auditor (checks source code). This checks *rendered output* ∈ browser.

### Step 4: Debug Artifact Scan
Search visible DOM for elements ⊥ be exposed ∈ production:

1. IDs | classes containing: `mock`, `debug`, `test`, `dev`, `tmp`, `TODO`
2. `console.log` ∈ browser console (excessive logging)
3. Commented-out UI elements partially visible
4. Placeholder text ("Lorem ipsum", "TODO", "FIXME", "[placeholder]")

**Output format:** Debug Artifact Scan ∈ [vat-report-format.md](file://{{SKILLS_DIR}}/shared/vat-report-format.md).

### Step 5: Screenshot Evidence Archive
Save ∀ screenshots taken during Screen Walk → conversation artifacts directory. Serves as visual audit trail, can be embedded ∈ walkthrough artifact.

## Verdict Rules

- **PASS:** ∀ screen walk components present + visible + has content. ∀ tested interactions produce expected result. Zero high-severity debug artifacts.
- **FAIL:** Any screen walk FAIL | interaction FAIL | high-severity debug artifact. Failing items = mandatory fixes before dev swarm issues final report.

**⛔ GATE:** VAT verdict feeds into dev swarm Post-Implementation Reconciliation. VAT FAIL → reconciliation ⊥ begin. Blue Team ! fix visual defects & re-run VAT.

## Integration Points

Referenced by:
- `development-swarm` Step 4.5 (between Deploy & Reconciliation)
- `verification-before-completion` (required verification type for UI)
- `spec-driven-development` Step 9a (visual gate before lifecycle completion)
