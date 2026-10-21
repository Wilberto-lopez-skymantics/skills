# DECISION_LOG.md Template & Rules

This file defines the canonical template for `specs/DECISION_LOG.md`. It is used by:
- Stage 01 (`01_brainstorming`) and Stage 01b (`01b_adoption`) — create and extend it
- Stage 02 — records policy escalations and Equivalence Profile overrides
- `sdd.cjs check` — verifies every `manifest.json#profileOverrides[].decision` id exists here

`DECISION_LOG.md` is a working file (not frozen): it explains *why*. Every decision it records must also be reflected in the frozen set (SPEC, contracts, oracle) — a decision that lives only here is invisible to a builder and therefore not a decision at all.

---

## Template

```markdown
# Decision Log

| # | Decision | Options Considered | Choice | Rationale | Reflected in |
|---|----------|-------------------|--------|-----------|--------------|
| DEC001 | Example: Data storage | PostgreSQL, SQLite, localStorage | localStorage | Client-only app, no server required — user confirmed | SPEC §6, `storage.schema.json` |
| DEC002 | Example: Profile override PAGE-1 | clamp vs 422 | clamp `limit` to 100 | Legacy clients send 500 — user confirmed | `manifest.json#profileOverrides`, case ORD-031 |
```

## Rules

- Every decision made during brainstorming MUST appear in this table — even ones that felt obvious.
- If a decision was made by the user selecting from options, list all options considered.
- If a decision was made by the AI recommending and the user approving, note that in the Rationale.
- If a decision involves a numeric parameter, the Choice column MUST contain the exact value or range — not vague language.
- Ids are `DEC` + a zero-padded number (`DEC001`), never reused. Append new entries; never rewrite old ones — a reversed decision gets a new entry whose text says `supersedes DECnnn` (see below). Enforced: every `sdd.cjs transition` fingerprints the rows (`specs/logs/decisions.fingerprint.json`), and `check` and `status` warn when an earlier row is rewritten or removed. Derived artifacts (traceability, design packages, agendas) cite rows by id.
- A working assumption that someone outside the pipeline must confirm (a domain expert, a customer, legal) carries a `[PENDING-<ROLE>]` tag in its Decision cell (`[PENDING-SME]`); `sdd.cjs agenda` collects them by role with the open policy gaps. The answer is a new entry that supersedes the tagged one.
- **Supersession.** A row whose text contains `supersedes DECnnn` (case-insensitive; several ids allowed: `supersedes DEC007, DEC009`) replaces those rows: they stay in the log, but `sdd.cjs agenda`, `readiness` and the dashboard no longer count a `[PENDING-<ROLE>]` row that is superseded. This is the only way an answered assumption leaves the agenda — merely citing the id (`experts confirmed DEC007`) is not an answer, and `sdd.cjs check` warns when a later row cites a pending row without that word. `check` errors when `supersedes` names an id that is not in the log. Example: `| DEC010 | Ghost timeout: 7 min — supersedes DEC007 | 5, 7 | 7 min | experts confirmed 2026-10-21 | SPEC §4 |`.
- "Reflected in" names the SPEC section, contract or oracle case that makes the decision observable to a builder.
