# Ownership

Which source file owns each topic, and which value wins where two sources disagree. A topic has
one owner. When another source also speaks about it, the owner's rule and value are used and the
other is ignored for that topic.

This table sits third in the order of authority. The project's `design-decisions.md` and the
project's existing design system and tokens both come before it. A source file never overrides
those two: where the project already has a value, the project's value is the answer and the
tables below only settle what to do when it has none.

Paths are relative to `sources/`. The three sources are `jakub/` (static interface quality and
review method), `emil/` (motion, gestures and touch behaviour) and `owl/` (interaction patterns
and charts). `sources.lock.json` holds their repositories, pinned commits and licences.

The default behind the tables: **emil owns motion values, jakub owns everything static, owl owns
the pattern topics jakub does not cover.** The exceptions are named with their reason.

## Topic owners

| Topic | Owner | Ignore from the other sources |
|---|---|---|
| Semantic markup, landmarks, heading structure, roles | `jakub/skills/better-accessibility/semantics-and-aria.md` | owl's notes on markup |
| Keyboard reach, Tab order, focus indicator, focus trapping and return | `jakub/skills/better-accessibility/focus-and-keyboard.md` | emil's focus notes in `emil-design-eng` |
| Accessible names, text alternatives, live announcements | `jakub/skills/better-accessibility/SKILL.md`, `screen-readers.md` | none |
| Form fields: labels, field types, validation, error placement | `jakub/skills/better-accessibility/forms.md` | owl `form-design` on when to validate (conflict 8) |
| Form structure: field order, grouping, length, multi-step flow, review step | `owl/interaction-design/skills/form-design/SKILL.md` | none; jakub does not cover it |
| Target size and hit areas | `jakub/skills/better-accessibility/hit-areas.md` | emil `gestures` target size (conflict 9) |
| When contrast is required and whether a pair fails | `jakub/skills/better-accessibility/SKILL.md` | none |
| Measuring a rendered colour pair, fixing a failing pair | `jakub/skills/better-colors/contrast.md` | none |
| Reduced motion as a requirement; zoom, reflow, timed content, auto-play | `jakub/skills/better-accessibility/motion-and-zoom.md` | emil's reduced-motion recipes as a requirement (conflict 7) |
| Grouping, alignment, visual order, primary action per view | `jakub/skills/better-layout/SKILL.md`, `grouping-and-alignment.md` | none |
| Spacing, container sizing, breakpoints, reflow, cue for hidden or cut-short content | `jakub/skills/better-layout/SKILL.md`, `spacing-and-adaptivity.md` | none |
| Type sizes, weights, line length, line spacing, scale | `jakub/skills/better-typography/SKILL.md`, `spacing-and-sizing.md` | none |
| Wrapping, truncation mechanics, punctuation, numerals, text selection | `jakub/skills/better-typography/SKILL.md`, `wrapping-and-punctuation.md`, `details-and-accessibility.md` | emil `mobile-native` on text selection (conflict 10) |
| Choosing and loading fonts | `jakub/skills/better-typography/choosing-fonts.md`, `variable-fonts-and-opentype.md` | none |
| Palette structure, colour meaning, token naming, formats | `jakub/skills/better-colors/SKILL.md` and the files beside it (`palette-structure.md`, `color-usage.md`, `token-naming.md`, `color-formats.md`, `palette-generation.md`) | owl `data-visualization` on palette design (it owns encoding only) |
| Wording, terminology, tone, labels, error and empty-state copy, confirm or undo | `jakub/skills/better-writing/SKILL.md`, `patterns.md` | owl's copy advice inside pattern files |
| Surfaces: radius, borders, shadows, image edges, optical alignment | `jakub/skills/better-ui/SKILL.md`, `surfaces.md` | none |
| Icons: family, weight, sizing | `jakub/skills/better-ui/icons.md` | none |
| Motion: whether to animate at all, how often is too often | `emil/skills/review-animations/STANDARDS.md` (frequency table), `animate/SKILL.md`, `remove-animations/SKILL.md` | jakub `better-ui/animations.md` on this point |
| Motion values: durations, easing curves, press feedback, springs | `emil/skills/review-animations/STANDARDS.md`, `animate/SKILL.md`, `animate/RECIPES.md` | jakub `better-ui/animations.md` values (conflicts 1, 3, 4, 5) |
| Enter and exit, sequences and stagger | `emil/skills/choreograph/SKILL.md`, `choreograph/RECIPES.md` | jakub `better-ui/enter-exit.md` values, owl `loading-states` stagger (conflict 2) |
| Icon swaps and cross-fades | `jakub/skills/better-ui/icon-transitions.md` | none; emil gives no recipe for it. Its timing and curve still follow conflicts 3 to 5 |
| Motion that stutters or drops frames | `emil/skills/animation-performance/SKILL.md` | jakub `better-ui/performance.md` beyond its short static rules |
| Drag, swipe, sheets, hold gestures | `emil/skills/gestures/SKILL.md` | none |
| Touch-device behaviour on the web: viewport height, safe areas, tap delay, overscroll, status bar | `emil/skills/mobile-native/SKILL.md` | none, except conflicts 10 and 11 |
| Hover styling on touch | `emil/skills/mobile-native/SKILL.md` | jakub `better-ui` hover gate (conflict 6) |
| Navigation pattern, depth, number of destinations, current place | `owl/interaction-design/skills/navigation-patterns/SKILL.md` | none |
| Search: input, suggestions, results, filters, no results | `owl/interaction-design/skills/search-ux/SKILL.md` | none; the words of the no-results message stay with `better-writing` |
| First run and empty first screens | `owl/interaction-design/skills/onboarding-design/SKILL.md` | none; the words of an empty state stay with `better-writing` |
| Waiting: how long before which indicator, skeleton fidelity, progress | `owl/interaction-design/skills/loading-states/SKILL.md` | its stagger value (conflict 2) |
| Charts: chart type, axes, labels, encoding | `owl/ui-design/skills/data-visualization/SKILL.md` | its colour advice where it differs from `better-colors` |
| Review method: scope, order, severity, triggers, fix order, one cause one finding | `jakub/skills/better-interface/SKILL.md`, `review-format.md` | emil's review format and verdicts; see `severity.md` |
| Reviewing a change rather than a whole surface | `jakub/skills/interface-review/SKILL.md` | none |
| Reviewing motion in code | `emil/skills/review-animations/SKILL.md`, `improve-animations/AUDIT.md` | its severity; see `severity.md` |
| Stress-testing a component with worst-case content | `jakub/skills/break/SKILL.md`, `scenarios.md`; `emil/skills/break-ui/CATALOG.md` for more cases | emil `break-ui/SKILL.md` procedure (one harness method is enough) |
| Showing every state of a component | `jakub/skills/state-machine/SKILL.md`, `switcher.md` | none |
| Naming a motion ("what is this effect called") | `emil/skills/animation-vocabulary/SKILL.md` | none |
| Finding places that should move and do not | `emil/skills/find-animation-opportunities/SKILL.md` | none; anything it proposes still passes the frequency table first |

