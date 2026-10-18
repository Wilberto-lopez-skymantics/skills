# Gap Register Format (`specs/GAPS.md`)

Working file, never frozen. One row per question the spec does not yet answer, per uncited prototype decision, and per feature deferred to a later slice. `sdd.cjs status` and `sdd.cjs readiness` count the rows; `sdd.cjs transition` validates them (03p: well-formed; 04: no `open` row).

```markdown
# Gaps

| ID | Stage | Kind | Gap | Draft assumption | Status |
|---|---|---|---|---|---|
| G-001 | 01 | policy | Who may delete a shared note? | Owner only (DEC012, provisional) | open |
| G-002 | 02 | technical | Sort order of equal `updated_at` values | id ascending (profile ORD-2) | resolved |
| G-003 | 03p | builder | Toast text after save | "Saved" | confirmed |
| G-004 | 01 | policy | Tags on notes | out of slice 1 (DEC006) | deferred |
```

- **ID**: `G-` + zero-padded number, unique for the life of the project (never renumber).
- **Stage**: the stage that found it (`01`, `01b`, `02`, `03`, `03p`, `04`, `05`, `07`).
- **Kind**: `policy` (needs the user) | `technical` (the swarm resolves via the Equivalence Profile) | `builder` (an observable prototype decision no spec line pins) | `ui` (layout, copy, state not in DESIGN.md / wireframes) | `oracle` (an expected value the oracle author could not cite).
- **Draft assumption**: what the prototype does, or the provisional answer, with its DECnnn when one exists. A `deferred` row must cite the DECnnn that moved it to a later slice (the gate checks the id exists in `specs/DECISION_LOG.md`).
- **Status**: `open` | `resolved` (the spec now pins it; cite the section in the Gap or Draft assumption cell) | `confirmed` (the draft assumption was accepted into the spec as-is) | `deferred` (later slice).

Rules:
- A gap is closed by editing the spec, never by editing only this file.
- Stage 04 refuses to finish while any row is `open`; the freeze summary lists every `deferred` row with its DECnnn.
- Stage 07's handoff lists the `deferred` rows as candidates for the next slice; Stage 01 of the next iteration starts from them.
