# Reference Example: Notes Service

**This is not your project.** It is a small, complete frozen spec set that shows what the pipeline's outputs look like when they are done right. Imitate its structure and level of precision, not its domain.

| File | Shows |
|---|---|
| `specs/SPEC.md` | `spec-template.md` filled in: invariants as `- **Vn:**`, an explicit Equivalence Boundary, no restated contract content |
| `specs/DECISION_LOG.md` | Policy decisions with the frozen artifact each one is reflected in |
| `specs/contracts/manifest.json` | Project type, artifacts, a justified coverage exemption |
| `specs/contracts/openapi.yaml` | Every operation with an `operationId` and every response status enumerated; shared problem response; `additionalProperties: false` |
| `specs/contracts/errors.json` | Canonical codes with profile statuses plus one domain code |
| `specs/contracts/statecharts.json` | A lifecycle with a guarded transition, terminal retention and the illegal-transition error |
| `specs/contracts/schema.sql` | OCC `version`, millisecond timestamps, keyset index, idempotency table |
| `specs/fixtures/oracle.config.json` | Targets via `${ENV}`, reset hook, `buildEnv` (ENV-5 delay, ENV-6 timestamp granularity), `variablePaths` mirroring SPEC §9 |
| `specs/fixtures/cases/*.json` | 55 derived cases: exact problem bodies, idempotency replay/mismatch/in-flight (`parallel`), OCC 428/412 and a concurrent race, pagination with tie-breaker and an exactly-full last page, validation ordering, precedence, unknown query parameters, empty headers, code-point lengths, NFC normalization, round-trips |
| `specs/fixtures/cases/generated-probes.json` | 100 probes produced by `oracle.cjs gen-probes` (item probes create a real note first) |
| `specs/IMPLEMENTATION_PHASES.md` | Phases bound to cumulative `oracle.cjs run --phase N` |
| `specs/GAPS.md` | Gap register: a deferred feature citing its DECnnn, a technical gap resolved via the profile, two prototype decisions confirmed into the contracts |
| `specs/logs/03-rulings.md` | Rulings ledger across rounds 1 and 2 (Stage 03, prototype running): fixed, rejected, advisory and gap rows with their forks |
| `specs/logs/02-prototype.md` | Prototype record (Stage 02): the `Run:` line Stages 03 and 04 start the prototype with, and the Versions table (one row per demo); acceptance lives in `transitions.jsonl`, not here |
| `specs/logs/01-interview.md` | Interview log: one row per question asked, with its answer and the decision or gap it became |
| `specs/logs/03-decisions.md` | Prototype Decision Inventory (Stage 03): every observable decision with its SPEC / contract / profile citation or the gap it opened |

Validated: `node specs/.sdd/scripts/sdd.cjs check --root specs/.sdd/_config/examples/notes-service` passes with full coverage (30/30 operation outcomes, every transition, invariant and error code, 254/254 response fields pinned). The cases were run against an independent reference implementation (55/55 green, stable across repeated runs including the concurrent cases); `oracle diff` between two instances of it reported zero divergences over all 155 cases and probes — also when one instance emits JSON keys in a different order — while variants that drop the id tie-breaker, the `has_more` look-ahead or NFC normalization were each caught.

The shipped `oracle.config.json` resets a PostgreSQL database (`psql … TRUNCATE`); point the targets' `DATABASE_URL` at a scratch database to run it against your own build.
