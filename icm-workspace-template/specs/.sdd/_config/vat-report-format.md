# VAT Report Formats

Shared format templates for Visual Acceptance Testing reports. Referenced by:
- `visual-acceptance-testing/SKILL.md` — Screen Walk, Interaction Audit, Design Token, Debug Artifact reports

---

## Screen Walk Report

```markdown
## 🖥️ Screen Walk Report

| Screen | Component | Present? | Visible? | Has Content? | Status |
|--------|-----------|----------|----------|--------------|--------|
| TitleScreen | Logo | ✅ | ✅ | ✅ "COFFEE RUSH" | PASS |
| LevelComplete | StarAnimation | ✅ | ❌ | ❌ empty div | FAIL |
| LevelComplete | Stats | ❌ | — | — | FAIL |
```

## Interaction Audit

```markdown
## 🎮 Interaction Audit

| Input | State | Expected Result | Actual Result | Status |
|-------|-------|-----------------|---------------|--------|
| Tap tray (match) | GAMEPLAY:IDLE | Cup flies to tray | Cup disappeared from belt, appeared in tray | PASS |
| Tap Retry | LEVEL_FAILED | Reload level | Screen froze, no transition | FAIL |
```

## Design Token Verification

```markdown
## 🎨 Design Token Verification

| Component | Property | DESIGN.md Token | Expected Value | Rendered Value | Status |
|-----------|----------|-----------------|----------------|----------------|--------|
| chat-card-user | borderLeft | colors.accent | #00D4FF | #00D4FF | PASS |
| send-button | backgroundColor | colors.accent | #00D4FF | #3B82F6 | FAIL |
```

## Debug Artifact Scan

```markdown
## 🔍 Debug Artifact Scan

| Element | Location | Issue | Severity |
|---------|----------|-------|----------|
| btn-win-mock | GameplayScreen | Dev button visible in production | 🔴 High |
| console.log | StateMachine.ts | Transition logs in console | 🟡 Low |
```
