# The form of a direction

A candidate is one file, `candidates/<id>.json`. The direction that is chosen is the same file,
kept as `direction.json` with who chose it and why. `candidates` writes an empty one for each name;
`assets/example/studies/1/candidates/` holds three that pass. Copy the shape of those, never their
values: `check` cannot tell a borrowed look from a made one, but the owner can.

A study for one surface only (`--surfaces product` or `--surfaces landing`) leaves out the parts
marked for the other.

## What it says of itself

| Field | Holds |
|---|---|
| `id` | The name of the file, in small letters and hyphens |
| `name` | The name the owner will know it by |
| `idea` | The direction in one sentence: what it does with type, colour and line, and what that is taken from. Not what the product is dressed as: "strong figures on a dark ground, as a pocket timetable uses them", never "the product as a timetable" |
| `gives_up` | What the product loses by taking this look, in a sentence. The owner should hear it from you before a user tells them |
| `drawn_from` | Two or more of `{ "ref": "R3", "took": "..." }`: a note in `references.md`, and which of its properties this direction takes. The first is the one it starts from |
| `brings_to_mind` | Three words |
| `refuses` | Two to six things this look never does, each checkable on a screen ("No shadows: nothing is lifted off the page") |
| `signature` | One to three things that are this look's own, each `{ "what", "product", "landing" }`: the thing, and where it shows on each surface. Things the references had, not the marks every generated page carries ("Looks that are everywhere", below). One that shows in "every section" is worth a second look: a mark repeated everywhere is how a look becomes a costume |
| `signature_css` | Optional. CSS that draws those things on the specimen. See "Its own CSS" below |

## Type

