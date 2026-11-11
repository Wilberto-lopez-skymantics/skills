---
name: ux-quality-score
description: Scores and improves the UI and UX of any application with blind, independent reviewer agents in six roles, each with its own rubric (accessibility, visual design, interaction, content, responsive design, and the target user), each returning a score from 0 to 100 with its reason and the issues behind it; then fixes the issues and reviews again with fresh agents until every role reaches a threshold the user sets, and keeps a score ledger across releases. Use this whenever the user asks for a UI or UX review, a design audit or critique, an accessibility, usability or responsive-design assessment, a design quality score or scorecard, "how good is the interface", "make the UI the best it can be", "improve the UI until it scores 90", "would a real user manage this", or wants to know whether a redesign actually improved things, even if they do not name this skill.
---

# UX quality score

This skill scores how good an application's interface is, and can then raise that score in a loop:
capture the screens, have fresh reviewer agents score them, fix what they report, and review again with
new agents until every reviewer role reaches the user's threshold.

There are six reviewer roles. Each has its own rubric under `judge/roles/`, and each reviewer returns a
**score from 0 to 100, the reason for it, and the issues that cost the points**, every issue citing the
screen it shows on.

| Role | Looks at | Sees |
|---|---|---|
| `accessibility` | contrast, labels, keyboard focus, reach and order, structure, alternatives, zoom, reduced motion | screens, page text and measurements at every size; the walk with the Tab key, what moves, the looks of the main controls |
| `visual` | hierarchy, grouping, spacing, type, colour, consistency, finish, data, character | screens, page text and measurements at every size; the looks of the main controls, what moves, frame strips |
| `interaction` | where am I, feedback, state, errors, prevention, ways out, next steps, motion, control states | screens, page text and measurements at every size; the keyboard walk, what moves, the looks of the main controls, frame strips |
| `content` | naming, plain words, honesty, what is said before a commitment, specific labels, messages, limits | screens, page text and measurements at every size |
| `responsive` | fit, small screens, touch targets, text size, reshaping, overlays, device habits | the same |
| `user` | the person the journey is for: can I get this done | only their own device's screens, one step at a time |

Two reviewers per role per journey by default. A config can screen with fewer (`screening_judges`, often
one) while working toward a target and keep two for the run that confirms it, and can hold each role
to the ceiling of the most serious issue any of its reviewers left standing (`combine: "floor"`); see
"The improvement loop". A script (`scripts/uxq.cjs`) builds what each reviewer sees, checks every
result, has a serious issue that rests on one reviewer's word checked by a fresh specialist, combines
the scores, ranks the fixes, compares what each capture measured with the capture before it, and
records each run.

## The ideas everything else follows from

**1. You orchestrate; you never judge.** By the time you run this skill you know the codebase, the
history, what was fixed last round and what the user hopes to hear. A verdict from someone who knows all
that measures their expectations, not the interface. So the work is split:

| Who | Knows | Does |
|---|---|---|
| You (orchestrator) | Everything | Capture the screens, start the reviewers, run the script, report, and in the loop make the fixes |
| A specialist | Its own rubric and one journey's screens | Scores its area, says why, lists the issues |
| A user | Who they are, what they want, and the screens in order | Says how each step went, gives a score and says why |
| A checker | One claimed issue, the rubric it was filed under, and that journey's evidence | Says whether the issue is there and how serious it is (a second look) |
| `scripts/uxq.cjs` | The arithmetic | Builds the reviewer folders, validates results, combines scores, ranks fixes, writes the ledger |

A reviewer must not know that it is part of a loop, that other reviewers exist, that an earlier review
happened, what was fixed, what the scores were, or what anyone hopes the result will be. Each of those
facts pulls a score toward a story ("it should be better now") and away from the screen.

**2. A score has to be earned and explained.** Asked for a number with nothing to hold it, a model
scores almost any decent interface in the high 80s, and a loop aiming for 90 then stops early or cannot
tell rounds apart. So every score is held in place:

- each rubric says what a 90 looks like in its area and lists the problems that are always at least
  major there ("Major on sight"); the brief gives one scale for all: 90 to 100 exemplary, 75 to 89
  minor issues only, 50 to 74 a major issue, below that worse; and within a band the number of issues
  places the score (one minor, 86 to 89; two or three, 80 to 85; four or more, 75 to 79);
