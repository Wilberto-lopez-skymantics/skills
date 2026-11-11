# Config, evidence, scoring and ledger reference

Contents: 1. Review home. 2. config.json. 3. Designing journeys. 4. Personas. 5. Control units.
6. Evidence layout, who is handed what, comparing two captures. 7. What a reviewer folder contains,
including a second look. 8. Scoring arithmetic. 9. Ledger and progress. 10. Run directory.
11. Capture plan, the probe pass and what the probes cannot show.

## 1. Review home

One directory per application, by default `quality/ux/` in the application's repository:

```
quality/ux/
  config.json        what is measured
  capture.json       how to reach each step (section 11)
  ledger.jsonl       one line per scored run, append-only
  improve.md         during an improvement effort: the instruction, the open run, what each round
                     changed, what is waiting on the user (SKILL.md, "Stopping and picking up again")
  controls/<unit>/   evidence of control units, captured once
  runs/<run-id>/     evidence, results, scorecard
```

The directory that contains `config.json` is the review home. Commit `config.json`, `capture.json`, `ledger.jsonl`
and `improve.md`, and of each run `scorecard.md`, `scorecard.json` and `findings.md`. Keep screenshots,
page text and measurements (`runs/*/evidence/`) out of version control unless the project wants them:
any run can be captured again from its commit. Keep `controls/` too (committed, or backed up where
the project does not commit images): a recaptured control starts a new series.

## 2. config.json