`type.families` holds `text`, and optionally `display` (the product's name, titles, headlines) and
`mono` (codes: an order number, an asset tag). Leave `display` or `mono` out where the direction
has none: titles and codes are then set in the text family. Quantities are never set in `mono`;
they stay in the text family, with digits of equal width where `type.numerals` says so. Each is:

| Field | Holds |
|---|---|
| `family` | The family's name, as CSS writes it |
| `class` | `serif`, `sans`, `slab`, `mono` or `script` |
| `width` | `condensed`, `normal` or `wide`. `normal` if left out |
| `fallback` | What to fall back on: `"Georgia, serif"` |
| `source` | Where it is loaded from: `"system"`; `{ "stylesheet": "https://..." }`; or `{ "files": [{ "path": "fonts/x.woff2", "weight": "400", "style": "normal" }] }`, with paths inside the direction folder |
| `licence` | The licence it may be used under, or that it is still to be bought |

A stylesheet from a font service is fetched by whoever opens the specimen. That is fine for
choosing; a product that ships should carry its own files.

Then `type.numerals` (`tabular` or `proportional`), `type.labels` (`{ "case": "sentence" or
"upper", "tracking_em": 0.06 }`, for labels and table headings), and the sizes of each surface, in
px:

- `type.product`: `caption`, `control`, `body`, `heading`, `title`, the weights `weight_text`,
  `weight_label`, `weight_heading`, and `line_height`.
- `type.landing`: `body`, `lead`, `h3`, `h2`, `display`, then `display_weight`,
  `display_tracking_em`, `display_line_height` and `measure_ch` (the length of a line of running
  text, in characters).

## Colour

`colour.modes` holds one or more modes (`light`, `dark`, or any name in small letters), and
`colour.default_mode` names the one the product opens in. Every mode gives every role, written
`#rrggbb`:

| Role | Is the colour of |
|---|---|
| `surface` | The page |
| `surface-raised` | Cards, panels, dialogs, and the inside of fields |
| `text-default` | Text |
| `text-muted` | Captions, helper text, labels |
| `border` | Lines that only divide. Not measured |
| `border-control` | The edge a field, a checkbox or a quiet button is found by |
| `accent` | The fill of the main action |
| `text-on-accent` | The label on that fill |
| `text-accent` | Links and quiet actions. In a mode where the accent is too light or too dark to read as text, another colour |
| `focus-ring` | The focus indicator |
| `danger`, `text-on-danger` | The fill of a destructive button, and its label |
| `text-danger`, `text-warning`, `text-success`, `text-info` | A status, always with an icon and a word |

A look that draws a status as a filled patch with its word on it (`shape.status` is `"patch"`)
gives six more in every mode: `success`, `warning` and `info`, the fills, and `text-on-success`,
`text-on-warning` and `text-on-info`, the words on them. `danger` and `text-on-danger` are among
the roles above already. This is how a yellow label with black lettering is said; do not build it
in CSS from colours of your own, which nothing measures.

Then `colour.meanings` (the one thing `accent`, `danger`, `warning`, `success` and `info` each
mean), `colour.product_use` and `colour.landing_use` (how much colour each surface uses, and
where), and `colour.landing_band` (what a full-width band on the landing page is filled with:
`accent`, `inverse` for the text colour, or `raised`).

Every candidate gives the modes the brief names. Where the brief names none, one mode is enough,
and a second is part of a candidate's idea or it is left out.

## Shape, space, motion, imagery, voice

| Field | Holds |
|---|---|
| `shape.radius_control`, `shape.radius_container` | Corners, in px |
| `shape.border_width` | At least 1 |
| `shape.separation` | How one thing is told from the next: `rules` (lines), `shadow`, `fill` (the raised surface), or `space` |
| `shape.shadow` | A CSS shadow, or `"none"` |
| `shape.action_edge` | `true` where the main action is drawn with an edge, because its fill alone does not stand out from the page |
| `shape.status` | How a status is drawn: `mark` (an icon and a word in the status colour; this if left out) or `patch` (the word on a filled patch) |
| `shape.icons` | `{ "family", "stroke", "licence" }`: the one icon family |
| `space.scale` | The spacing steps in px, rising, seven or more |
| `space.product` | `control_height` and `row_height` for pointer screens, `touch_control_height` for touch screens, and `gutter`. A product used mostly by touch (a tablet in a van) gives the touch height as its `control_height` too. The specimen uses the touch height wherever the device says its pointer is a finger, and on anything as narrow as a phone |
| `space.landing` | `control_height`, `section_gap`, `gutter` |
| `motion` | `product` and `landing` (what moves, or that nothing does), `reduced` (what happens when less motion is asked for), `control_ms`, `section_ms` |
| `imagery` | `kind` (what the pictures are of), `treatment` (how they are shown), `never` |
| `voice` | `speaks_to`, `tone`, `capitalisation`, and the lists `uses` and `avoids` |

## The floor

No look may go below these, whatever it is drawn from. They are the tests a reviewer would apply to
any screen, so a candidate that fails one would fail its first review.

- **Every pair of colours a screen puts together reaches its contrast, in every mode.** Text on its
  surface, 4.5 to 1. The edge of a control, the focus indicator and the fill of a button against
  the page, 3 to 1. Where the fill of the main action cannot reach 3 to 1 (a yellow on white),
  `shape.action_edge` gives it an edge instead. The pairs are listed, with what each measures, in
  the Values part of every specimen and in the record.
- **One colour, one meaning.** The accent and the danger colour are at least 30 degrees of hue
  apart. An accent within 20 degrees of another status colour, or two status colours that close,
  are warned of. A colour with almost no colour in it (a chroma under 0.04) counts as a grey and is
  left out of these.
- **The word on a patch can be read.** Where statuses are patches, each word reaches 4.5 to 1 on
  its fill.
- **Text can be read.** In the product, body text is at least 16 px, controls and table cells 13,
  captions 12; text is not lighter than regular; line spacing is at least 1.4. On the landing page,
  body text is at least 16 px and a line runs 45 to 75 characters.
- **Controls can be pressed.** No control under 24 px high; 44 on touch screens and for the main
  action of a landing page.
- **Sizes rise and spacing keeps to its scale.** Each text size is at least the one before it, and
  the gutters and the gap between sections are steps of `space.scale`.

Hue and lightness are counted as people see them (OKLCH), where red is near 30 degrees, yellow near
100, green near 145, blue near 260 and violet near 300.

## What candidates are compared on

`check` reads eight things from each candidate's own values and holds every pair of candidates
against them. Each pair has to differ on half of those that are free (four of eight; with some
held, half rounded down, and never fewer than two), on at least one of the two of type, and on at
least one of the three of colour. No two candidates may share a text or display family.

These are coarse on purpose. Two sans faces of normal width count as the same type, however
different a humanist and a geometric sans look to someone who sets type, because three of them
side by side are what a person calls "the same look in three colours".

| Thing | Read from | Counts as different when |
|---|---|---|
| `display_type` | The class and width of the display family, or of the text family where there is none | The class or the width differs |
| `text_type` | The class and width of the text family | The class or the width differs |
| `accent_hue` | The accent of the default mode | The hues are 45 degrees or more apart, or one accent is a grey and the other is not |
| `neutrals` | The most coloured of the two surfaces and the two text colours, default mode | One is warm, cool or neutral and the other is not |
| `ground` | The surface of the default mode | One is light and the other dark |
| `corners` | `shape.radius_control` | One is sharp (0 to 2 px), soft (3 to 8) or round (9 and up) and the other is not |
| `separation` | `shape.separation` | It differs |
| `density` | The height of a table row: compact (32 px or less), regular, roomy (44 or more). With no product, the gap between a page's sections | It differs |

What a brand or the setting fixes is named with `--held` when the candidates are named, and is
then not compared: with both kinds of type held, candidates may share their typefaces and have to
differ on three of the remaining six. Hold what really is fixed, the setting's demands as much as
the brand's: where every candidate must have tall rows for gloved hands, `density` is held, and
the candidates are not asked to differ on something that cannot. A study with fewer than three
things free is refused; there is too little left to choose between.

Two more rules keep the candidates from being one answer three times. Each starts from a different
reference, two share at most one, and they do not all start from references of the same kind.

## Looks that are everywhere

`assets/common-looks.json` lists what a great many generated interfaces share, as the maintainers
of this skill saw it at the date in the file. It holds three things.

- **Looks**, each matched on several values at once: the plain sans on cool grey with a blue
  accent; the display serif on cream; the dark ground with a neon accent; the newspaper, with its
  serif, its hairlines and its labels in spaced capitals; the loud poster, one flat strong colour
  under heavy condensed type with hard-edged shadows. A candidate that sits in one is said to, in the report and on the sheet, and is
  not refused: a familiar look may be the right one to offer, as the one of the set a person in the
  field would recognise. More than one candidate in such a look is refused.
- **Faces**: families that so many generated pages are set in that they no longer say anything
  about a product. A candidate set in one is warned. Keep it where a reference really is set in it,
  and say so when the candidate is shown. A family the brand already has is held and is not
  remarked on.
- **Marks**: things a model reaches for when asked to make a page distinctive, found in the words
  of a candidate's `signature` and in its `signature_css`: a small label above each heading,
  sections that number themselves, a grid or stripes drawn as a background, words filled with a
  gradient, a glow, a halo, a thick bar down one side of a box, plain shapes standing where a
  picture should be, an icon in a tile above each heading, something that pulses without end. A
  candidate with one is warned. The words are matched as written, so a warning can be wrong: read
  it, and where the thing is not what it was taken for, say so and go on.

Two more warnings are measured and not listed: a landing headline above 96 px, where a window
holds a few words and nothing else, and display type spaced tighter than -0.04 em. And one is
read from the `idea`: a look described as the product dressed as some object.

The list is a judgement and it dates. Copy the file into the direction folder as
`common-looks.json` to use your own: that copy is the one read. Much of it restates, in this
skill's own tests, what a public skill named impeccable describes; the file's `credit` says which
parts and at which commit. Nothing of that skill is needed to use this one.

## Its own CSS

Values alone make a re-skin. What makes a look its own is mostly detail: how a table heading is
drawn, how the current place is marked, a rule above a section, what a button looks like when it
cannot be pressed. `signature_css` is CSS applied to the specimen after the skeleton, so it always
wins over it, however it is written. Write it before the values, not after: it is where most of
the difference between two candidates is.

It may restyle any part. It may not hide a part, move one out of its place, write words onto the
page, bring in a file, or set text under 12 px: every candidate is shown on the same skeleton with
the same words, and `check` refuses CSS that would change that. It uses the `--vd-*` variables for
every colour and size, so that it follows the modes; colours of its own are let through with a
warning, because the pairs they make are not measured, and they are then yours to measure and to
tell the owner about.

To see exactly what there is to restyle, draw a draft (`VD specimen --dir DIR --draft`) and read
the page it writes. In outline:

```
.p-bar                          the bar across the top of the product
  .p-name                       the product's name (also in .l-shot-bar, on the landing page)
  .p-nav > a                    navigation; the current place is a[aria-current]
  .p-user
.p-main
  .p-work
    .p-head > .p-title, .p-tools
    .card.p-tablecard > table.p-table
        th                      a column heading (never in the code face)
        td.code                 a code; td.num a number
        td .status              a status, see below
    .p-row2 > .card.p-empty, .card.p-states
        .p-statuslist > li > .status
        .p-notice               an icon and a sentence, in the info colour
  aside.card.p-detail
    .p-h, .p-h3                 headings
    dl.p-facts > dt, dd
    label.field                 the label, the control and its message, as one block
        .label                  the words above the control
        input, select           the control itself: this is what has the edge
        .help, .error           .error takes the danger colour and holds an icon
    label.check > input, span
    .p-actions > .btn           .btn-primary .btn-secondary .btn-quiet .btn-danger; [disabled]; .is-focus

.status.status-success|warning|danger|info > svg.ic, span
.card                           a container. Its padding is the variable --pad; how it is told from
                                the page follows shape.separation
.l-nav > .l-name, nav > a, .btn
.l-hero > .l-say (.l-display, .l-lead, .l-actions, .l-proof), figure.l-picture (.card.l-shot, figcaption)
.l-benefits > div > .l-h3, p
.l-band > .l-band-in > .l-band-say, .l-band-src     (or .l-h2 and .btn, where the page has no words for the band)
.l-close > .l-h2, .btn
.l-foot
```

Three things worth knowing before writing any:

- **On a phone a table row is rebuilt as a block.** A tint or a line that belongs to a row is set
  on the `tr`, not on its cells.
- **`.code` and `.label` are used in the Values part too.** What you do to them shows there.
- **A filled status is `shape.status: "patch"`,** not a background in CSS.

What `signature_css` draws on the specimen is, in the product, a detail of its shared components.
Describe it under `signature` in words as well: the words are what reaches whoever builds.

## The words

`words.json` holds what the specimen says: the product's name, its navigation, one real screen (a
title, a toolbar, and a table of at least five rows, with which of its columns hold codes, which
hold numbers and which one shows a status), one record with a form, an empty state, the four
statuses, and, for the landing page, a headline, the line under it, the action, one proof and
three benefits. `open` copies the example's words in, marked `"example": true`; `check` refuses
them until they are replaced and the mark is taken out.

