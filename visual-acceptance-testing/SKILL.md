---
name: visual-acceptance-testing
description: Browser-based visual acceptance testing gate for UI projects. Walks every screen in the spec's Component Hierarchy, screenshots each, verifies element presence, tests interactions, and flags debug artifacts. Use when completing a UI implementation phase, before claiming visual correctness, or when the development-swarm reaches its verification stage on a frontend/game project.
---

# Visual Acceptance Testing (VAT)

## Overview
This skill closes the gap between "code compiles and tests pass" and "the user actually sees what the spec promised." It uses the `browser_subagent` tool to empirically verify every visual and interactive element defined in the architecture spec.

**Why this exists:** Unit tests verify logic. TypeScript compilation verifies types. Neither verifies that a button is visible, a screen has content, an animation plays, or a cup appears on a conveyor belt. This skill does.

## When to Invoke

This skill is **MANDATORY** for any project with a UI (web apps, games, PWAs) at these points:
1. After each implementation phase in the `development-swarm` completes and code is written
2. Before the Post-Implementation Reconciliation step (Step 6 of `development-swarm`)
3. Whenever the user reports a visual bug — run VAT first to reproduce before fixing

**Project Type Applicability:**
| Project Type | VAT Required? |
|---|---|
| `game` | ✅ Always |
| `client-side-app` | ✅ Always |
| `fullstack-app` | ✅ If frontend exists |
| `backend-service` | ❌ Skip |

## The VAT Protocol

### Step 1: Identify the Screen Map
Read the spec's **Component Hierarchy** (e.g., from `specs/ARCHITECTURE.md`). Extract every screen and its child components into a checklist:

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
For EACH screen in the checklist, use `browser_subagent` to:

1. **Navigate** to the screen (click through the UI flow naturally)
2. **Screenshot** the screen
3. **Verify** every child component listed in the hierarchy is:
   - Present in the DOM (not missing)
   - Visually visible (not `display: none`, not 0-height, not transparent)
   - Non-empty (contains actual content — text, images, or child elements)
4. **Record** the result as PASS/FAIL per component

**Output format:**
```markdown
## 🖥️ Screen Walk Report

| Screen | Component | Present? | Visible? | Has Content? | Status |
|--------|-----------|----------|----------|--------------|--------|
| TitleScreen | Logo | ✅ | ✅ | ✅ "COFFEE RUSH" | PASS |
| LevelComplete | StarAnimation | ✅ | ❌ | ❌ empty div | FAIL |
| LevelComplete | Stats | ❌ | — | — | FAIL |
```

### Step 3: Interaction Contract Audit
Read the spec's **Input & Interaction Contract** (e.g., §2.6). For each interaction row:

1. Navigate to the correct game state
2. Perform the input (tap, click, etc.)
3. Verify the expected result occurs
4. Verify the expected feedback occurs (animation, sound indicator, state change)

**Output format:**
```markdown
## 🎮 Interaction Audit

| Input | State | Expected Result | Actual Result | Status |
|-------|-------|-----------------|---------------|--------|
| Tap tray (match) | GAMEPLAY:IDLE | Cup flies to tray | Cup disappeared from belt, appeared in tray | PASS |
| Tap Retry | LEVEL_FAILED | Reload level | Screen froze, no transition | FAIL |
```

### Step 3.5: Design Token Verification (Projects with `DESIGN.md` only)

If a `specs/DESIGN.md` exists, verify that the rendered UI actually uses the design tokens. This catches cases where the CSS/Tailwind classes are correct but a runtime override (e.g., a parent component's inline style, a CSS specificity conflict) changes the rendered value.

For each major component listed in `DESIGN.md`'s `components:` section:

1. Navigate to a screen where the component is visible
2. Use `browser_subagent` to inspect the computed styles of the element
3. Compare the rendered `background-color`, `color`, `font-family`, `font-size`, and `border-radius` against the corresponding `DESIGN.md` token values
4. Flag any mismatch (tolerance: ±1px for dimensions, exact match for colors after normalizing to the same format)

**Output format:**
```markdown
## 🎨 Design Token Verification

| Component | Property | DESIGN.md Token | Expected Value | Rendered Value | Status |
|-----------|----------|-----------------|----------------|----------------|--------|
| chat-card-user | borderLeft | colors.accent | #00D4FF | #00D4FF | PASS |
| header | backgroundColor | colors.primary-surface | #0D1220 | #0D1220 | PASS |
| send-button | backgroundColor | colors.accent | #00D4FF | #3B82F6 | FAIL |
```

**Note:** This step supplements, not replaces, the Development Swarm's Design Token Auditor (which checks source code). This step checks the *rendered output* in the browser.

### Step 4: Debug Artifact Scan
Search the visible DOM for elements that should not be exposed in production:

1. Elements with IDs or classes containing: `mock`, `debug`, `test`, `dev`, `tmp`, `TODO`
2. `console.log` statements visible in the browser console (check for excessive logging)
3. Commented-out UI elements that are partially visible
4. Placeholder text ("Lorem ipsum", "TODO", "FIXME", "[placeholder]")

**Output format:**
```markdown
## 🔍 Debug Artifact Scan

| Element | Location | Issue | Severity |
|---------|----------|-------|----------|
| btn-win-mock | GameplayScreen | Dev button visible in production | 🔴 High |
| btn-fail-mock | GameplayScreen | Dev button visible in production | 🔴 High |
| console.log | StateMachine.ts | Transition logs in console | 🟡 Low |
```

### Step 5: Screenshot Evidence Archive
Save every screenshot taken during the Screen Walk to the conversation artifacts directory. These serve as the visual audit trail and can be embedded in the walkthrough artifact.

## Verdict Rules

- **PASS:** Every screen walk component is present + visible + has content. Every tested interaction produces the expected result. Zero high-severity debug artifacts.
- **FAIL:** Any screen walk FAIL, any interaction FAIL, or any high-severity debug artifact. The failing items become mandatory fixes before the development swarm can issue its final report.

**HARD GATE:** The VAT verdict feeds directly into the development-swarm's Post-Implementation Reconciliation. If VAT fails, reconciliation cannot begin. The Blue Team must fix the visual defects and re-run VAT.

## Integration Points

This skill is referenced by:
- `development-swarm` Step 4.5 (between Deploy and Post-Implementation Reconciliation)
- `verification-before-completion` (as a required verification type for UI projects)
- `spec-driven-development` Step 6.5 (visual gate before lifecycle completion)