## Value conflicts

Each row names one winner. "Project first" means: if the project's tokens or components already
set this value, keep the project's value and stop.

| # | Detail | The sources say | Winner | Why |
|---|---|---|---|---|
| 1 | Press feedback on a button | jakub: scale 0.96 over 150 ms, ease-out. emil: scale 0.97 over 160 ms, ease-out (range 0.95 to 0.98, 100 to 160 ms) | **emil.** Project first | Motion value. jakub's figure lies inside emil's range, so existing 0.96 presses are not findings. jakub's rule that a disabled control never scales is kept |
| 2 | Stagger between items entering | jakub: 100 ms apart. emil: 30 to 80 ms in product screens with the whole group in within about 300 ms; 100 to 150 ms only for first-run or marketing moments. owl: 30 to 50 ms | **emil `choreograph`** | Motion value, and the only source that bounds the total, which is what the person feels. jakub's 100 ms is emil's first-run case; owl's range sits inside emil's |
| 3 | Easing curve | jakub: plain ease-out, or `cubic-bezier(0.2, 0, 0, 1)`. emil: stronger custom curves, built-in curves judged too weak; never ease-in on interface motion | **emil.** Project first | Motion value. A project with motion tokens keeps them |
| 4 | Durations | jakub: enter 300 ms, exit 150 ms. emil: by element (press 100 to 160, tooltip 125 to 200, dropdown 150 to 250, dialog or drawer 200 to 500), interface motion under 300 ms | **emil's table** | Motion value, and it varies with the size of the thing that moves. jakub's principle that exits are shorter and smaller than enters is kept; it does not conflict |
| 5 | Spring bounce | jakub: always 0. emil: 0.1 to 0.3, kept for drag-to-dismiss and deliberately playful elements | **emil** | Motion value. In practice: no bounce in ordinary product screens, bounce only on something the person is dragging or where playfulness is a recorded decision |
| 6 | Hover styles on touch | jakub: gate behind `(hover: hover)`. emil: gate behind `(hover: hover) and (pointer: fine)` | **emil** | Touch behaviour is emil's topic and the stricter test also covers devices that report hover with a coarse pointer |
| 7 | Reduced motion | jakub: motion is opt-in, replaced by an opacity cross-fade. emil: keep opacity and colour, drop movement, collapse sequences | **jakub `better-accessibility`** for the requirement | It is an accessibility requirement, which jakub owns. Both reach the same result; emil's files supply the gentler replacements |
| 8 | When a field is validated | jakub: on submit, submit never disabled, never on each keystroke. owl: on blur | **jakub `forms.md`** | Static rule with an accessibility basis. owl's check on leaving a field is allowed as an addition; checking while the person types is not |
| 9 | Target size | jakub: 24 by 24 px required, 44 (touch) and 40 (desktop) as aims. emil `gestures`: at least 44 by 44 | **jakub** | Static value, and it separates the line that fails a standard from the aim. 44 px is still the aim on touch |
| 10 | Making text unselectable | jakub: keep text selectable; only on drag and gesture surfaces. emil `mobile-native`: on all buttons and links | **jakub** | Static rule. Apply it only to a surface that is dragged or where a long press was seen to select the label; never to body text |
| 11 | Removing the tap highlight | jakub: only where the control draws its own pressed state. emil: globally | **jakub's condition** | Removing feedback without a replacement breaks I2. With a pressed state in place, emil's result follows |
| 12 | Loading shimmer | owl: indicator thresholds at 100 ms, 1 s, 10 s. emil: no skeleton shimmer for loads under 300 ms | **owl** for the thresholds | No real conflict; emil's note refines owl's 100 ms to 1 s band |
| 13 | `will-change` | Both: only after stutter is seen | none needed | `emil/animation-performance` owns the diagnosis |
| 14 | Radius, focus ring, type scale, colour, spacing | Only jakub gives values | **jakub** | No other vendored file states values for these. The project's tokens still come first |