- a score below 100 must come with the issues that cost the points, each citing a screen, even when
  they are only polish: every point lost is something to fix, so a target of 100 can be worked to;
- a score must agree with its own issues: with a blocker it counts as 24 at most, with a major 74 at
  most, whatever the reviewer wrote;
- **control units**, screens with defects planted on purpose and things known to be right, measure
  whether the reviewers are too kind or too harsh, so neither is trusted blindly;
- a major or blocker that one reviewer alone reported is checked by a fresh specialist who is handed
  that one claim and the same evidence (a **second look**) before it holds a score down; the check
  keeps the issue or lowers it, never raises it;
- where the project keeps a file of the design choices it has made on purpose (`decisions` in the
  config), every specialist is handed it: a recorded choice is not an issue unless it stops the person,
  misleads them, or is on the rubric's "Major on sight" list. So the house style is not reported again
  every round. The reviewer playing the user never sees it;
- every round uses new reviewers; with two or more per role, their scores are combined (the mean, held
  under `combine: "floor"` to the lowest ceiling any of them set) and must agree.

The script enforces most of the isolation: it builds each reviewer's folder under a random neutral
name and prints the exact prompt to use. Your part is to add nothing.

### Isolation rules

1. Start every reviewer as a **fresh agent with no shared context**: a new subagent started from
   nothing, never a fork or continuation of this conversation, which would hand over everything you
   know. If your agent tool lets you set the subagent's working directory or limit what it may read,
   start it in its own folder with access to that folder only: the prompt asks it to stay there, and
   this makes sure of it. The project directory holds the scorecards, the ledger and `improve.md`.
