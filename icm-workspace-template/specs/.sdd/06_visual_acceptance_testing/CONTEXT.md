<!-- CAVEMAN-ENCODED. DECODER: ! = must/required | ⊥ = forbidden/never | → = leads to/becomes | ∀ = for all | ∃ = exists | & = and | | = or -->

# Stage 06: Visual Acceptance Testing (VAT)

Browser-based visual acceptance testing for UI projects. Walks every screen in the spec's Component Hierarchy, screenshots each, verifies element presence and visibility, tests interactions, and flags debug artifacts.

**Why:** Unit tests verify logic. TypeScript verifies types. Neither verifies button visible, screen has content, animation plays. This stage does.

## Inputs
- Layer 4 (working): Source code / Deployed application
- Layer 4 (working): `specs/SPEC.md`
- Layer 4 (working): `specs/DESIGN.md` (if UI project)
- Layer 4 (working): `specs/wireframes/*.html` (? exists)
- Layer 3 (reference): `../_config/vat-report-format.md`

## Process

**MANDATORY** ∀ projects with UI (web apps, games, PWAs). Skip for `backend-service`.

### VAT Protocol

**⛔ GATE:** ! create tracking artifact `specs/vat-checklist.md`. ! document evaluation ∀ screen/interaction sequentially, check boxes only when proven by browser screenshot | computed style extraction. Mass-approving without tracker = severe process violation (rubber-stamping).

#### Step 1: Identify Screen Map
Read spec's **Component Hierarchy**. Extract ∀ screens & child components → checklist:

```markdown
## VAT Checklist
- [ ] TitleScreen: Logo, PlayButton, SettingsButton
- [ ] LevelSelectScreen: BackButton, LevelGrid > LevelTile[]
```

#### Step 2: Screen Walk (Visual Presence Audit)
∀ screen ∈ checklist, use `browser_subagent` (or Puppeteer/Playwright script if unavailable):

1. **Navigate** to screen
2. **Screenshot** the screen
3. **Verify** ∀ child component:
   - Present ∈ DOM
   - Visually visible (not `display: none`, not 0-height, not transparent)
   - Non-empty
4. **Record** PASS/FAIL per component

#### Step 3: Interaction Contract Audit
Read spec's **Input & Interaction Contract**. ∀ interaction:

1. Navigate to correct state
2. Perform input (tap, click)
3. Verify expected result occurs & expected feedback

#### Step 3.5: Design Token Verification (∃ `DESIGN.md` only)
∃ `specs/DESIGN.md` → verify rendered UI uses design tokens. 

∀ major component ∈ DESIGN.md `components:` section:
1. Inspect computed styles
2. Compare rendered `background-color`, `color`, `font-family`, `font-size`, `border-radius` vs DESIGN.md tokens
3. Flag mismatch

#### Step 4: Debug Artifact Scan
Search visible DOM for elements ⊥ be exposed ∈ production:
1. IDs | classes containing: `mock`, `debug`, `test`, `dev`, `tmp`, `TODO`
2. `console.log` ∈ browser console
3. Commented-out UI elements partially visible
4. Placeholder text

#### Step 5: Screenshot Evidence Archive
Save ∀ screenshots taken during Screen Walk → conversation artifacts directory. 

### Verdict Rules

- **PASS:** ∀ screen walk components present + visible + has content. ∀ tested interactions produce expected result. Zero high-severity debug artifacts.
- **FAIL:** Any screen walk FAIL | interaction FAIL | high-severity debug artifact. Failing items = mandatory fixes before dev swarm issues final report.

**⛔ GATE:** VAT verdict feeds into dev swarm Post-Implementation Reconciliation. VAT FAIL → Blue Team ! fix visual defects & re-run VAT.

## Outputs
- `specs/vat-checklist.md`
- VAT Report (printed or saved as `specs/VAT_REPORT.md` using `vat-report-format.md`)
- Saved screenshots
- `specs/.sdd/_config/sdd-state.json`

If passing, update `specs/.sdd/_config/sdd-state.json` (schema: `specs/.sdd/_config/sdd-state.json.template`) with `lastCompletedStep: 6` & `stepName: "06_visual_acceptance_testing"`, and prompt user to proceed to `07_verification_before_completion`.
