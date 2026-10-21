# Prototype Record Formats (Stages 02 and 03)

Both files are working files under `specs/logs/`, never frozen. Build B never sees them.

## `specs/logs/02-prototype.md` (Stage 02)

```markdown
# Prototype record
**Run:** <single start command, e.g. `docker compose up -d` | `npm run dev`>
**Target:** <base URL / CLI entry the oracle config will use, e.g. `http://localhost:3000`>
**Build environment:** <SPEC §12 values the prototype was started with, or "profile defaults">
**Feedback rounds:** <n> (DEC ids)
**Hardening rounds:** <rounds logged in 03-swarm.md this iteration (Stage 03), e.g. 2 (round 1 full, round 2 delta, zero blocking → stop)>
**Acceptance:** recorded by `sdd.cjs transition --completed 02 --approved-by "<user>"` (see `specs/logs/transitions.jsonl`)

## Versions
| Version | Date | Changed | Gaps closed | Decisions |
|---|---|---|---|---|
| v0 | 2026-10-10 | first demo: the slice from the brief, provisional answers from GAPS.md | — | — |
| v1 | 2026-10-11 | delete returns 204 empty; omitted body stored as `""` | G-003, G-004 | DEC005 |
| v2 | 2026-10-12 | tie-breaker on equal `updated_at`; out-of-slice button removed | G-002 | DEC006 |
```

The `Run:` line and at least one Versions row are required by the Stage 02 gate: Stages 03 and 04 start the prototype with the Run line (Red Team execution, wireframe capture, recording interpretation A), and every demo the user saw is one version row (budget 3 per slice, `manifest.budgets.prototypeVersions`; over is a signal, not a block). Acceptance is never written here; it is given on the command line by the user and recorded in `transitions.jsonl`.

## `specs/logs/03-decisions.md` — Decision Inventory (Stage 03)

Every observable decision the prototype makes (status, header, field value, ordering, message, default, limit, layout choice) with the spec line that pins it, or the `G-nnn` row it opened.

```markdown
# Prototype Decision Inventory

| # | Decision | Observation | Pinned by | Gap |
|---|---|---|---|---|
| 1 | Create returns the full note | `POST /notes` → 201, body = note | openapi createNote 201; SPEC §5.1 | — |
| 2 | List default page size | `GET /notes` → 20 items | profile PAGE-2 | — |
| 3 | Toast text after save | "Saved" | — | G-003 |
```

- **Pinned by**: SPEC §, contract (`openapi <operationId> <status>`, `errors.json <CODE>`, `statecharts <machine>`), or `profile <RULE-n>`. `recorded:` is not a citation.
- **Gap**: the `G-nnn` opened when nothing pins the decision (kind `builder`). The Draft assumption of that gap is the value the prototype chose.
- Adopted codebases: the inventory covers the slice being hardened; every row cites the draft spec Stage 01b wrote or opens a gap (`[TECH DEBT]` rows stay `builder` gaps until the user confirms them).
- Stage 05 build A may copy this inventory as a starting point and must re-verify every citation against the frozen files (line numbers move at freeze). Build B writes its own.
