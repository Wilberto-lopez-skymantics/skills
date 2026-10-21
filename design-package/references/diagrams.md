# Diagrams

## Catalog (example: the Zenith project, slice 1)

A new project writes its own catalog in this shape — one row per diagram family with its kind, what it shows and its main sources — at Build. The families below (context, component, deployment, data, activity, state, sequence) are the expected minimum for a fullstack service; a CLI or library drops the UI families.

| ID | Kind | Shows | Main sources |
|---|---|---|---|
| ZEN-DIA-01 | Context | Zenith as a black box: actors by role, external data sources, file imports, browsers, dashed future identity provider and GitOps deployment, the verification harness; every `ZEN-IF` labeled | SPEC §0.1–§0.2, §3; interface table |
| ZEN-DIA-02 | Component | `zenith-server` modules, web app, PostgreSQL + PostGIS, reverse proxy; dependencies labeled with what flows | SPEC §0.2–§0.4 |
| ZEN-DIA-03 | Deployment | The three units, ports 443/8080/5432, local compose vs the image contract deployed by GitOps | SPEC §0.2, §10, §12 |
| ZEN-DIA-04a/b | Class (data) | Core entities and their relationships: sources, records, flights, reference data, monitoring; users, roles, sharing, workspace | SPEC §4, §6 (later `schema.sql`) |
| ZEN-DIA-05a–e | Activity (swimlanes) | Live intake to browser refresh; a traffic manager handles an alert; reference-data import; replay and synthetic sessions; feed loss and freshness | SPEC §0.4, §5 |
| ZEN-DIA-06a–d | State machine | Alert cell, flight leg, synthetic session, reference-data version | SPEC §4 statecharts (later `statecharts.json`) |
| ZEN-DIA-07a/b | Sequence | Browser update (SSE notice → delta read; gap → snapshot); a user-action round trip | SPEC §0.4, §5.5 |

New behavior that none of these shows gets a new member of the right family (next letter), or a new family (next number). Add a row to the README diagram index, and describe the diagram in `05-behavior.md` (behavior) or `04-architecture.md` (structure).

## How the files are built

- One diagram per `.drawio` file, named `ZEN-DIA-<id>-<kind>-<slug>.drawio`.
- The XML is plain and **uncompressed**, written through the draw.io MCP. Keep it that way: line diffs stay readable in review, and `pkg.py` reads the title blocks to map each diagram to its sources.
- Pages are A3 landscape (1654 × 1169), with a white background and black text and strokes.
- **Cell IDs are semantic and stable** (`zen`, `title`, `legend`, `act-ingest`, `st-red`, …). Updates edit existing cells and keep their IDs. Add new cells with new semantic IDs; never regenerate a diagram from scratch when an edit will do, because regeneration churns every ID and position.
- **The `title` cell** carries:
  - the diagram ID and title
  - `Date: YYYY-MM-DD · Source: specs/SPEC.md at commit <short> (Draft revision N; SPEC.md is authoritative)`
  - `Depicts:` the SPEC sections, operations and invariants (ranges allowed, e.g. `V27–V32`)
  - `Decisions:` the DEC ids, with `(TBR)` after those still pending

  `pkg.py` reads the DEC ids, § refs and V ids from this file, so keep them accurate. When an update touches the diagram, refresh the date, commit and revision.
- **The `legend` cell** explains every shape, line style and marker used. Meaning is never carried by color alone.
- The MCP has no image export, so the package links the `.drawio` files (diagrams.net or an IDE extension opens them). If a later MCP version can export SVG, add `<file>.svg` next to each diagram and embed it in the markdown.

## Notation

- **Context and component:** UML-style boxes. `«system»` and `«external»` stereotypes. A cylinder for the database. Dashed outlines for future or out-of-scope elements. Every connector labeled with its data and protocol.
- **Activity:** swimlanes per actor or component; rounded actions; diamonds with a guard on every branch (`[jurisdiction ok]`); fork and join bars for parallel work; initial and final nodes.
- **State machine:** rounded states; transitions labeled `event [guard] / action`; initial and final markers; terminal states named. The states and transitions come from the SPEC statechart, or from `statecharts.json` once it exists. Don't add states the spec doesn't have.
- **Sequence:** lifelines for the browser, `api`, the modules involved and the database; synchronous and asynchronous messages distinguished; gaps and retries shown as `alt` or `opt` frames.
- **Size:** split any diagram that passes about 25 nodes into family members.

## Using the draw.io MCP

1. Load the tools with ToolSearch: "drawio", then "draw.io" or "diagram". Read their schemas: they decide whether you create from XML, Mermaid or CSV, and whether you can edit an existing file.
2. **Create:** produce the diagram through the MCP and save the resulting XML to `diagrams/<file>.drawio`.
3. **Update:**
   - open the existing `.drawio` file
   - change only the cells the spec change affects (labels, added or removed nodes and edges)
   - keep every other cell's ID and geometry
   - pass the result through the MCP so it renders, then save it
   - if the MCP can only create from scratch, give it the edited full XML; never ask it to redraw from a description, because that loses the stable IDs and layout
4. **Verify:** after saving, check that the title block, legend and labels match the spec. Then run `pkg.py check`: it confirms every indexed diagram file exists and is linked.
5. **No MCP:** finish the text work, mark each affected diagram `pending redraw (rev N)` in the README index and the changelog, and tell the user. Don't hand-edit the XML unless the user agrees.
