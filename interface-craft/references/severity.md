# Severity

One scale for every finding, whichever source the rule came from. The sources each have their own
words; this file maps them onto ours so that a finding means the same thing to a worker, a
reviewer and the person reading the report.

## The scale

Severity is decided by what happens to the person using the screen, not by which rule was broken
or how strongly a source words it.

| Level | What happens to the person |
|---|---|
| **blocker** | They cannot finish the task, or they are misled into harm (lost data, a wrong payment, something sent or deleted they did not mean). |
| **major** | They finish, but only with real difficulty, a workaround, or doubt about whether it worked. |
| **minor** | A hesitation or a cost they notice and get past. |
| **polish** | They would not notice it as a problem, but the screen would be better without it. |

To place a finding, finish this sentence: "Because of this, the person ...". If you cannot finish
it, you do not have a finding (see "Evidence, not taste").

A person who relies on a keyboard, a screen reader, zoom or reduced motion is a person. "Cannot
finish" includes them: a control the keyboard cannot reach is a blocker for the task it gates.

## Mapping the sources' words

| Source | Its word | Its meaning | Ours |
|---|---|---|---|
| jakub `better-interface` | `HIGH` | Blocks a task, misleads, hides content or controls, risks data loss, or a failure repeated across the system. Includes its 13 escalation triggers | **major**, or **blocker** when the task cannot be finished or the person is misled into harm |
| jakub `better-interface` | `MEDIUM` | Meaningfully harms comprehension, efficiency, adaptability or consistency | **minor**, or **major** when it leaves the person in real difficulty or doubt |
| jakub `better-interface` | `LOW` | Isolated polish | **polish** |
| jakub `better-interface` | Verdict `Block` / `Approve` | Block while any `HIGH` remains | Not used. The decision to stop or go on belongs to whoever runs the review (a threshold, a person) |
| jakub `interface-review` | `Introduced` / `Regression` / `Pre-existing` | Whether the change under review caused the finding | Not a severity. Keep it as a separate note when reviewing a change |
| jakub `break` | Broken scenarios first, no levels | A scenario that broke the component | Place by the scale above |
| emil `review-animations` | Escalation triggers ("flag on sight") | Code patterns its author always rejects | See "emil's lists" below |
| emil `review-animations` | Impact tiers: feel-breaking regressions; missed simplifications; performance; interruptibility and timing; origin, physicality and cohesion; accessibility | Ordering of its commentary | See "emil's lists" below |
| emil `review-animations` | Verdict `Block` / `Approve` | Block on any feel-breaking regression | Not used |
| emil `improve-animations` | `HIGH` feel-breaking; `MEDIUM` noticeably off; `LOW` polish | Motion audit levels | `HIGH` -> **minor**, or **major** when the person has to wait or loses track of what changed. `MEDIUM` -> **minor**. `LOW` -> **polish** |
| emil `break-ui` | `Broken` (unreadable, unreachable, wrong data) | | **major** or **blocker** |
| emil `break-ui` | `Ugly` (readable but visibly wrong) | | **minor** |
| emil `break-ui` | `Fragile` (fine now, one step from breaking) | | **polish**, or **minor** when the step is ordinary data (a long name, zero items) |
| emil `emil-design-eng` | Before / After / Why table, no levels | | Place by the scale above |
| owl (all six files) | No scale. "Common mistakes" and "never" lists | | Place by the scale above |

### emil's lists

emil's review files grade motion in code and by feel, and they are strict on purpose. Mapped onto
what happens to the person:

- **Accessibility tier** (movement that ignores reduced motion): **major** on sight. It is on the
  list in `review-standards.md`.
- **Interruptibility and timing** where the person must wait for motion before acting, or motion
  delays an action they repeat all day or start from the keyboard: **major** when they are made
  to wait, otherwise **minor**.
- **Performance** (dropped frames the person can see): **minor**; **major** when the screen
  stalls long enough that they doubt it took their input.
- **Feel-breaking regressions, origin, physicality, cohesion** (ease-in, growing from nothing,
  wrong origin, weak curves): **polish**, or **minor** when the motion points somewhere false
  (a menu that opens from the wrong place).
- **Missed simplifications** (motion that could be deleted): **polish**.
- Patterns that can be seen only in the code (`transition: all`, animating layout properties,
  keyframes on rapidly triggered elements): rules for the worker who writes the code. They become
  findings only through a visible effect.

## Rules for every finding

**Evidence, not taste.** A finding names what was seen, where, and what it costs the person. A
failure on the major-on-sight list is a failure whatever the style guide says. A density, a
radius or a voice you merely disagree with is not a finding.

**A check you cannot run is "not verified".** It is never a finding and never a pass.

**A recorded decision settles taste, never a failure.** A choice in the project's
`design-decisions.md` is not an issue. It does not excuse anything on the major-on-sight list or
anything that stops or misleads a person.

**One root cause is one finding.** List every place the cause shows inside that one finding. The
same low-contrast token on forty screens is one finding with forty locations, not forty findings.

**A token or shared-component fix outranks the same symptom in one leaf.** When a cause is
shared, report it and fix it at the shared level. A finding that names the token or component is
worth more than one that names a single screen, and a fix made once at the source is preferred to
the same fix repeated per screen.

**Systemic raises severity one level, at most.** A minor problem that repeats on every screen may
be reported as major, because the cost adds up for the person. Polish does not become major by
being frequent.

**Do not pad.** A short list of findings that are real is the goal. "Nothing found for this
criterion" is a complete answer. The source review method caps a review at 15 findings; when
there are more, keep the most severe and say how many were left out.

**Order findings** by severity, and within a level by how many people and steps they touch.
