# Classifying decisions and writing requirements

## The four buckets

Every decision in `specs/DECISION_LOG.md` lands in at least one bucket. When its parts fall in different buckets, split it into lettered parts (a, b, …) and classify each part on its own traceability row.

| Bucket | Meaning | Goes to |
|---|---|---|
| **1 System requirement** (including constraints and interface requirements) | What the system must do or be at its boundary: behavior users, operators or external systems observe; qualities (performance, security, availability, retention, usability, accessibility); external interfaces; constraints imposed by stakeholders | `02-system-requirements.md`, `06-external-interfaces.md` |
| **2 Software design** | How requirements are realized internally; it could change without changing anything observed | `03-design-decisions.md`, `04-architecture.md` |
| **3 Programmatic or process** | Method, sequencing (slices, roadmap), verification strategy (L1/L2), handling of unknowns (`[PENDING-SME]`, parked topics) and legacy questions (`[N/A-LEGACY]`) | `01-system-overview.md` (roadmap), README (process), the traceability table |
| **4 Clarification** | Only clarifies or amends another decision (e.g. "Clarification of DEC059") | Folded into the decision it clarifies; the row says which |

### The test that decides bucket 1 vs bucket 2

If two compliant implementations could differ in what a user, operator or external system observes, it is a requirement. SPEC §9 (Equivalence Boundary) draws exactly this line:
- everything it lists as an observable surface is requirement territory
- everything it lists as an internal freedom is design

The systems engineer will recognize this as the system boundary.

Boundary cases already settled in this package:
- **The HTTP API and the event stream** are the system's machine interface: the web app, the verification harness and data producers use them, and SPEC §9 lists them as observable. Their externally visible behavior is requirement material (bucket 1, often an interface requirement). Their internal realization is design.
- **Algorithms whose results users see** are functional requirements, sometimes called derived requirements. Examples: the reference trajectory model, alert hysteresis, counting rules. When the decision is `[PENDING-SME]`, their constants are TBR.
- **The technology stack, module boundaries, storage layout, worker threads and incremental-computation strategy** are design (bucket 2), even when the spec mandates them for builders.
- **Slicing and roadmap decisions** are programmatic. Their scope *content* (what slice 1 must do) still produces requirements.

### What a new decision does to earlier ones

The decision log is append-only. When experts answer a question, or the team changes its mind, a **new** decision cites the earlier one; the earlier row keeps its tags. `pkg.py impact` reports these as "earlier decisions cited by new ones". Read both rows and decide:

| The new decision… | Do this |
|---|---|
| Confirms a working assumption | Close the TBR entry ("Closed in rev N — confirmed by DECnnn"). Set affected requirements to **Agreed** unless another open TBR still holds them. Add the new DEC to their Source. |
| Refines it (same intent, new value or detail) | Edit the affected items in place, keep their IDs, and add the new DEC to Source. If the TBR is now settled, close it. |
| Reverses it, or changes what a requirement means | Withdraw the old items ("replaced by …") and create new items with new IDs. Cross-reference both. Close the TBR as "reversed by DECnnn". |
| Opens a new working assumption (`[PENDING-SME]`) | Open a TBR entry. Mark the affected requirements **TBR** with a link. |
| Is a clarification | Bucket 4. Fold it into the item it clarifies, and add it to that item's Source. |

## Writing a requirement

- **One "shall", one capability, at the system boundary.** The subject is the system as a whole ("Zenith shall …"), never a module or a table.
- **No design.** Don't name the stack, modules, tables, threads or protocols chosen internally. `check` warns on common design terms.
- **Verifiable as written.** Use exact values, or name the configuration variable whose default gives the value. Don't use "fast", "about" or "periodically".
- **Capability level.** SPEC.md holds the detailed rules. The requirement cites the invariants (`Vn`) that elaborate and verify it; it doesn't copy them. Every invariant must be cited by at least one requirement.
- **Traceable.** Source lists the decisions it states. SPEC lists the sections that hold the detail, naming the sub-heading so impact analysis stays precise.
- **Status:**
  - **Agreed** when nothing it rests on is pending.
  - **TBR** when any part rests on a `[PENDING-SME]` working assumption. Name what is assumed and link the TBR entry.
- **Allocated to:** the components that realize it.

## Verification methods

| Method | Means here | Typical requirements |
|---|---|---|
| **Test** | Oracle HTTP cases and frozen UI specs (`oracle.cjs`, Stage 04 onward). Cite case ids once fixtures exist. | Functional behavior, interfaces, permissions, data rules |
| **Demonstration** | Stage 06 visual acceptance, or the Stage 07 full-volume load demonstration | Display behavior judged visually; throughput under load |
| **Analysis** | Evidence evaluated against a threshold: contrast ratios, performance measurements, sizing | Performance targets, accessibility contrast |
| **Inspection** | Review of artifacts or configuration | Constraints (stack, deployment contract, retention settings) |

## TBR entries

There is one TBR entry per `[PENDING-SME]` decision. A decision only partly pending gets one too, marked `*(partly pending)*`. Each entry states:
- the working assumption
- the impact if experts reverse it
- the affected requirements
- exactly what experts must confirm or supply (samples, schemas, values)

`specs/logs/01-sme-review.md` is the experts' agenda; when it changes, re-read the matching TBR entries.

## Gaps

Record a gap when the sources are silent or inconsistent: two sections that disagree, a value nobody pinned, a behavior the decisions imply but the spec omits. Each gap names where (`§…`) and how it was found. Gaps are also spec feedback: mention new ones in the final report, so the user can route them through the SDD process (Step 10 review fixes, or a Stage 00 change request after the freeze).