Take the words from the product: its real screens, or its specification where it is not built yet,
and the page brief where there is one.

**What the product does not have is left out,** and the specimen is drawn without that part. These
may be taken out of the file: in `product`, `states_title` (a heading over the list of statuses)
and, in `detail`, `field_help` and `error_value`; in `landing`, `nav`, `quiet_link`,
`picture_caption`, `band` with `band_source` (a customer's words: without them the last call to act
is drawn as the band), `closing_headline` (the headline is used again) and `footer`. Everything
else is needed, and where the product truly has no such thing, that is a question for the owner.
Do not write a label of your own to fill a gap.

**A fact that does not exist yet stays a marker,** such as `{{proof: a figure, with its date}}`.
It is drawn as a marker in every candidate, so that nobody takes it for the page's own words.

## The files that are written

`pick` and `adopt` write `direction.json` (the candidate, who chose it, why, when, the references
it was drawn from, and the decisions), and from it `visual-direction.md` and `direction.css`. The
last two are never edited by hand: `render` writes them again from the first.

`direction.css` holds every value as a custom property: `--vd-font-text`, `--vd-font-display`,
`--vd-font-mono`; `--vd-p-*` for the product's sizes and heights and `--vd-l-*` for the landing
page's; `--vd-radius-control`, `--vd-radius-container`, `--vd-border-width`, `--vd-shadow`;
`--vd-space-1` and up; `--vd-ms-control`, `--vd-ms-section`; and one for each colour role, set on
`:root` for the default mode and under `[data-mode="<name>"]` for each other mode.