2. Give it **the prompt the script printed, character for character**, and nothing else. No preamble,
   no "this is round 2", no hint about what to look for, no praise or worry about the product. When an
   entry carries a `model` (the config's `reviewer_model`), start the agent with that model; it is
   part of the measurement, so never substitute another.
3. **One agent, one folder, one use.** Never send a follow-up message to a reviewer, never reuse one
   for a second journey or a later run, never show one reviewer another's output. If a result is
   missing or invalid, discard it and bundle a replacement. Each folder sits alone in a parent folder
   of its own, and `collect` deletes it once its result is in, so a reviewer started later never
   comes across an earlier one's work.
4. Keep loop state out of the evidence: no annotations on screenshots, no file names or seed data
   that mention a review, a round or a fix, and a neutral product description in the config. Nothing
   may mark a control unit as different from any other journey.
5. **Never edit, filter, re-score or drop** a result. If you think a reviewer is wrong, write that in
   the run's `notes.md` for the user; the numbers stay as the reviewers and the script produced them.
   The same holds in the other direction: do not tune the config, the journeys, the personas or the
   capture to dodge an issue, and do not record a "decision" in the decisions file to silence one: what
   goes in that file is the user's choice, never yours. Fix the interface, not the measurement.
6. **A second look is a reviewer like any other.** The agent that checks a claim is fresh, gets the
   prompt `challenge` printed and nothing else, works in its own folder and is used once. Its verdict
   stands as written, whether or not it agrees with you.

Start all the reviewers of a step in a single message so they run in parallel. Before the first spawn
of a run, tell the user how many agents it will start: `new-run` prints it as `reviewers_per_full_run`
(two per role per journey by default, so twelve for a journey reviewed by all six roles), and, beside
it, `reviewers_per_screening_run` and `reviewers_per_confirming_run`. Second looks come on top: one
agent for each major or blocker that one reviewer alone reported, usually a handful a run.

## Files

- `judge/roles/<role>.md`: the six rubrics, one per role: what the role looks at, where to look in
  the evidence, its criteria (each issue names one), the problems that are always at least major, and
  what a 90 looks like there. They share one version number. Each stands on its own, so a role could
  later be lifted out as a skill of its own.
- `judge/reviewer-brief.md`: what every specialist is told: the evidence, the score scale, severity,
  how to treat recorded decisions, the result format. `judge/user-brief.md`: what the user is told.
  `judge/check-brief.md`: what the specialist giving a second look is told. The script copies the
  right brief and rubric into each folder. Everything under `judge/` is reviewer-facing: keep it free
  of any mention of loops, rounds, ledgers, planted defects or other reviewers.
- A reviewer set of its own. The six roles were written for the screens of an application. For
  another kind of screen (a landing page, for example) a config can name a folder with other roles
  and rubrics under `rubric_set`; the commands, the scoring and the loop are the same, and its scores
  are a series of their own. `references/config.md`, section 12.
- `scripts/uxq.cjs`: the commands below. `scripts/uxq.test.cjs` tests it (`node --test`).
- `scripts/capture.cjs`: saves the evidence for a run by driving an installed Chrome or Edge from a
  capture plan. `scripts/capture.test.cjs` tests it against a local page.
- `scripts/page-facts.js`: measurements of a page (contrast, control sizes, overflow, labels,
  headings, field types, what the first window holds, links that lead nowhere, text that was never
  filled in, the title, description and sharing card). The capture script runs it on every screen; specialists read it.
- `scripts/page-probes.js`: what a still picture cannot show: where the Tab key goes and what shows
  focus, how the main controls look hovered, focused and pressed, what the page moves and for how
  long. The capture script's probe pass runs it; the roles that can judge it read the results.
- `scripts/plant-defects.js`: puts known defects into a page, for capturing control units. Its header
  says which role and criterion should catch each kind.
- `references/config.md`: the config schema, how to design journeys, personas and control units, the
  evidence layout, the scoring arithmetic and the ledger. Read it when setting up a new application or
  explaining a number.
- `references/how-it-works.drawio`: the loop, one scoring run and the scoring arithmetic as diagrams,
  for the people you report to. Not needed to run the skill.
- `assets/config.example.json`: a starting config.

## First time in an application: set up

Each application keeps its own review home, by default `quality/ux/` in its repository:
`config.json`, `capture.json`, `ledger.jsonl`, `controls/` and `runs/`. If the project has its own
rules about where reports and evidence live, follow them.

1. Read `references/config.md`.
2. Learn the product well enough to list its personas and the journeys that matter to them. Cover
   every persona, the journeys the product exists for, the states people hit when things go wrong, and
   one overview unit for whole-product consistency. Five to twelve units is typical; each costs twelve
   reviewers a round with all six roles, so cover what matters rather than everything.
3. Write each persona as a real person with limits: how often they use the product, on what device,
   how much patience and confidence they bring, what they do when stuck. The user reviewer is only as
   realistic as this description, and the specialists review for this person too.
4. Write `config.json` from `assets/config.example.json` and show the user the journeys, personas,
   screen sizes, roles and weights before the first run. This list defines what the scores mean, so it
   is the user's call, and changing it later starts a new comparable series. If the project keeps a
   file of design decisions (for example the `design-decisions.md` of the `interface-craft` skill),
   name it under `decisions`, so the specialists are handed the choices the project made on purpose.
5. Write `capture.json` beside the config: for each step of each journey, the actions that reach it.
   Name under `motion_steps` the steps where something moves that matters (a dialog opening, a row
   leaving a list, a panel sliding in); the capture takes a strip of frames while those play out.
   Run the capture once and look at the pictures until every step shows what it should. Keep passwords
   out of the plan: write `${NAME}` and set that environment variable when you run it. Capture the
   application as a real user would meet it: turn off sign-in shortcuts for seeded accounts, forms
   that arrive filled in with a test account, debug bars. Where that is not possible, name each one
   under `not_product` in the capture plan (`references/config.md`, "Capture plan").
6. Capture one **control unit** (`references/config.md`, "Control units"): two or three real screens
   with four to eight defects planted for different roles, and two or three things they plainly get
   right, saved once under `controls/` with `capture.cjs --controls` and reused unchanged in every run.
   Without one, a run still scores, but nothing tells you whether the reviewers were too kind or too
   harsh, and the scorecard says so.

## A scoring run

`UXQ` below stands for `node <this skill>/scripts/uxq.cjs`, `CFG` for the path to `config.json`.

1. **Open the run.** `UXQ new-run --config CFG` (add `--confirm` for a confirming run when the config
   sets `screening_judges`; see the loop) creates `runs/<date>-<commit>/` and prints the
   screenshots it expects and how many reviewers a full run starts. Score a committed state of the
   application so the ledger entry points at something that can be checked out again.
2. **Capture the screens.** Start the application from the same known data every run (a seed or
   fixture), so that a change in score means a change in the interface. Then
   `node <this skill>/scripts/capture.cjs --config CFG --run RUN` replays each journey once per screen
   size in a fresh private window and saves, per step, a screenshot at exactly the configured width,
   the page text and the measurements. It then replays the journey once more with motion left on (the
   probe pass) and saves, per step, the walk with the Tab key, the looks of the main controls in each
   state, what moves and for how long, and a strip of frames for the steps the plan names under
   `motion_steps`. If the capture stops, it names the action that failed and keeps a picture under
   `runs/<id>/capture-debug/`; correct the plan and run it again. A probe that fails does not stop the
   capture: it is listed under `probe_notes` in the output and in `runs/<id>/capture-notes.json`, and
   the reviewers of that step simply have less to go on. Read those notes.

   Look at a few screenshots yourself before starting reviewers. You are not judging the design; you
   are checking that each picture shows the state its step describes, and nothing a real user would
   never see. A reviewer cannot tell a broken capture or a test fixture from a broken product. If the
   application cannot be driven this way (a native app, a login you cannot automate), save the same
   files by other means or ask the user for screenshots. If you cannot save a screenshot for some step,
   say so and stop; do not substitute a description, because a reviewer would then be scoring your words.
3. **Compare with the capture before.** When an earlier run captured the same journeys,
   `UXQ regress --config CFG --run RUN` lists what this capture counted worse than the last one, per
   journey, step and screen size (faint text, small controls, sideways overflow, missing labels,
   keyboard stops that show no focus, things that still move under reduced motion), and what it
   counted better. It exits with code 2 when anything got worse. It costs no reviewer, so run it
   before starting any: a fix that broke something else shows here first. In the loop, put right what
   it lists and capture again, or write in `improve.md` why a rise is intended. `--against <run>`
   names the run to compare with; by default it is the latest earlier run that measured the journey.
4. **Start the reviewers.** `UXQ bundle --config CFG --run RUN` prints one entry per reviewer with a
   `dir` and a `prompt`. Start one fresh agent per entry, all in one message, each with exactly its
   `prompt`.
5. **Collect.** `UXQ collect --config CFG --run RUN` validates and stores every result and deletes its
   folder. For anything `missing` or `invalid`, run `UXQ collect ... --discard-bad` to retire those
   reviewers, then `UXQ bundle` again: it tops each journey and role back up with replacements in new
   folders. Start them and collect again.
6. **Second looks.** `UXQ challenge --config CFG --run RUN` prints one entry for every major or
   blocker that a single specialist reported and nobody else did, in the same journey. Start one fresh
   agent per entry, all in one message, each with exactly its `prompt`; each is handed that one claim,
   the rubric and the journey's evidence, and writes a verdict: the issue holds, holds in part, or does
   not, and how serious it is. `UXQ collect` stores the verdicts (`--discard-bad` retires a silent or
   invalid one, and `challenge` then prints its replacement). A verdict keeps the reported severity or
   lowers it, never raises it; an issue that does not hold leaves the fix order and is listed in
   `findings.md` as not upheld. When it was the reviewer's most serious issue, the reviewer's score is
   counted again from what still stands (`references/config.md`, "Scoring arithmetic"). An issue two
   reviewers reported, or one a specialist and the user both ran into, needs no second look. If
   `challenge` prints nothing, there is nothing to check. `score` does not wait for second looks: an
   unchecked issue counts as reported and the scorecard warns of it, so run them first.
7. **Score.** `UXQ score --config CFG --run RUN` writes `scorecard.md`, `findings.md` and
   `scorecard.json` into the run and appends one line to `ledger.jsonl`. If verdicts arrive after a
   run was scored, `score --rescore` appends the corrected line.
   - If `contested` lists a journey and role, its reviewers' scores are 25 or more points apart. That
     role is not at target, whatever its average: what its reviewers reported is in the fix order like
     any other issue. Do not settle a disagreement yourself, and do not add reviewers until the scores
     happen to agree.
   - If `reliable` is false, the reviewers caught too few planted defects: report the scores as an
     upper bound. If `too_harsh` is true, they flagged too many things known to be right: report the
     scores as a lower bound. Do not rerun until the reviewers happen to agree with you.
   - `capped` lists scores the script held to their reviewer's own issues ("gave 85, counted 74,
     because of a major issue"). That is the rule working, not an error. `rebased` lists scores
     counted again after a second look changed the reviewer's most serious issue.
   - A role shown as `(held)` on the scorecard is under `combine: "floor"`: its mean was above the
     ceiling one of its reviewers' issues set, and it counts at that ceiling.
8. **Check the grouping.** Several reviewers report the same problem in their own words, so `score`
   groups reports into problems by the distinctive words they share; the fix order shows each problem
   once. If a group plainly holds two different problems, or two groups are plainly one, write
   `runs/<id>/clusters.json` (a short label mapped to the issue ids of one problem) and score again with
   `--rescore --no-ledger`. Grouping changes the fix order and which serious issues stand on one
   reviewer's word, never a score directly: if `status` then says issues are waiting for a second
   look, run step 6 again and `score --rescore`.
9. **Report.** See "Reporting".

## The improvement loop

Use it when the user asks to raise the scores, not only to measure them. **The target is the user's
to set, never yours.** Before the first round, ask the user which score every role of every journey
must reach (and, if they want milestones, each one in order), unless they have already named it; if
what they said can be read two ways, ask again rather than pick. Ask too whether to keep going without
asking between rounds. Record the answer in their words in `improve.md`. `progress` has no default
target and refuses to run without `--target`. It prints the target in terms of issues
(`target_in_issue_terms`: for 90, "no reviewer leaves a blocker, a major or a minor issue standing;
only polish is left"; for 80, no blocker or major and at most three minors each). Show the user that
sentence when they choose: a number is easier to pick knowing what it asks for.

**What the target means.** A journey is at target when the score of every role that reviews it (the
mean of that role's reviewers, held under `combine: "floor"` to the lowest ceiling any of them set) is
at or above the target, and the reviewers of each role agree: their scores less than 25 points apart. Every separate role of every journey has to get there; the loop keeps
improving until it does. The target is met only by **one run of every journey together**, at target and agreed, with
the control unit showing the reviewers caught enough planted defects. When the config sets
`screening_judges`, that run must be a **confirming run** (`new-run --confirm`): `judges` reviewers per
role and the control units. Every other run is a screening run: `screening_judges` per role, journeys
only, no control units, so it costs a fraction and cannot settle the target on its own.

**Several targets.** The user may set a first target and a later one ("80, then 90"). Run the loop to
the first, confirm it, report it as a milestone, then carry on to the next with `progress --target`
raised; the ledger and the series stay the same.

**Presentation or behaviour.** Every fix is one of two kinds, and the kind decides who makes it.
*Presentation* changes how what the product already does looks and reads: contrast, spacing, size,
alignment, labels, wording, focus order, the visible states of existing elements. You decide and make
these. *Behaviour* adds, removes or changes what the product does: an operation, a step, a screen
state, a limit, a confirmation, an error policy. You never make these on a reviewer's word; they go to
the user (see "Behaviour gaps go to the user after every round" below). When a fix could be read as
either, it is behaviour.

Work in three stages, because a full run of every journey after each fix is the most expensive way to
get there:

1. **Fix what the measurements already show, with no reviewers.** The capture measures contrast,
   sideways overflow, control sizes, text sizes, labels and heading structure on every screen
   (`facts/*.json`), and its probe pass records keyboard stops that show no focus, controls the
   keyboard never reaches, controls that look the same in every state, and movement that ignores the
   reduced-motion preference (`keyboard/`, `states/`, `motion/`). Capture every journey, fix what those
   files show product-wide, capture again and confirm with `UXQ regress`, which lists what the new
   capture counted better and worse. This costs no reviewer and removes the defects every journey
   shares.
2. **One journey at a time.** Open a run, capture and bundle with `--unit <journey>`, review, collect,
   score. Fix the fix order through the project's normal process, **every problem in it in the
   same round**, not only the top: fixes often land in shared components and lift several journeys at
   once, and a round per issue wastes reviewers. While a journey's lowest role is more than 5 points
   below target, leave out polish that a single reviewer raised; it comes back if it matters. Once
   every role of the journey is within 5 points of target, or nothing but polish is left for it, fix
   that polish too: near the target the small problems are what is left between the score and the
   target. Work top down, and where a fix is not yours to make (an approval, a behaviour change),
   record it and go on. Fix through the project's normal process: its tests, its review and approval
   rules, its change procedure. This skill grants no exemption from any of them.

   **Who fixes.** When a round's fix order runs to dozens of problems across many files, split it by
   area (the screens and files each owns) and give each area to its own fix agent working in parallel,
   with a brief that holds the presentation/behaviour rule, the files it owns and the selectors the
   capture uses. A small round, or one confined to a few files, you fix yourself. Either way, every
   problem one area hands to another ("this belongs in their file") is yours: after the fix agents
   finish, fix each hand-off yourself or give it to one named owner, before you commit. A problem that
   passes between areas without an owner is not fixed.

   **What a fix is made from.** A fix that only answers the reviewer's sentence tends to trade one
   issue for another. Make each fix from the project's own design system and its recorded decisions,
   and give every fix agent the same grounding. If the `interface-craft` skill is installed, hand it
   to whoever makes the fixes: it says which source settles which kind of question, its review
   standards use the same criterion ids as these rubrics (A1 to R8), and its decisions file is the one
   the config names under `decisions`. Neither skill needs the other; without it, use the project's
   design system and conventions. When the user settles a question of style, record it in the
   decisions file so that later reviewers are handed it; the scorecard says which decisions the
   reviewers were given and warns when they changed between runs.

   **Behaviour gaps go to the user after every round.** After the fixing round, show the user every
   behaviour change the reviewers asked for that is still open, the new ones and the old: for each,
   what the reviewers asked for, their evidence (quoted, with the journey and role), the smallest
   version that would answer it, and your recommendation. Group them so they can be answered at once.
   Build what the user approves in the next fixing round; record what they decline or defer in the
   project's gap log with their answer. A journey whose problems below target are all waiting on the
   user is not reviewed again until the user has answered; say so rather than spending reviewers on it.
   When reviewers reject a style in two successive forms (a button drawn one way, then its
   replacement), stop changing it: it is a choice between designs, and it goes to the user with the
   gaps.
   Commit, open a new run, capture, and run `UXQ regress` before any reviewer is started: what the
   fixes made measurably worse is put right first, at no reviewer's cost. Then review the journey
   again with **new reviewers**; nothing from the earlier
   round reaches them. `UXQ progress --config CFG --target N`, with N the user's target, reads the ledger and says, for every
   journey, whether it is at target, below target (with the roles below target and the roles whose
   reviewers disagree), not yet reviewed, or stalled (two rounds in a row gaining under 2 points
   overall), and in `then` what to do next. A role whose reviewers disagree is worked on like a role
   below target: fix what they reported, commit, review again with fresh reviewers. A stalled journey
   waits until no other journey is open.

   **A plateau stops the loop.** When only stalled journeys are left below target, or the last two
   runs of every journey together each gained under 2 points overall, `progress` reports
   `plateau: true` and its `then` begins "Stop and ask the user". More of the same fixing is then
   unlikely to move the score, and going on is the user's call, also when they said to run
   unattended. Stop and put the four choices to them, with the standing issues and what
   `improve.md` records as tried: accept the scores as they stand; try a different approach (say what
   would change); lower the target; or go through the standing issues by hand (`findings.md` of the
   last run) and choose which are worth fixing. Record the answer in `improve.md` before any more
   fixing, and follow it; `progress` goes on reporting the plateau until a new run is scored.
3. **Every journey together.** When no journey is left to work on singly, run all of them in one run
   with the control unit: with `screening_judges` set, that is `new-run --confirm`, and `progress` says
   so in `then`. A journey that fell back goes round stage 2 again.

Unless the user said to run unattended, ask before each fixing round and stop after three rounds, or
when a round gains less than 2 points with no blocker or major left. When they set a target and said to
keep going, those limits no longer apply; everything else does, the stop at a plateau included. A round that lowers a score is
information, not failure: report it plainly and look at which role moved. If the last full run says the
reviewers are too harsh, tell the user: the target may be out of reach of these reviewers rather than
of the product.

Never move a score by any means other than changing the product: the isolation rules, the rule against
tuning the measurement and the project's own approval rules hold for every round. Where a fix needs
something only the user can give (an approval, a decision between two designs), record it, carry on
with work that does not depend on it, and bring it to the user with the round's behaviour gaps (see
"Behaviour gaps go to the user after every round" above) rather than holding it to the end.

### Stopping and picking up again

A long effort will be cut off: a usage limit, a closed session, a crash. Everything needed to carry on
is in files, so any later session can continue without the conversation that started it.

- **Where a run stands:** `UXQ status --config CFG --run RUN` prints, in `next`, what to do: capture,
  collect results already written, replace reviewers that never reported, start or replace second
  looks, score. In a new session every
  reviewer that had not written its result is gone: `collect --discard-bad`, then `bundle` again and
  start the entries printed. Results already written are kept; no reviewer is ever asked twice.
- **Where the effort stands:** `UXQ progress` as above, from the ledger alone.
- **What only you know:** keep `improve.md` in the review home, and update it at every step, not at the
  end. It holds the user's instruction in their words (target, scope, reviewer model, limits), the run
  now open and what it is for, what each round changed and in which commit, ideas tried that did not
  help, and anything waiting on the user. Write it for a reader who has seen nothing else.
- **Commit after every fix** (locally, by the project's rules) before opening the run that measures it,
  so the run's commit is the state it measured and nothing is lost with the session. Commit the
  config, capture plan, ledger, `improve.md` and each run's `scorecard.md`, `scorecard.json` and
  `findings.md`; keep screenshots, page text and measurements (`runs/*/evidence/`) out of version
  control, since any run can be captured again from its commit. The control screens are the one
  exception to recapturing: keep them (backed up, or committed if the project allows), because a
  recaptured control starts a new series.

On starting or resuming, read `improve.md`, run `progress`, then `status` on the open run, and do what
they say. Do not rely on memory of the conversation for any of it.

## Keeping scores comparable

A number today should mean what it meant a year ago.

- **The rubrics and briefs are frozen per version.** Do not edit anything under `judge/` during or
  between runs to suit a product. When something must change (a new criterion, a reworded scale),
  change it deliberately and raise `Rubric version` in every rubric of the set. The script records a hash of
  what reviewers read (the rubrics and the three briefs), and of the numbers the scoring arithmetic
  uses, in every ledger line, and marks where comparability breaks. A change to how scores combine in `scripts/uxq.cjs` is a change to the
  yardstick in the same way.
- **The config is part of the measurement.** Adding journeys, rewording a persona or a goal, changing
  roles, weights, screen sizes or the number of reviewers starts a new series. That is fine when the
  product grows; do it on purpose and tell the user.
- **The decisions file is recorded, not frozen.** It grows as the project decides things, so it is
  not part of the config hash and a new decision does not start a new series. Each run keeps the copy
  its specialists were handed and its hash (`decisions_sha`), and `score` warns when it differs from
  the run it compares with: part of a change in score may then be the decision, not the interface.
  Say so when you report it.
- **Control screens never change.** They are the fixed yardstick. If the model behind the reviewers
  changes, the share of planted defects caught and of false alarms raised is how you tell a different
  reviewer from a different product.
- **The ledger is append-only.** Never rewrite or delete a line. A corrected score is a new line
  (`--rescore`). `UXQ trend --config CFG` prints the history.

## Reporting

Lead with the overall score and the six role scores out of 100, whether the reviewers were strict
enough to trust them (too kind, too harsh, or acceptable), and the change against the previous
comparable run. In the loop, add where each journey stands against the target. Then, from
`scorecard.md`:

- the roles, weakest first, since they say what kind of work is needed;
- the journeys, weakest first, since they say where;
- the top of the fix order, counting problems and not reports, with the suggested fixes;
- the reasons the reviewers gave for the weakest scores, quoted, since that is what the user asked for;
- what did not count as given and why: scores held to their own issues, scores counted again after a
  second look, roles whose reviewers still disagree, missing reviewers;
- the second looks: which issues were upheld, lowered or not upheld, and any serious issue that was
  not checked;
- what `regress` showed against the capture before, and whether the design decisions handed to the
  specialists changed;
- anything the capture hid as not part of the product, since the reviewers did not see the pages as
  they were.

Say what the scores cannot see. The user reviewer is a model playing a person: it is a disciplined
walkthrough, not a usability test, and it does not replace watching real people. Reviewers work from
files: still pictures, page text, measurements and, from the probe pass, the walk with the Tab key,
the looks of the main controls in each state, the movement the page declares, and frame strips for
the steps named under `motion_steps`. That is more than screenshots and less than using the product
(`references/config.md`, "What the probes cannot show"): a strip of frames is a few pictures, not the
feel of a movement; states the browser was told to apply show what the stylesheet does, not what a
script does; the probe pass runs at one screen size; nobody used a screen reader. Timing as a person
feels it and real assistive technology stay outside the score unless a unit is marked live. A high score is evidence about the
journeys in the config, not about screens no journey visits. Share your own disagreements with
reviewers as opinion, separate from the numbers.
