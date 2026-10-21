# SDD terms for a systems engineer

Use this mapping when writing the README, the overview or the changelog, or when explaining the process. In this repo "SDD" means Spec-Driven Development, not Software Design Description, so avoid that acronym in the package.

| SDD workspace | Systems-engineering equivalent |
|---|---|
| `specs/SPEC.md` (§0–§14) + `specs/spec/*.md` modules | The requirements baseline at full detail: a system/software requirements specification with the behavioral rules; a module is a chapter of it with the same authority |
| SPEC §8 invariants (`Vn`) | Detailed, individually verifiable requirements. The package's "shall" statements cite them. |
| SPEC §9 Equivalence Boundary | The system boundary: what is observable (requirement territory) vs internal freedom (design) |
| `specs/DECISION_LOG.md` (`DECnnn`) | The decision record: trade studies, rationale and stakeholder rulings. It is append-only, and later decisions cite the ones they change. |
| `specs/contracts/` (Stage 03: `openapi.yaml`, `statecharts.json`, `schema.sql`, `errors.json`, `manifest.json`) | Interface control documents and design-level data and behavior models, compiled against the accepted prototype |
| `specs/wireframes/` + `specs/DESIGN.md` (Stage 03, captured from the prototype) | The user-interface design baseline: screens, states, test ids, copy, tokens |
| `specs/fixtures/` and `oracle.cjs` (Stage 04) | Verification procedures and the automated test harness. "Test" in this package means an oracle case; a case's `derivedFrom` is its requirement trace. |
| `specs/logs/oracle/run-*.json` (bound to a lock hash) | Verification execution records: the evidence behind "verified" in chapter 10. A run on another lock is not evidence. |
| Freeze (`sdd.cjs freeze`, `spec.lock.json`) | Establishing the configuration baseline, under change control; the lock's history is the baseline history |
| `specs/logs/transitions.jsonl` | The milestone record: which stage completed when, who accepted the prototype |
| Prototype versions (`specs/logs/02-prototype.md`) | Demonstrations to the product owner; each version row is a demo and its outcomes |
| Class 1 iteration (Stages 01→04, then re-freeze) | An engineering change proposal that adds or changes observable behavior |
| Stage 00 Spec Change Request (`specs/changes/SCR-*.md`) | A problem report or change request against the baseline, approved by the product owner; classes A–E say what was wrong |
| `specs/GAPS.md` | The open-items register of the project (policy questions, uncited prototype decisions, deferred features); the package mirrors it |
| Red Team rulings (`specs/logs/03-rulings.md`) | Design review findings with dispositions (fixed, rejected, advisory, gap) |
| Review comments on this package (`12-review-log.md`) | Reviewer findings; each accepted one becomes an SCR or a gap row, never a package edit |
| `[PENDING-SME]` working assumption | TBR (to be reviewed): a value or rule assumed until domain experts confirm it |
| `[N/A-LEGACY]` | A legacy question ruled not applicable |
| L1 oracle-conformant | Verified: the build passes every verification procedure against the current baseline |
| L2 equivalence-verified | Two independent builds give identical observations: evidence the specification is unambiguous |
| Slices (roadmap) | Incremental releases; each slice is a baseline increment |
| Stages 01–07 (pipeline v3.4+) | 01 requirements discovery (short interview, slice brief, draft spec) → 02 prototype demonstration and acceptance → 03 hardening (interface definition, design review, UI baseline captured from the prototype) → 04 verification design and baselining (freeze) → 05 implementation → 06 visual acceptance → 07 verification and certification |
