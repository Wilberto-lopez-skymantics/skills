<!-- CAVEMAN-ENCODED. DECODER: ! = must/required | ⊥ = forbidden/never | → = leads to/becomes | ∀ = for all | ∃ = exists | & = and | | = or -->

# Stage 07: Verification Before Completion

Use when about to claim work is complete, fixed, or passing — requires running verification commands and confirming output before making any success claims; evidence before assertions always.

Claiming work is complete without verification is dishonesty, not efficiency.

## Inputs
- Layer 4 (working): Source code
- Layer 4 (working): `specs/SPEC.md`
- Layer 4 (working): `specs/IMPLEMENTATION_PHASES.md`

## Process

**Core principle:** Evidence before claims, always.

**Violating the letter of this rule is violating the spirit of this rule.**

### The Iron Law

```
NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE
```

If you haven't run the verification command in this stage, you cannot claim it passes.

### The Gate Function

```
BEFORE claiming any status or expressing satisfaction:

1. IDENTIFY: What command proves this claim?
2. RUN: Execute the FULL command (fresh, complete)
3. READ: Full output, check exit code, count failures
4. VERIFY: Does output confirm the claim?
   - If NO: State actual status with evidence
   - If YES: State claim WITH evidence
5. ONLY THEN: Make the claim

Skip any step = lying, not verifying
```

### Common Failures

| Claim | Requires | Not Sufficient |
|-------|----------|----------------|
| Tests pass | Test command output: 0 failures | Previous run, "should pass" |
| Linter clean | Linter output: 0 errors | Partial check, extrapolation |
| Build succeeds | Build command: exit 0 | Linter passing, logs look good |
| Bug fixed | Test original symptom: passes | Code changed, assumed fixed |
| Requirements met | Line-by-line checklist | Tests passing |
| UI looks correct | Stage 06 VAT screenshot evidence | Code inspection, "CSS looks right" |

### Red Flags - STOP

- Using "should", "probably", "seems to"
- Expressing satisfaction before verification ("Great!", "Perfect!", "Done!", etc.)
- About to claim completion without verification
- Relying on partial verification
- Thinking "just this once"
- **ANY wording implying success without having run verification**

### Key Patterns

**Tests:**
```
✅ [Run test command] [See: 34/34 pass] "All tests pass"
❌ "Should pass now" / "Looks correct"
```

**Build:**
```
✅ [Run build] [See: exit 0] "Build passes"
❌ "Linter passed" (linter doesn't check compilation)
```

**TypeScript Compilation:**
```
✅ [Run `npx tsc --noEmit`] [See: exit code 0] "No TypeScript errors"
❌ "Build passes" (if the build tool like Vite skips typechecking)
```

**Requirements:**
```
✅ Re-read plan → Create checklist → Verify each → Report gaps or completion
❌ "Tests pass, phase complete"
```

## Outputs
- Terminal output of tests/builds
- Final verified output
- `specs/.sdd-state.json`

Upon success, update `specs/.sdd-state.json` (schema: `specs/.sdd/_config/sdd-state.json.template`) to record complete verification, then notify the user that the SDD pipeline is complete for this iteration!
