# Prototype Record Formats (Stage 03p)

Both files are working files under `specs/logs/`, never frozen. Build B never sees them.

## `specs/logs/03p-prototype.md`

```markdown
# Prototype record
**Run:** <single start command, e.g. `docker compose up -d` | `npm run dev`>
**Target:** <base URL / CLI entry the oracle config will use, e.g. `http://localhost:3000`>
**Build environment:** <SPEC §12 values the prototype was started with, or "profile defaults">
**Feedback rounds:** <n> (DEC ids)
**Hardening rounds:** <rounds logged in 02-swarm.md this iteration, e.g. 1 (02) + 2 (03p)>
**Acceptance:** recorded by `sdd.cjs transition --completed 03p --approved-by "<user>"` (see `specs/logs/transitions.jsonl`)
```

The `Run:` line is required by the gate: Stage 04 starts the prototype with it to record interpretation A. Acceptance is never written here; it is given on the command line by the user and recorded in `transitions.jsonl`.

## `specs/logs/03p-decisions.md` — Decision Inventory

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
- Adopted codebases: one row "existing system, characterized in 01b" is acceptable for behavior the characterization cases already pin.
- Stage 05 build A may copy this inventory as a starting point and must re-verify every citation against the frozen files (line numbers move at freeze). Build B writes its own.
