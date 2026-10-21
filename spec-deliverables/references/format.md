# Output format and provenance

Every deliverable is a folder under `docs/` with markdown chapters, a `baseline.json` and a compiled `index.html`. The markdown is the document; the HTML is the same content as one page with a chapter list, for people who will not open a repository. Nothing in either is written by hand.

## Common conventions

- **Banner.** Every chapter opens with `> **Derived by \`deliver.cjs\` from the frozen spec set; do not edit by hand.** <what it was built from>`.
- **Baseline block** (README of each deliverable): spec title, pipeline version, lock version and hash (or "none: preview"), commit, generation time. `baseline.json` holds the same plus a hash of every input file; `check` compares it with the files now.
- **Links.** Chapters link each other by file name (`02-screens.md#main-window`); the compiler turns them into in-page anchors (`#02-screens--main-window`). Links into the spec set are relative (`../../specs/wireframes/startup.html`) and work from the repository and from the compiled page alike.
- **Clipping.** Long cells are clipped with `…` (descriptions ~220–320 characters, triggers 260, bodies 30–40 lines in examples); the spec set holds the full text. Clipping is never applied to the spec's rule text under an operation or to copy strings.
- **Markdown subset** the compiler renders: ATX headings, paragraphs, `-`/`1.` lists (nested by two-space indent, with indented tables and paragraphs under an item), pipe tables, fenced code, block quotes, `---`, inline code, bold, italic, links, and raw `<iframe>` lines.

## API reference (`docs/api-reference/`)

| File | Content |
|---|---|
| `README.md` | Title and version from `info`; counts; **Contents**; **Conventions** = `info.description` as paragraphs; **Authentication** = `components.securitySchemes` and the operations declaring `security: []`; **Operation index** (operation, method and path, purpose, number of outcomes) by group; baseline |
| `5-<n>-<title>.md` | One file per SPEC §5 subsection that names operations in backticks (`5-1-foundations.md`); **Common rules** when the subsection opens with a `**Common rules**` paragraph; then one `### \`operationId\`` section per operation |
| `ops-<tag>.md` | Operations SPEC §5 does not name, grouped by their first OpenAPI tag or first path segment |
| `errors.md` | `typeBaseUri` sentence; the `Problem` schema members; the catalogue (`code`, status, title, retryable, description); where each code can occur (from `x-outcomes`) |
| `schemas.md` | Every `components.schemas` entry: description, type and constraints, members (type, required, constraints, meaning), `oneOf` alternatives, array items |

Per operation: method and path with the summary (`summary`, else the first sentence of the SPEC paragraph that opens with `**\`operationId\`** —`, else of `description`); a two-column table (who may call it, from an `Actor: …` phrase; authentication; tags; the SPEC subsection); **Rules** = the SPEC paragraph's bullet list verbatim (else the OpenAPI description); **Parameters** (path-level and operation-level, dereferenced); **Request body**; **Responses**; **Every observable outcome** = `x-outcomes` rows; **Examples** = the first oracle step with a 2xx expectation and the first with a 4xx/5xx, matched by `matchOperation` (the oracle's own routing), request shown as sent (bearer tokens masked), response as expected; **Invariants exercised** = `Vn` cited in those cases' `derivedFrom`; **Oracle coverage** = case ids and the latest run's pass/fail count for them.

## User manual (`docs/user-manual/`)

| File | Content |
|---|---|
| `README.md` | Title, audience (the role columns of the SPEC §3 permission matrix), contents, **Screens at a glance** (title, first paragraph, wireframe link), baseline |
| `01-getting-started.md` | SPEC §14.2 verbatim through `readable()`; sign-in strings (copy keys matching login/sign-in/auth); link to the start-up screen |
| `02-screens.md` | Per DESIGN.md §Approved Wireframes entry (`### Title: [name](wireframes/file.html)`): wireframe link and `<iframe>`; the entry's paragraphs; **States shown** = the wireframe's `<h2>` frames; **What each part does in every state** = UI State Matrix rows whose component key is a `data-testid` of the wireframe; **Strings on this screen** = copy keys mentioned there, resolved |
| `03-roles-and-permissions.md` | SPEC §3 verbatim through `readable()` |
| `04-concepts.md` | SPEC §2 table (term, meaning); each §4.x heading with its opening paragraph |
| `05-messages.md` | The placeholders table of §14.4; the copy table split by key prefix (`platform`, `ui`, …) |
| `06-errors.md` | `errors.json`: title, code, first sentence of the description, advice by `retryable` and status |
| `07-administration.md` | SPEC §12 table; permission-matrix rows allowed to the Administrator column |

`readable()` turns `` `PascalCase` `` into words, replaces `` `area.key` `` with the copy-table text in quotes when the key exists, and drops `(DECnnn)` citations. Keys the copy table lacks stay as keys.

## Test plan (`docs/test-plan/`)

| File | Content |
|---|---|
| `README.md` | Contents; **Purpose and scope** with the item counts; **Strategy** (black-box, L1/L2 with `manifest.equivalenceTarget`, UI, phases, defects); **Environment** (prototype record `Run:`/`Target:` lines, `oracle.config.json` targets, build-environment count, setup hooks); **Entry and exit criteria**; **Status now** (latest run and its lock binding); baseline |
| `01-traceability.md` | Invariants → cases (`derivedFrom` `Vn` and `covers: inv:Vn`, `recorded:` citations excluded) with the manifest's `coverageExempt` entries shown as exempt and the exemption classes listed; operations → cases (by `matchOperation`); wireframes → browser specs |
| `02-procedures.md` | Suite table; per suite its description; per case `### ID — title`, phase, probe flag, latest status, `derivedFrom`, a step table (request, expectation with the error code and captures; parallel, query and run steps summarised) |
| `03-ui-procedures.md` | Per browser spec file: covers, test names, observed states (`observe(page, 'name')`), the browser run entry when `specs/logs/ui-e2e.json` has one |
| `04-schedule.md` | Per `## Phase N` of IMPLEMENTATION_PHASES.md: title, tasks done (`- [x]`), verification line, cases with that phase, latest result; cases bound to no phase |
| `05-results.md` | Latest unfiltered run on target `default` (else the newest): report, time, target, result, lock binding, mode, tool; failures with messages; run history; browser-run stats |

"Latest" everywhere means the newest unfiltered run on target `default` in `specs/logs/oracle/`; a run whose `lockHash` is not the current lock's is reported as *not evidence*.

## baseline.json

```json
{ "deliverable": "api", "generatedAt": "…", "pipeline": "2026.10.21-v3.5-prototype-first", "commit": "9b98b34",
  "lock": { "version": 1, "hash": "…" }, "inputs": { "specs/SPEC.md": "<sha256 prefix>", "…": "…" } }
```

`check` reports, per deliverable: a lock change, inputs changed, new or gone, a pipeline change. Exit 1 when any deliverable is stale.
