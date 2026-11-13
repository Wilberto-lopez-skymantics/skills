# The work-and-review loop

A landing page is worked on and reviewed by different agents that never share a context. The worker
uses this skill. The reviewers are fresh agents who are handed pictures and measurements of the page,
one rubric each, and nothing about how the page was made. The loop runs until every reviewer role
reaches the threshold the owner set, or until it stops gaining.

The reviewing is done by the `ux-quality-score` skill, which must be installed beside this one. This
file says only what is different for a landing page; everything else (isolation rules, the commands,
second looks, how scores combine, when a loop stops) is in that skill's `SKILL.md` and
`references/config.md`, and holds here unchanged.

```
page brief ──► worker builds or fixes the page (this skill)
                      │
                      ▼
               capture the page          pictures, text and measurements at every screen size
                      │
                      ▼
        six kinds of blind reviewer      conversion, copy, brand, accessibility, responsive, visitor
                      │
                      ▼
          scorecard and fix order ──► every role at the threshold? ── yes ──► done
                      │ no
                      └──► worker fixes, in fix order ──► capture again, new reviewers
```

## What is different for a landing page

**The reviewers.** Not the six that review a product. `review/` in this skill is a reviewer set:

| Role | Reviews | Criteria |
|---|---|---|
| `conversion` | Whether the page brings a visitor to the one action: the promise, the action, the proof, the order of the argument, what is asked and what follows | K1 to K11 |
| `copy` | The words: the headline, what is specific, what is true, what the buttons say, what was left unfinished | W1 to W10 |
| `brand` | Whether the page is this brand's and looks finished: type, colour, shape, the eye's path, pictures, movement | B1 to B10 |
| `accessibility` | Whether everyone can read it and act on it | X1 to X10 |
| `responsive` | Whether it works and looks composed at every screen size, the smallest first | S1 to S8 |
| `user` | The visitor: arrives knowing only what brought them, gives the page a few seconds, and says where they would have left | F1 to F6 |

**The page brief is handed to the specialists.** It is what tells a reviewer that a typeface is the
brand's, that a number is true, and what the visitor was promised before arriving. The reviewer
playing the visitor never sees it.

**The first window is pictured on its own.** What a visitor sees before scrolling decides whether
they stay, so the first step of each journey is a picture one window tall, at every screen size.

## Setting it up

1. **The review home.** One folder per page, for example `quality/landing/<page>/`, with
   `config.json` and `capture.json` (start from `assets/review-config.example.json` and
   `assets/capture.example.json`).
2. **Copy the reviewer set into the review home**: this skill's `review/` folder, as
   `<review home>/rubric-set/`, and name it in the config: `"rubric_set": "rubric-set"`. The set is
   the yardstick. Kept beside the scores and committed with them, it cannot change under them when
   this skill is updated; a new copy starts a new series of scores, on purpose.
3. **Name the page brief** under `decisions` in the config, by its path relative to the config.
4. **The product line** (`app.name`, `app.description`): what is offered and to whom, in one neutral
   sentence. No adjectives, nothing about the campaign.
5. **Personas and journeys.** One persona per kind of visitor in the brief's Audience; one journey
   (unit) per entry in the brief's Arrival. The journey's `goal` is what the visitor saw before
   arriving and what they want, in their words: *"Saw an advertisement that said 'Invoices paid in
   two days'. Wants to know whether it works for a one-person business and what it costs."* That
   line is all the visitor reviewer knows.
6. **Steps.** The usual shape:

   | Step | What the visitor does | Picture |
   |---|---|---|
   | `01-arrive` | Opens the page from where they came | The first window only (`window_steps`) |
   | `02-read` | Scrolls down the page | The whole page |
   | `03-act` | Presses the main action | What it opens: the form, the next page |
   | `04-refused` | Sends the form with something wrong | The form saying what is wrong |
   | `05-done` | Fills it in and sends it | What the page says next |

   Leave out what the page does not have. Use a test destination for the form, never the real one:
   each journey is replayed once per screen size and once more for the probe pass.
