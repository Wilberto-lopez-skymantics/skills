# Iteration Log Format

Shared format templates for adversarial swarm and development swarm iteration logs. Used by:
- Stage 02 — appended to `specs/logs/02-swarm.md`
- Stage 05 — appended to `specs/logs/05-swarm.md`

Logs are persisted to those files (the audit trail); the chat shows a summary. Logs are working files, never builder inputs: a Stage 05 builder ⊥ reads `02-swarm.md` (spec-only rule).

---

## Adversarial Swarm Iteration Log

```markdown
## 🔄 Iteration N (round N of max 3 — full | delta)

### Blue Team Draft Changes
[What was added or modified in this pass]

### Red Team Findings
| Finding # | Attacking Persona | Section Attacked | Blocking / Advisory | Fork (request → observation A vs B) | Flaw/Ambiguity |
|-----------|-------------------|------------------|---------------------|--------------------------------------|----------------|
| ...       | ...               | ...              | Blocking            | `POST /x {..}` → 409 vs 422          | ...            |
| ...       | ...               | ...              | Advisory            | — (no observable fork)               | ...            |

Blocking = a concrete request whose observation two spec-faithful builders could legitimately differ on. No fork → Advisory (backlog, never blocks the round).

### Resolution Actions
| Finding # | Kind (Technical / Policy) | Resolution | Ruling (`specs/logs/02-rulings.md` R-nnn) | Escalation Required? |
|-----------|---------------------------|------------|-------------------------------------------|----------------------|
| ...       | ...                       | ...        | R-nnn                                     | Yes → batched user question (DECnnn) / No |

### Machine Validation
[Paste `node specs/.sdd/scripts/sdd.cjs check --contracts` output]

### Verdict: PASS / FAIL (N blocking findings remaining; M advisory → backlog)
```

The final iteration additionally contains the **Outcome Table** consumed by Stage 04:

```markdown
### Outcome Table
| Operation / command | Outcome | Status / exit | Error code | Trigger |
|---------------------|---------|---------------|------------|---------|
| createOrder | created | 201 | — | valid body, new Idempotency-Key |
| createOrder | invalid body | 422 | VALIDATION_ERROR | qty < 1 |
```

## Development Swarm Iteration Log

```markdown
## 🔄 Development Iteration N for Phase P

### Decision Inventory
[New rows added to `specs/logs/05-decisions.md` for this phase, or "none"; every SCR draft opened]

### Blue Team Build
[Files written or changed; the oracle loop: `oracle.cjs run --phase P` runs and what each fix addressed]

### Oracle Evidence
[Paste the final `node specs/.sdd/scripts/oracle.cjs run --phase P` output: 0 failed, 0 errored (and build/typecheck output)]

### Red Team Findings (what the oracle cannot see)
| Line/Function | Attacking Persona | Vulnerability / Bug / Flaw | Fixed? |
|---------------|-------------------|----------------------------|--------|
| ...           | ...               | ...                        | yes / SCR-nnn |

### Verdict: PASS / FAIL
```

## Reconciliation Report

```markdown
## 🔁 Post-Implementation Reconciliation Report

| Spec Section | Spec Says | Code Actually Does | Drift? |
|--------------|-----------|-------------------|--------|
| ...          | ...       | ...               | ✅ / ❌ |
```

## Swarm Completion Report

```markdown
## Swarm Log
| File | Attacking Persona | Vulnerability Prevented | Severity | Blue Team Fix |
|------|-------------------|-------------------------|----------|---------------|
| ...  | ...               | ...                     | ...      | ...           |
```

---

## Rules

- Every iteration MUST be written in full, in the format above, to the stage's log file (`specs/logs/02-swarm.md` | `specs/logs/05-swarm.md`); the chat shows a summary. You are FORBIDDEN from claiming you "internally looped."
- You MUST use Markdown Tables for findings, not bullet points.
- If any iteration log is missing or summarized as "resolved internally," the entire swarm run is invalid.
- Adversarial rounds all run in Stage 03p with the prototype running: round 1 attacks the whole slice; rounds 2–3 only the delta (changed sections + rows of the rulings ledger + uncited prototype decisions). Stage 02 writes only the Outcome Table into `specs/logs/02-swarm.md`; rounds are appended there. A finding that re-opens a ruled item without a new fork is out of order. Hard cap 3 rounds per iteration: blocking findings left after round 3 go to the user (one question per message, with a recommendation), not to a round 4.
- Development iterations are per phase, not per file: the oracle run is the loop's inner check; the Red Team reviews once per phase, after the oracle is green, for what the oracle cannot observe.