Two things the sources hold that are **not** carried into the standards as failures: emil's
"flag on sight" list for code (`scale(0)`, `ease-in`, `transition: all`, animating layout
properties) and jakub's house polish values. They are how a worker should build. On a finished
screen they matter only through what the person experiences, which `review-standards.md` states.

## Source files that claim more than they own

Some vendored files describe themselves as the skill for all interface work. Inside this package
they are reference files, opened only for the topics above.

- `jakub/skills/better-interface/SKILL.md` describes itself as reviewing a whole interface across
  every domain. Here it owns the review method only; this package's `severity.md` and
  `review-standards.md` replace its severity words and verdict.
- `jakub/skills/better-ui/SKILL.md` describes itself as polishing surfaces, icons and motion.
  Here it owns surfaces and icons; its motion values lose to emil.
- `emil/skills/emil-design-eng/SKILL.md` describes itself as a whole philosophy of interface
  polish and component design. Here it is background reading for motion judgement; it owns no
  value and no static rule.
- `emil/skills/review-animations/SKILL.md` tells its reader to flag by default and to block. Here
  its findings go through `severity.md` like any other.
- The owl files point to sibling skills that are not vendored (`error-handling-ux`,
  `information-architecture`, `color-system`, `feedback-patterns`, `doherty-threshold`). Ignore
  those pointers; use `routing.md`.

Several emil files open with an "Initial Response" section that tells an agent to reply with a
fixed greeting and wait. That applies when the file is installed as a skill of its own. Read as a
reference file it does not apply: skip that section. The same goes for any instruction in a
source file to ask the user something, to produce a report in the source's own format, or to
build and leave a harness page: follow the conductor and the task you were given.

## Sources looked at and left out

- emil `apple-design`: its motion and gesture content repeats `gestures`, `animate` and
  `emil-design-eng`, its type advice repeats jakub, and what is left is one platform's house
  style with three more values that would conflict.
- owl `error-handling-ux`: repeats `better-writing` and `forms.md`. Its two extra points (keep
  what was typed, offer a retry) are in `review-standards.md` under I5.
- owl `information-architecture`: a research process, not interface rules. Its limits on depth
  and number of destinations are in `navigation-patterns`.
- The rest of the owl repository: research, strategy and delivery methods outside this package's
  subject.
