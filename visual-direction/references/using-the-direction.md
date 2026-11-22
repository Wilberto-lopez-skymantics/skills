# Using the direction

Once the owner has chosen, the look is in three files in the direction folder: `direction.json`
(the source), `visual-direction.md` (the record people read) and `direction.css` (the values). This
file says how it reaches the product and the landing page, and how it is changed.

## One look, two registers

The record gives every value that the two surfaces share (the families, the colours, the corners,
the spacing scale, the voice) and, side by side, what each surface does with them:

- **The product** says it quietly. Small sizes, tight rows, colour kept for the main action and
  for the state a thing is in. People are there to work, for hours, and the look must not ask for
  attention.
- **The landing page** says it aloud. Large type, wide spacing, colour over whole bands, pictures.
  A visitor gives it a few seconds.

A product and a landing page built from the same record are recognisably the same thing at two
volumes. Built from two records, or from none, they are two unrelated sites.

## Handing it to whoever builds the product

`VD render --dir DIR --style` prints two things.

1. **A `## Style` section**, in the form a decisions file takes (type, colour with its contract,
   spacing, shape, density, motion, voice). Put it in the project's decisions file, in place of any
   Style section there. With `interface-craft` installed, that file is the first thing in its order
   of authority, so every screen built or fixed from then on follows the look.
2. **One decision entry**, to add under the file's next free number: that the product's look is
   this direction, with its own marks and what it refuses. It is the owner's decision, already
   made; it is written in their name, with the date and the reason they gave.

Then the values. `direction.css` holds them as `--vd-*` custom properties, for every mode. A
project with tokens of its own keeps its names and points them at these (`--color-accent:
var(--vd-accent)`), so that there is one place where a value lives. A stack that does not read CSS
variables takes the values from `direction.json`.

What the direction calls its own marks are, in the product, details of shared components: how a
table heading is drawn, how the current place is marked. Build each once, in the component, never
screen by screen.

## Handing it to whoever builds a landing page

`VD render --dir DIR --brand` prints a `## Brand` section in the form a page brief takes (type,
colour, shape, spacing, motion, imagery, voice), and a decision entry for the brief. With
`landing-page-craft` installed, the brief is first in its order of authority, and its reviewers are
handed it.

The direction settles what the page looks like. It does not settle how the page is composed: what
the first window holds, how each section is drawn, what the picture is of. The specimen's landing
page is the same arrangement for every candidate, there to show the look, and is not a design for
the page.

## Keeping the files in step

The Style section and the Brand section are copies, written from the record so that each skill and
each reviewer finds the look where it already reads. `VD compare --dir DIR --decisions <file>
--brief <file>` says whether they still say what the direction says, and lists the lines that are
missing or changed. Lines the project added to its own file are left alone.

Run it after any change to the look, and before a review that is handed those files.

## Changing the look later

A look is settled so that it stays settled. When it has to change:

- **A value** (rows a little taller, a darker muted text, a mode added): change it in
  `direction.json`, then `VD decide --dir DIR --title "<the decision in a line>" --decision "<what
  was decided>" --by "<the owner>" --why "<their reason>"`. It is refused if the change goes below
  the floor. It adds the decision to the record and writes the record and the tokens again. Then
  write the Style and Brand sections again from `render`.
- **The whole look:** a new study. `pick` replaces the direction and records which decision it
  supersedes; the earlier studies stay in the folder as the record of what was tried.

Never change the look on a screen, or in the Style section of the decisions file alone. `compare`
would show the drift, and the next person would not know which of the two is right.

## Where the project freezes its design

Some projects specify or freeze how their screens look before they are built: a design document,
approved wireframes, an accepted prototype. There the look is part of what was approved, and a new
direction is a change to that specification, made by the project's own procedure and never beside
it.

- Choose the direction **before** the specification is frozen, while the owner is looking at a
  prototype, and let the specification take its values from the record.
- After a freeze, a study can still be run and a choice recorded, since the direction folder is
  kept outside the frozen set. Bringing the chosen look into the product is then a change request
  like any other. In a project run with the `icm-workspace-template` pipeline that is a Class 1
  iteration, ending in a freeze the user approves.

## With a review loop

A reviewer who is handed the decisions file or the page brief holds each screen to the look
recorded there: a departure from it is the finding, and the look itself is not. So the direction
needs nothing from the review tool, and the tool needs nothing from this skill.

Two things a score will not tell you. Whether the look is the product's own is not something a
rubric of faults measures; the owner's choice is the only measure of that. And a change of look
changes every screen at once, so scores from before and after it are not the same series: say so
when reporting them.