7. **The capture plan.** Name `01-arrive` under the unit's `window_steps`. Start `02-read` with
   `{ "scroll": "through" }`: it goes down the page a window at a time and back to the top, so
   sections that appear on scrolling have appeared and pictures that load late have loaded before
   the whole page is photographed. Name under `motion_steps` any step where something moves that
   matters.
8. **Screen sizes.** A phone, a tablet and a desktop size. Give each persona the device the brief
   says most of that audience uses; the visitor reviewer sees only that one.
9. **Show the owner** the journeys, personas, sizes and the threshold before the first run. They
   define what the scores mean.

Then run it as the review skill describes: `new-run`, `capture.cjs`, `regress`, `bundle`, `collect`,
`challenge`, `score`, and its improvement loop between runs.

## Fixing what a round found

The worker starts from the fix order in the scorecard, and from this skill. Where a finding points:

| Criterion | Usually means | Go to |
|---|---|---|
| K (conversion), F1, F2, F5, F6 (visitor) | The structure or the ask: what is in the first window, the order of sections, how many actions, what the form wants | The page brief, then the source's A2 to A4 |
| W (copy), F3, F4 | The words, or a claim with nothing behind it | The brief's Proof and Voice, then the source's A5 and B8 |
| B (brand) | A value that is not the brand's, or a page that does not look finished | The brief's Brand section, then the brand's own system |
| X (accessibility), S (responsive) | Craft | The project's standards, or `interface-craft` where it is installed |

Three rules for the worker:

- **Fix the page, never the measurement.** Not the config, not the journeys, not the rubrics, and
  not the brief.
- **A finding that the brief is wrong goes to the owner.** If reviewers keep reporting that the
  promise does not match the advertisement, or that the proof is thin, and the brief has nothing
  better, the worker cannot fix that with words. Say what is missing and ask.
- **Never answer "nothing proves this" by inventing proof.** A missing fact is a question for the
  owner. The copy reviewer compares every fact on the page with the brief.
- **When the structure keeps coming back, compare structures.** The set names its arrangement
  criteria (`arrangement` in `review/set.json`: one action in the first window, proof near the
  promise, the order of the argument, the action within reach, the eye's path, headings that carry
  the argument, the small screen, and a visitor asked for too much). When reviewers report them at
  the same step in two reviews running, the review skill's `progress` lists a layout study as due:
  two or three other structures of the same page, with the same offer, proof and action from the
  brief, compared blind, and the owner chooses. The layout types of the source's A3 are the natural
  candidates. The owner's choice is recorded in the brief's Layout section and its Decisions.

## Control units

A control unit is the page with known defects planted in the browser, to measure whether the
reviewers are too kind or too harsh (`ux-quality-score/references/config.md`, "Control units"). The
planting kinds were written for the product reviewer set; each config entry names its role and
criterion explicitly, so they serve here when mapped to this set:

| Planted kind | Role and criterion here |
|---|---|
| `low_contrast` | `accessibility` X1 |
| `remove_label` | `accessibility` X2 |
| `tiny_target` | `responsive` S4 |
| `overflow` | `responsive` S1 |
| `misalign` | `brand` B3 |
| `hide`, on the main action | `conversion` K2; `user`, at that step |
| `jargon`, on the main action's label | `copy` W6; `user`, at that step |

For `clean`, use things the measurements settle: X2 where every field has a label, S1 where nothing
scrolls sideways. This mapping follows from the criteria; it has not yet been tried with reviewers,
so read the first strictness numbers with that in mind.

## What the loop cannot tell you

- **Whether the page converts.** The visitor is a model playing a person from a paragraph of
  description. It finds where a page is unclear, unconvincing or asks too much. It does not predict
  a conversion rate, and a 90 is not a promise of one. Only real visitors measure that.
- **Whether the offer is right.** Reviewers judge the page against its brief. A clear page for an
  offer nobody wants scores well.
- **Speed on a real network.** The capture runs against a local server. Layout shift is measured;
  time to load is not.
- **A screen reader, a real phone, a real thumb.** The measurements stand in for them. The
  accessibility and responsive rubrics say what they could not see.
- **Search ranking.** The conversion rubric checks that the title, description and sharing card
  exist and say what the brief says. Nothing here measures how the page ranks.