| Field | Required | Meaning |
|---|---|---|
| `app.name`, `app.description` | yes | Shown to reviewers. One neutral sentence saying what the product is and who uses it. No history, no plans, no adjectives. |
| `viewports[]` | yes | `id`, `width`, `height`, optional `touch: true`. Typical: `phone` 375x812 touch, `tablet` 768x1024 touch, `desktop` 1280x800. |
| `personas[]` | yes | `id`, `description`, optional `viewport` (the device this person really uses). See section 4. |
| `units[]` | yes | The journeys. See below. |
| `judges` | no | Reviewers per role per journey: a number (default 2), or `{ "accessibility": 2, "user": 3, ... }`. In a config with `screening_judges`, this is the number for confirming runs. |
| `screening_judges` | no | Reviewers per role per journey in a screening run, in the same form as `judges` (typically 1). Set, it makes every run a screening run (journeys only, no control units) unless opened with `new-run --confirm`, which uses `judges` and the control units; only a confirming run can meet a target. Unset, every run confirms, as before. |
| `combine` | no | How a role's reviewers make its score for a journey: `"mean"` (default) or `"floor"`: the mean, held to the lowest ceiling any of the role's reviewers set with its issues. Floor is stricter where it matters: one reviewer's major holds the role to 74, a blocker to 24, whatever the others gave; minor and polish issues set no ceiling, so they only move the mean. Agreement (25 points) is checked either way. |
| `decisions` | no | Path, relative to the config, of the file that records the design choices the project has made on purpose (its type, colour, spacing, shape, density, motion and voice, and a list of dated decisions; the `interface-craft` skill's `design-decisions.md` is one such file, and any markdown file will do). `new-run` copies it into the run and every specialist and every second look is handed that copy; the reviewer playing the user never is. It is not part of the config hash: see section 9. A path that names no file is refused. |
| `rubric_set` | no | Path, relative to the config, of a folder holding a reviewer set of its own: other roles, with their own rubrics, for a kind of screen the six shipped roles were not written for (a landing page, for example). See section 12. Unset, the six shipped roles review. A different set is a different yardstick, so it starts a new series. |
| `control_threshold` | no | Default 0.67. Reviewers who report a smaller share of the planted defects are marked too kind. |
| `false_alarm_threshold` | no | Default 0.34. Reviewers who report a larger share of the `clean` entries as wrong are marked too harsh. |
| `reviewer_model` | no | The model every reviewer is started with, by whatever name your agent tool accepts for a model. The script prints it as `model` beside each prompt. Unset, reviewers run on whatever the session uses. A different model is a different reviewer, so changing it starts a new series. |
| `live` | no | `base_url` and `access_note` for units marked `live`. The note tells a reviewer how to sign in with a test account; it is shown verbatim, so it must contain test credentials only and nothing about the review. |

The six roles are `accessibility`, `visual`, `interaction`, `content`, `responsive` and `user`. Each
has its rubric in `judge/roles/<role>.md`. A config that names a `rubric_set` has that set's roles
instead, and everything below that speaks of the six roles holds for them (section 12).

Each unit:

| Field | Required | Meaning |
|---|---|---|
| `id` | yes | Lowercase letters, digits, `-`, `_`. Stable for the life of the product. |
| `persona` | yes | A persona id. |
| `goal` | yes | What the person is trying to get done, in their words. |
| `steps[]` | yes | `id` (no dots, sorts in order, e.g. `03-pay`), `do` (what the person does to reach this screen), optional `expect` (what they expect to happen; specialists see it, the user does not), optional `roles` (e.g. `["accessibility", "interaction"]` for a keyboard-focus step a person would not take). |
| `weight` | no | Default 1. How much this journey counts in the application's role scores and in the fix order. |
| `roles` | no | The roles that review this journey. Default: all of them. An overview unit might take `["visual", "content"]`. |
| `viewports` | no | Viewport ids for this unit. Default: all. Specialists see every one. |
| `user_viewport` | no | The one screen size the user sees. Default: the persona's `viewport` if the unit has it, otherwise the unit's first. |
| `live` | no | `true` gives reviewers the running product as well as the files. |
| `control`, `planted[]`, `clean[]` | no | Marks a control unit, lists its planted defects and what it gets right. See section 5. |

Ids of units, steps and viewports become file names and ledger keys. Renaming one starts a new series.

## 3. Designing journeys

A unit is one person with one goal. The set of units is the definition of "the whole application" for
scoring purposes, so cover it deliberately:

- every persona at least once, on the device they really use;
- the journeys the product exists for, weighted highest;
- first use (sign-up, invitation, onboarding) as well as routine use;
- the unhappy states: a validation error, an empty list, a refusal, a destructive action and its
  confirmation. Give each its own step, because a still image only shows a state that was captured;
- keyboard focus needs no step of its own: the probe pass (section 11) walks the Tab key through every
  step and records what shows focus at each stop. Add a step that tabs to the primary action, for
  `["accessibility", "interaction"]` only, where the focused look of that one control at every screen
  size matters, since the probe pass runs at one size;
- the moments where something moves: name those steps under `motion_steps` in the capture plan, so a
  strip of frames is taken while they play out;
- an overview unit: one key screen from each area, for `["visual", "content"]`, so that consistency
  across the product is judged somewhere.

Each screenshot shows the screen **after** the step's `do`. Write `do` from the person's side, as an
action a person could describe ("Presses Pay", "Presses continue without having chosen a time"), never
from the implementation's ("POST /payments returns 201"). A user reviewer reads the `do` of a step
only when arriving at it, as "how you got here"; so a `do` that names the control gives the path away
one step late, which is what you want, and a `do` that describes the destination ("Is on the receipt
page") tells them nothing. Do not describe how the screen looks; the screenshot does that.

Live mode trades isolation for coverage. A reviewer with the running product can see behaviour, but
it also changes data and can wander. Prefer still evidence with well-chosen steps; mark a unit live
only when behaviour over time is the point, and run live units against a disposable instance.

## 4. Personas

The user reviewer is a model playing the person, and it plays whoever the description gives it. Left
vague, it plays a patient expert who reads every word, which is nobody. Write four things:

- who they are and how often they use the product ("a retired owner who signs in once a quarter");
- the device and the situation ("on a phone, in the evening, with the letter from the board beside them");
- what they know and do not know ("knows what an assessment is, has never heard of ACH");
- how they behave when unsure ("taps the biggest button; gives up and phones the office after two tries").

Keep it neutral about the product: no hopes, no known problems. The specialists read the persona too:
it is who they review for. A change to a persona's description changes the measurement and starts a
new comparable series.

## 5. Control units

A control unit is a journey whose screens carry defects you planted. Reviewers get it like any other
journey. The share of planted defects they report says whether they are too kind; the share of things
known to be right that they report as wrong says whether they are too harsh. Both are recorded in every
ledger line. A control unit is left out of all scores and the fix order.

To make one:

1. Pick two or three real screens of the application, reachable by the unit's persona. Give the unit
   the `roles` whose defects you will plant.
2. In the capture plan, end each of the unit's steps with a `plant` action listing the defects for
   that screen (the header of `scripts/plant-defects.js` lists the kinds and which role and criterion
   should catch each). A selector that matches nothing visible stops the capture, so nothing is
   planted silently.
3. Run `capture.cjs --config CFG --run RUN --controls`. It saves screenshots, page text and
   measurements, taken after planting so the numbers agree with the picture, and the probe pass's
   files, into `controls/<unit-id>/`. It will not capture a control unit a second time unless you pass
   `--recapture-controls`.
4. In the config, mark the unit `"control": true` and list what you planted, each by the role that
   should catch it and where: `{ "id": "faint-prices", "role": "accessibility", "criterion": "A1",
   "step": "01-basket" }`. A reviewer of that role catches it by recording an issue under that
   criterion at that step. Leave out `criterion` to accept any issue at that step (the usual choice
   for the `user` role, whose kinds of trouble overlap), or `step` to accept that criterion anywhere.
5. Name two or three things the control screens plainly get right, under `clean`, in the same form:
   `{ "id": "fields-labelled", "role": "accessibility", "criterion": "A2" }`. A reviewer of that role
   who records an issue there raises a false alarm. Choose things the measurements in `facts/` settle,
   such as A1, A2, R1 or R3, so that "right" is a measurement and not your opinion. Nothing can be
   both planted and clean.

Plant four to eight defects, of mixed kinds, roles and obviousness. Plant them in the browser only:
never in the product's code or data. Capture once and never recapture: the control is only a yardstick
if it stays the same. Do not plant on screens that already fail the same criterion for real, or a
catch proves nothing.

The false-alarm rate matters most in an effort to reach a target: harsh reviewers can keep a product
below target however good it gets, and the clean entries are how you tell that apart from a product
that still falls short.

## 6. Evidence layout

```
runs/<run-id>/evidence/<unit-id>/      (controls/<unit-id>/ for a control unit)
  screens/<step>.<size>.png     required; .jpg, .jpeg and .webp are also accepted
  pages/<step>.<size>.txt       optional; visible text or accessibility tree
  facts/<step>.<size>.json      optional; output of scripts/page-facts.js
  keyboard/<step>.<size>.json   optional; the walk with the Tab key: every stop in order, what shows
                                focus there, what was never reached
  states/<step>.<size>.json     optional; the main controls at rest, hovered, focused, pressed and
                                disabled, with what changed, and one picture per control and state:
                                <step>.<size>.<control>.<state>.png
  motion/<step>.<size>.json     optional; what the page moves and for how long, with and without the
                                reduced-motion preference; layout shifts; whether the screen settles
  frames/<step>.<size>.json     optional; for the steps under motion_steps: the times of the pictures
                                taken while the step's last action played out, <step>.<size>.<nn>.png
```

The last four come from the capture's probe pass (section 11) and exist at one screen size per
journey. Every `.json` file among them starts with a line on how to read it. Who is handed what:

| Role | Handed |
|---|---|
| `accessibility` | `screens/`, `pages/`, `facts/`, `keyboard/`, `motion/`, `states/` |
| `visual` | `screens/`, `pages/`, `facts/`, `states/`, `frames/`, `motion/` |
| `interaction` | `screens/`, `pages/`, `facts/`, `keyboard/`, `motion/`, `states/`, `frames/` |
| `content`, `responsive` | `screens/`, `pages/`, `facts/` |
| `user` | its own device's screenshots, renamed and numbered (section 7) |

A role is handed only what its rubric can judge; this table is part of the scoring rules, so changing
it starts a new series. In a reviewer set of its own, `set.json` says what each of its specialists is
handed (section 12). A folder that is missing is simply not handed: evidence saved by other means
than `capture.cjs` can stop at `screens/`.

`new-run` lists the screenshots it expects (every specialist step at every screen size of the unit,
and every user step at the user's screen size) and how many reviewers a full run starts.

Capture rules that keep runs comparable:

- the same starting data every run;
- the page laid out at exactly the configured width and height (check `document.documentElement.clientWidth`), full-page
  screenshot;
- wait until the screen has settled (no spinners, fonts loaded);
- nothing in frame that is not the product: no devtools, no cursor overlays, no annotations;
- real states reached by using the product, not mocked markup.

`page-facts.js` is an expression that returns an object. Evaluate its text in the page and write the
result as JSON. It only reads the page. Beside contrast, sizes, labels and structure it records what
is in front of someone before they scroll (`first_window`: its headings, buttons and links, and how
many form fields), how many windows tall the page is (`layout.screens_tall`), links that lead nowhere
(`links.lead_nowhere`: no address, `#`, or a script), text that was never filled in
(`text.never_filled_in`: `{{...}}` markers and lorem ipsum), and what the page says about itself to a
search engine and a link preview (`head`: title, description, canonical address, robots, sharing card,
icon, structured data).

**Comparing two captures.** `uxq.cjs regress --config CFG --run RUN [--against <earlier run>]
[--unit <id>]` reads the counts in `facts/`, `keyboard/` and `motion/` of this run and of the latest
earlier run that measured the same journey, and prints, per journey, step and screen size, what rose
(`regressions`), what fell (`fixed`) and what could not be compared (`not_compared`: a journey or a
step the earlier capture does not hold). Control units are left out: they never change. It counts: sideways scrolling, elements wider than the page,
controls under 24 px, fields without a label, controls without a name, images without a text
alternative, text below the required contrast, text under 12 px, text that was never filled in, links that lead
nowhere, skipped heading levels, a missing or
repeated top-level heading, a missing main landmark, dialogs larger than the screen; keyboard stops
that show no focus, controls the keyboard never reached, stops covered by something else; and things
that can still move when reduced motion is asked for. It exits with code 2 when anything rose. A rise
is a reason to look, not a verdict: a screen that gained a table gained cells to count. It never
compares with a newer run, and uses no reviewer.

## 7. What a reviewer folder contains

`bundle` creates, under the system temp directory (or `--tmp`), one folder per reviewer named
`review-<random>`, alone inside a parent folder with a random name of its own. The path carries no run,
unit, role or reviewer name, and nothing else is ever placed in it. `collect` deletes the folder and
its parent once the result is in the run, and `collect --discard-bad` deletes those it retires, so no
folder outlives its round. `runs/<id>/bundles.json` maps folders back to units and stays on your side.

| Reviewer | Folder | Writes |
|---|---|---|
| Specialist (accessibility, visual, interaction, content, responsive) | `README.md` (the shared brief, naming the specialism), `rubric.md` (its own role rubric), `journey.md` (product, person, goal, the steps it reviews with `do` and `expect`, sizes), `screens/`, `pages/`, `facts/` for those steps at every size, the probe folders its role is handed (section 6), and `decisions.md` when the run has one | `judgment.json`: `score`, `reason`, `issues[]`, `strengths[]` |
| User | `README.md`, `rubric.md` (the user rubric: outcomes, kinds of trouble, the score scale in a person's terms), `start.md` (product, who you are, what you want, your device), `steps/step-NN.md` (how you got here, which screenshot to open), `screens/screen-NN.png` at one size | `judgment.json`: how each step went, trouble, `finished`, `score`, `reason` |

A user folder holds no page text, no measurements, no probe files, no decisions, no other screen
sizes, no step ids and no `expect` text: only what the person would have in front of them. File names
are numbered so that they do not give away what is coming.

**A second look.** `challenge` creates, in the same way, one folder per major or blocker that one
specialist alone reported: `README.md` (the check brief, naming the specialism), `claim.md` (the
problem as claimed, its criterion, the severity claimed, where it is said to be and the files cited),
`rubric.md`, `journey.md`, the evidence that role is handed, and `decisions.md` when the run has one.
It holds no score, no reason, no other issue and nothing that says who made the claim or that anyone
else looked. The checker writes `verdict.json`: `holds` (`yes`, `partly` or `no`), `severity`
(`blocker`, `major`, `minor`, `polish`, or `none` exactly when `holds` is `no`) and `reason`.
`collect` validates it, stores it as `runs/<id>/checks/<issue-id>.json` and deletes the folder;
`runs/<id>/check-bundles.json` maps folders to issues and stays on your side.

## 8. Scoring arithmetic

All scores are 0 to 100. Every reviewer gives one, with its reason; the script decides only whether it
agrees with the reviewer's own issues, and how scores combine.

**What counts of one reviewer's score.** The score given, held to the ceiling its own issues set: a
`blocker` issue means 24 at most, a `major` 74 at most; `minor` and `polish` set no ceiling. A score
above the ceiling counts at the ceiling, and the scorecard lists it as "gave X, counted Y, because of".
A result with a score below 100 and no issue (or, for a user, no trouble) is rejected at `collect`: every point lost is something
to fix.

**A user's issues and ceiling.** A person never names a severity: each piece of trouble takes it from
how that step went: `gave_up` blocker, `struggled` major, `hesitated` minor, `smooth` polish.
`finished: unsure` sets a ceiling of 74, `finished: no` of 24.

**Second looks.** A specialist's major or blocker is "lone" when, within its journey, no other
reviewer's report was grouped with it (see "Problems and reports": a second reviewer of the role,
a reviewer of another role, or the user, each counts). Control units are left out. `challenge` has
each lone issue checked once by a fresh specialist (section 7). The verdict's severity replaces the
reported one when it is lower; a higher one is ignored; `none` removes the issue from the reviewer's
issues, the fix order and the counts, and `findings.md` lists it as not upheld. A lone issue with no
verdict counts as reported, and the scorecard warns of it and lists it under `unchecked`.

**Counting a score again.** A reviewer chose its score with its most serious issue in mind. When a
second look lowers or removes that issue, so that the reviewer's most serious issue is now of a
lower severity, the score counts at no less than the anchor for what still stands, and never above
the ceiling: a major still standing 50; four or more minors 75; two or three 80; one 86; polish or
nothing 90. So: counted = the lower of the ceiling and (the higher of the score given and the
anchor). A reviewer who had already scored above the anchor keeps its score. The scorecard lists each
such score under `rebased`.

**A role's score for a journey** is the mean of its reviewers' counted scores. With
`combine: "floor"` it is that mean held to the lowest ceiling any of the role's reviewers set (after
second looks): with reviewers at 95 and 78, the second reporting a major, the counted scores are 95
and 74, the mean 84.5 and the role's score 74, shown as `74 (held)`. Every result counts; none is
dropped. With one reviewer (a screening run with `screening_judges: 1`) both are that reviewer's
counted score and agreement is not measured; the confirming run measures it.

**Agreement.** A role's reviewers disagree when their highest and lowest counted scores are 25 or more
apart. A role whose reviewers disagree is not at target, whatever its average: the issues they reported
are fixed like any other, and the journey is reviewed again with fresh reviewers.

**A journey's overall score** is the mean of its roles' scores. **The application's score for a role**
is the mean over journeys, weighted by journey weight; **the overall score** is the mean of the
role scores (six of them with the shipped set). Control units are left out of all of these.

**Strictness.** On the control units: the share of planted defects reported by the reviewers of the
role each names (`reliable` is false below `control_threshold`), and the share of clean entries
reported as wrong (`too_harsh` is true above `false_alarm_threshold`).

**Problems and reports.** A report is one issue as one reviewer wrote it. Reports are grouped into
problems so that the fix order shows each problem once. Two reports are taken as one problem when
their statements share enough distinctive words (words many reports use count for little, rare ones
such as a quoted label or a measured number count for a lot): a similarity of 0.2 when both name the
same criterion at the same step, 0.3 at the same step, 0.45 anywhere else, including across journeys
and roles. A problem is named by its most serious report and takes that severity. `findings.md` lists
every group. `clusters.json` (a label mapped to issue ids) overrides the grouping for the ids it names.
No score depends on grouping.

**Fix order.** Priority = severity weight (blocker 8, major 4, minor 2, polish 1) x reach. Reach is the
sum, over the journeys where the problem appears, of journey weight x the share of the reporting roles'
reviewers there who reported it. Equal priorities are ordered by the number of reports. The suggested
fix is the first a reviewer offered.

## 9. Ledger

`ledger.jsonl` has one JSON object per line, one per scored run:

`kind: "score"`, `run_id`, `date`, `commit`, `mode` (`screen` or `confirm`; a line without it is a
confirming run), `combine`, `rubric_version`, `rubric_sha`, `config_sha`, `decisions_sha` (the hash
of the decisions the specialists were handed, or null), `complete`
(false when the run reviewed only some journeys; its scores are then those journeys' scores and are
compared with nothing), `overall_score`, `role_scores`, `reliable`, `too_harsh`, `sensitivity`
(`planted`, `answers`, `caught`, `rate`, `clean`, `clean_answers`, `false_alarms`,
`false_alarm_rate`, or null), `unit_scores[]` (`id`, `overall`, `roles` with a score per role,
`contested` roles, `judges` per role, `standing`: the problems left standing, by severity; a journey not
reviewed in the run has nulls), `problem_counts`, `issue_counts`, `capped`, `second_looks` (how many
were `upheld`, `lowered` and `not upheld`), `unchecked` (lone serious issues with no verdict),
`warnings`, and `rescore: true` on a corrected entry.

`rubric_sha` covers the rubrics of the set in use (the six shipped ones, unless the config names a
set of its own), the three briefs and the scoring rules (section 8, and which
evidence each role is handed, section 6), so a change to any of them starts a new series. Two lines
are comparable when both `rubric_sha` and `config_sha` match. `decisions_sha` is recorded beside them
but breaks nothing: the decisions file grows as the project decides things. When it differs from the
line a run is compared with, `score` adds a warning, since part of the change may be the decision and
not the interface. `score` reports the change against the latest comparable line that covered every
journey, and each journey's change against the last line that scored it; `trend` shows where a series
breaks and why. `progress --target N` (required: the target the user chose; there is no default) reads the current series and reports each journey as at target,
below target (with the roles below target and the roles whose reviewers disagree), stalled (two
rounds in a row gaining under 2 points overall; it waits until no other journey is open) or not
reviewed, each with the problems left `standing`, and whether the target is met: one run of
every journey, every role of every journey at target, no role contested, and the control units showing
the reviewers catch enough. The last line of a run counts, so a `--rescore` replaces the line before it.

`progress` also prints `target_in_issue_terms`, the target as what reviewers may leave standing (90
or more: only polish; 86: no major and at most one minor each; 80: at most three; 75: no major; 25:
no blocker), and `plateau`. A plateau is the target not met and either only stalled journeys left
below it, or something still open while the last two runs of every journey together each gained
under 2 points overall and nothing has been scored since. `then` then begins "Stop and ask the user"
and names the choices: accept the scores, try a different approach, lower the target, or pick the
standing issues by hand (SKILL.md, "A plateau stops the loop").

## 10. Run directory

```
runs/<run-id>/
  run.json            id, date, when it was opened, commit, rubric, config and decisions hashes, and the
                      name of the reviewer set when the config names one
  decisions.md        the project's decisions as they were when the run was opened, if the config names them
  evidence/<unit>/    see 6
  bundles.json        reviewer folders and what each was for
  judgments/<unit>/<role>-<n>.json
  check-bundles.json  second-look folders and the issue each was for
  checks/<issue-id>.json   the verdict of each second look
  capture-notes.json  what the capture hid as not part of the product, and probes that failed (written by capture.cjs)
  clusters.json       optional: corrects the grouping of reports into problems
  notes.md            optional: your own remarks for the user
  scorecard.json, scorecard.md, findings.md
```

A run is tied to the rubrics and config it was opened with. If either changes, `score` refuses and a
new run is needed.

## 11. Capture plan

`capture.json`, beside `config.json`, tells `scripts/capture.cjs` how to reach each step. It is
orchestrator-side: no reviewer ever sees it.

```json
{
  "base_url": "http://localhost:3000",
  "flows": {
    "sign-in-customer": [
      { "goto": "/login" },
      { "fill": ["label=Email", "customer@example.test"] },
      { "fill": ["label=Password", "${SHOP_TEST_PASSWORD}"] },
      { "click": "text=Sign in" },
      { "wait_for": "text=Your orders" }
    ]
  },
  "units": {
    "customer-reorders-last-basket": {
      "steps": {
        "01-home": [{ "use": "sign-in-customer" }],
        "02-past-order": [{ "click": "text=Order again" }, { "wait_for": "text=Basket" }],
        "03-slot": [{ "click": "text=Choose a delivery time" }],
        "04-slot-error": [{ "click": "text=Continue" }, { "wait_for": "[role=alert]" }],
        "05-confirm": [{ "click": "text=Tomorrow 8-10" }, { "click": "text=Confirm order" }, { "wait_for": "text=Order placed" }],
        "06-focus": [{ "press": "Tab", "times": 4 }]
      },
      "motion_steps": ["03-slot", "05-confirm"]
    }
  }
}
```

| Field | Meaning |
|---|---|
| `base_url` | Where the application runs. Must be a local address (`localhost`, `127.0.0.1`, `*.localhost`, `*.test`) unless `--allow-remote` is passed for a test instance you own. |
| `flows` | Named lists of actions to reuse with `{ "use": "name" }`, typically signing in. |
| `units.<id>.start` | Optional actions before the first step. |
| `units.<id>.keep_not_product` | Optional, `true` for a journey whose subject is what `not_product` lists (a prospect trying a demo): nothing is hidden or stopped on in that journey. |
| `units.<id>.steps.<step>` | The actions that take the person from the previous step's screen to this one. Required for every step; `[]` when nothing needs doing. The picture is taken after them. |
| `settle_ms` | Pause after the page has loaded before the picture. Default 400. |
| `timeout_ms` | How long to wait for something to appear. Default 8000. |
| `reduce_motion` | Default true: asks the page for reduced motion so animations do not blur a picture. The probe pass always runs with motion on. |
| `probes` | Default true: after its screenshots, each journey is replayed once more for what a still picture cannot show (below). `false` turns the probe pass off; a list picks kinds: `["keyboard", "states", "motion", "frames"]`. |
| `units.<id>.probes` | The same, for one journey; it overrides the plan's. |
| `units.<id>.motion_steps` | Step ids of this journey where something moves that matters. While the last click, key, hover or selection of such a step plays out, pictures are taken for up to 600 ms (at most seven kept, identical ones dropped) and saved under `frames/`. |
| `units.<id>.window_steps` | Step ids of this journey that are pictured as the window alone, exactly as tall as the configured screen, and not the whole page: what someone sees on arrival, before they scroll. For the first step of a page where that decides whether a visitor stays. The measurements of such a step still cover the whole page. |
| `dialogs` | `"dismiss"` to cancel native alert and confirm boxes; default is to accept them. Either way they are listed in the output, since they cannot be photographed. |
| `reset_command` | Optional shell command run before every journey and screen size, for example to reseed the data. |
| `clock` | Optional `{ "at": "<ISO instant>", "since_file": "<path>" }`: every page's `Date` runs from `at`, counted from the epoch in ms that `since_file` holds (written when the application's server started with the same instant), so captures on different days and hours see the same day and hour. Without it, pages use the real time. |
| `not_product` | Optional list of things that can appear on screen but are not part of the product: `{ "selector": "<CSS selector>", "what": "<a few words>", "if_found": "stop" or "hide" }`. See below. |

Actions, one per object:

| Action | Does |
|---|---|
| `{ "goto": "/path" }` | Opens a page of the application. |
| `{ "click": target }`, `{ "hover": target }` | A real mouse click or move on the first visible match. |
| `{ "fill": [target, value] }` | Clears a field and types the value. An empty value only clears it, for a field that arrives filled in. |
| `{ "select": [target, value] }` | Picks an option of a dropdown by value or visible text. |
| `{ "press": "Tab", "times": 3, "shift": false }` | Presses a key: Tab, Enter, Escape, Space, Backspace or an arrow key. |
| `{ "wait_for": target }`, `{ "wait_gone": target }` | Waits until something is, or is no longer, on screen. |
| `{ "wait_ms": 500 }` | Waits a fixed time. Prefer `wait_for`. |
| `{ "scroll": "through" }` | Goes down the page a window at a time and back to the top, as a reader does, so that sections which appear on scrolling have appeared and pictures that load late have loaded before the whole page is pictured. `"through"` is the only value. |
| `{ "eval": "expression" }` | Runs JavaScript in the page, for the rare state nothing else reaches. |
| `{ "plant": [...] }` | Plants defects, for control units only (section 5). |
| `{ "use": "flow" }` | Runs a named flow. |

A target is a CSS selector, or `text=...` for a button, link or tab by its visible text, or
`label=...` for a form field by its label. In `wait_for`, `text=...` matches any visible text. Prefer
`text=` and `label=`: they follow what a person sees and survive refactoring.

Things to know:

- **Each journey is replayed once per screen size**, in a fresh private window. A journey that changes
  data (pays an invoice, submits a request) therefore does it once per size. Either make the journey
  repeatable, give each size its own test account, or set `reset_command`.
- **Passwords stay out of the plan.** `${NAME}` in a `goto`, `fill` or `select` value is read from the
  environment at run time and is never printed. The measurements never record what is typed into a
  field, and screenshots show password fields masked.
- **Pictures are the full page from the top**, at the configured width, except for a step named under `window_steps`, which is the window alone. A page that reveals its sections as they are scrolled to is pictured with them still hidden unless the step scrolls through it first (`{ "scroll": "through" }`). An application whose window never scrolls but whose main panel does (a panel at least 60 % of the width and 40 % of the height) is photographed with the window grown by what that panel hides, so the picture shows the whole screen; the output lists it as `panel_grown_by`. A header that sticks to the
  top is drawn once, at the top. A bar fixed to the bottom of the window is drawn where it sits on the
  first screenful, not at the end of the page. Pages taller than 12000 pixels are cut there.
- **Test fixtures are not the product.** A demo or development mode may show sign-in shortcuts for
  seeded accounts, a form already filled in with a test account, a debug bar. Reviewers report what
  they see, so anything of that kind is scored as a defect of the product and can sink trust on its
  own. The right fix is to capture a build or mode without it. Declare what can appear under
  `not_product`: before every picture the capture looks for each selector, and with `"if_found":
  "stop"` (the default) it stops and names what it found, so a fixture cannot slip into a run
  unnoticed. With `"if_found": "hide"` it hides the element instead, the page closes up as if it were
  not there, and every screen it was hidden on is listed in the output, kept in
  `runs/<id>/capture-notes.json` and repeated as a warning on the scorecard. Hiding is a statement
  that real users never see this; do not use it for anything that ships. A field that arrives
  pre-filled is emptied with `{ "fill": [target, ""] }` at the step where it first shows.
- **The probe pass.** After a journey's screenshots, it is replayed once more in a fresh private
  window, with motion on, at the journey's first screen size without touch (or its first size), so
  the journey runs one more time than it has sizes. At each step it records the walk with the Tab key
  (`keyboard/`, at most 60 stops), the looks of up to four main controls not yet pictured in the
  journey at rest, hovered, focused and pressed, and of disabled ones (`states/`), the movement the
  page declares (`motion/`), and frames for the `motion_steps` (`frames/`). It never changes a
  screenshot. A probe that fails is listed under `probe_notes` in the output and in
  `capture-notes.json`, and the capture goes on; if the replay itself stops at an action, later steps
  have no probe files. Control units are probed like any other journey, with their planted defects.
- **What the probes cannot show.** Say these when you report, and do not read more into the files:
  - the states are forced: the browser is told to apply the hovered, focused and pressed styles, no
    event is fired and nothing is activated, so an effect a script makes (a tooltip, a menu opening,
    a class added on press) does not show;
  - `motion/` reads what the stylesheet declares; movement driven by script shows only as "running
    now" at the moment of reading, and in a frame strip;
  - under reduced motion, anything whose position or size can still change is counted as "can still
    move", including a small scale on press; a reviewer decides whether it matters;
  - the walk with the Tab key really moves focus, so a page that reacts to focus (a menu that opens,
    a field that validates on leaving) may look different afterwards; that is why the probe pass is a
    replay of its own after the screenshots and the walk comes last at each step, but the next step's
    actions start from wherever the walk left the page;
  - frame times are approximate (taking a picture takes a few tens of milliseconds), a strip is a
    handful of pictures and not the feel of a movement, and a spinner that never stops makes every
    frame differ;
  - while frames are taken the pointer stays where it clicked, so a control under it shows its
    hovered look;
  - everything is measured at one screen size, in one browser, without a screen reader or any other
    assistive technology.
- **An overflowing page is recorded, not refused.** The picture stays at the configured width, and
  the measurements say that the page scrolls sideways and which elements stick out.
- **The browser** is the first Chrome, Edge or Chromium found; pass `--browser <path>` or set
  `UXQ_BROWSER` to choose. `--headed` shows the window while it works. `--unit <id>` captures one
  journey.

## 12. Reviewer sets

The six shipped roles were written for the screens of an application. Another kind of screen asks
other questions: a landing page is judged on whether a stranger understands the offer and takes it,
not on whether a returning user gets a task done. A config can therefore name a set of its own:

```json
"rubric_set": "rubric-set"
```

The value is the path of a folder, relative to the config:

```
rubric-set/
  set.json             the name of the set, its specialist roles, and what each is handed
  roles/<role>.md      one rubric per specialist role named in set.json
  roles/user.md        the rubric of the person the journey is for; every set has one
  reviewer-brief.md    optional: what its specialists are told
  user-brief.md        optional: what the person is told
  check-brief.md       optional: what the specialist giving a second look is told
```

```json
{
  "name": "landing-page",
  "specialists": {
    "conversion": ["screens", "pages", "facts"],
    "brand": ["screens", "pages", "facts", "states", "motion", "frames"]
  }
}
```

- **`name`**: lowercase letters, digits, `-` or `_`. `run.json` records it as `rubric_set`.
- **`specialists`**: each role id (lowercase letters only) with the kinds of evidence it is handed.
  `screens` is always among them; the others are `pages`, `facts`, `keyboard`, `states`, `motion` and
  `frames` (section 6). `user` cannot be listed: it is the person, in every set, and is handed its own
  device's screenshots one step at a time.
- **A rubric** opens with `# <Title> rubric`: the title without the word "rubric", in lowercase, is
  what the reviewer is told its specialism is. It carries a line `Rubric version: X.Y.Z`, the same in
  every rubric of the set, and lists its criteria as `- **K1** text`: one capital letter and a number,
  unique within the rubric. An issue must name a criterion of its own role's rubric. Follow the
  sections of the shipped rubrics: where to look, the criteria, what is always at least major, and
  what a 90 looks like there.
- **A brief** the set does not hold is the shipped one. A brief of its own keeps the placeholders of
  the shipped one it replaces (`{{ROLE_TITLE}}`, `{{STEP_COUNT}}`, `{{ACCESS_BLOCK}}`,
  `{{ACCESS_SUFFIX}}`) and the same result format, since the script checks results the same way for
  any set.
- **Everything in the folder is read by reviewers.** The rule for `judge/` holds: nothing about how
  the reviewing is organised.

What stays the same for any set: the result a reviewer returns, severities and their ceilings, second
looks, agreement, how scores combine, the strictness check, screening and confirming runs, the ledger.
Wherever the config takes a role (`units[].roles`, `steps[].roles`, `judges` per role, `planted[].role`),
it takes the set's role ids. The planting kinds of `plant-defects.js` were written against the shipped
criteria; a `planted` entry names its role and criterion itself, so they can be used with another set
by naming the criterion of that set which the defect breaks.

Keep the set inside the review home and commit it with the scores. It is the yardstick: `rubric_sha`
covers its rubrics and the briefs it uses, so a run is tied to the set as it was when the run was
opened, and a changed set starts a new series, exactly as a changed `judge/` does. Scores from two
different sets are never compared.

The `landing-page-craft` skill, where it is installed, ships such a set under `review/`.
