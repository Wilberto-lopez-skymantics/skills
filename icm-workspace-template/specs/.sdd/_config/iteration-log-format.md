# Iteration Log Format

Shared format templates for adversarial swarm and development swarm iteration logs. Referenced by:
- `adversarial-swarm-analysis/SKILL.md` — Red Team attack iteration logs
- `development-swarm/SKILL.md` — Builder vs. Critic iteration logs

---

## Adversarial Swarm Iteration Log

```markdown
## 🔄 Iteration N

### Blue Team Draft Changes
[What was added or modified in this pass]

### Red Team Findings
| Finding # | Attacking Persona | Section Attacked | Flaw/Ambiguity | Severity |
|-----------|-------------------|------------------|----------------|----------|
| ...       | ...               | ...              | ...            | ...      |

### Resolution Actions
| Finding # | Resolution | Escalation Required? |
|-----------|------------|----------------------|
| ...       | ...        | Yes/No               |

### Verdict: PASS / FAIL (N findings remaining)
```

## Development Swarm Iteration Log

```markdown
## 🔄 Development Iteration N for [Filename]

### Blue Team Draft/Fix
[Summary of the code written]

### Red Team Findings
| Line/Function | Attacking Persona | Vulnerability / Bug / Flaw |
|---------------|-------------------|----------------------------|
| ...           | ...               | ...                        |

### Verification Evidence
[Paste output of terminal command used to test the code, e.g., pytest, npm test, or curl]

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

- Every iteration MUST be printed to the user in the format above. You are FORBIDDEN from claiming you "internally looped."
- You MUST use Markdown Tables for findings, not bullet points.
- If any iteration log is missing or summarized as "resolved internally," the entire swarm run is invalid.
