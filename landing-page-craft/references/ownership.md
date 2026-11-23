# What the sources own here

Three public sources are copied into `sources/`, unchanged, each at a pinned commit with its
licence.

- **The source**, as it is called everywhere in this skill, is
  `sources/elaya/skills/landing-page-design/SKILL.md`. It has two halves. Part A decides what a page
  says and how it is ordered; that half is the reason it is here. Part B is one studio's visual
  house style, written as non-negotiable; here it is negotiable, because a landing page belongs to
  a brand.
- **The catalogue** is `sources/impeccable/`: a list of the things that make a page read as made by
  a model, with four files of notes from the skill it belongs to. It decides nothing about what a
  page says. It is here because a page can follow the source to the letter and still be the page
  every model makes (`references/tells.md`).
- **The third source** is `sources/taste-skill/`: seven files and one script out of a much larger
  skill that builds whole websites from a kit of its own. Two things are taken from it as rules:
  how the words are written and checked, and where pictures come from. Its account of layout is
  taken as a reference only. Its kit and its way of choosing a look and a layout by dealing them
  from a library are not here.

Four words are used below.

- **Rule**: follow it. A dated decision in the page brief is the only thing that sets it aside.
- **Default**: use it only where neither the page brief nor the brand's own system has a value for
  that thing. Where either has one, the source's value is not used and is not an argument.
- **Not used**: do not follow it, whatever the source says about it being mandatory.
- **Reference**: a description of what good pages do, or of what someone measured. It may be the
  start of one alternative that is put to the owner, and it is never followed because it is there.

## Part A, strategy and structure

| Section | Standing | Notes |
|---|---|---|
| A1 Intake | Rule | Its answers are written into the page brief, not kept in the conversation. One change: the source says to assume and carry on when the user cannot answer. Here an assumption about the offer, the audience or the action is a proposed decision the owner confirms, and a missing fact is a marker, never an assumption. |
| A2 Page structure: the first window (parts 1 to 4) | Rule | The headline, the line under it, the action and one sign of proof. |
| A2 Page structure: the picture in the first window (part 5) | Rule | What the picture is, is a decision of the composition. A first window with no picture needs the owner's dated decision. |
| A2 Page structure: what the page answers below the first window, and in what order (parts 6 to 12) | Rule | What was wrong, what changes for the visitor, how it works, who else uses it, what if it goes wrong, the action again. Each is answered, in that order, where a visitor scanning the headings finds it (`review/roles/conversion.md` K5, K6, K9). |
| A2 Page structure: a section for each part, and the counts (three to five benefits, three steps, six to twelve questions) | Default | This is the skeleton every visitor has seen, and a page that takes it without deciding to is recognised before it is read. A composition may answer two questions in one section, give one section most of the page and keep the rest short, and use the number there truly is: two benefits, four steps, the brief's own objections and no others. The skeleton is the first decision in `references/composition.md`. |
| A2 Page structure: its last sentence (the tagline section) | Not used | See B11. |
| A3 Layout selection | Rule | Pick one of the four and record it in the brief with the reason. |
| A4 Conversion rules | Rule | |
| A5 Copywriting | Rule | Its three headline formulas and its benefit bullet show what a headline and a benefit must contain. They are not sentences to fill in: a headline that fits a formula word for word fits every offer in the category. Its closing note about hyphens and orphaned words points at B1; see there. |
| A6 Build order | Rule | Section by section, the first window first. The six names are the common skeleton's: build the sections the brief's Composition names. |
| A7 Search | Rule | The choice to index or not is the owner's and goes in the brief. |
| A8 Pitfalls | Rule | |
| Output format | Rule | These seven things in words, shown to the owner before any code. |

## Part B, visual system

| Section | Standing | Notes |
|---|---|---|
| B1 Fonts: the four to use, the five never to use, one typeface, no italics, no weight above bold | Default | A brand's typefaces are the brand's, whichever list they are on. |
| B1 Copy rules: no hyphens | Default | A matter of voice. The brief's Voice entry decides. |
| B1 Copy rules: no orphaned words | Rule | `text-wrap: balance` on headings, `pretty` on running text. |
| B1 Type scale and text styles | Default | The principle is a rule: every size comes from one scale, and every text element uses a named style. The particular scale and names are the brand's where it has them. |
| B2 Spacing table | Default | Principle as rule: a fixed set of steps, nothing between them. |
| B3 Corner radius | Default | The nested radius formula is a rule wherever the brand's radii allow it. |
| B4 Borders and backgrounds, dark surfaces | Default | |
| B5 Hero heading colour (the text gradient) | Default | Most brands will not have it. Do not add it to one that does not. |
| B5 Hero layout | Rule | Cap the width of the headline and the line under it; break lines where the thought breaks. The 680 px figure is a default. |
| B6 Icons | Default | One family at one weight is the rule. Which family is the brand's. |
| B7 Motion: animate transform and opacity only; honour reduced motion; reveal a section once; never work on an unthrottled scroll event | Rule | |
| B7 Motion: the base curve and durations; the floating navigation bar, menu and link entrance | Default | |
| B8 Content realism | Rule, tightened | See "Facts" below. Sentence case is a default; the brief's Voice decides. |
| B9 States | Rule | |
| B10 Ship requirements | Rule | |
| B11 Tagline reveal section | Not used | It is a signature of the source's own style. Build it only where the brief asks for it; if built, its reduced-motion behaviour is a rule. |
| Quick checklist | Not used | The rubrics under `review/roles/` replace it. |

## The catalogue

| File or part | Standing | Notes |
|---|---|---|
| `crates/live/assets/antipatterns.json`, the entries marked `slop` | Rule | Walked as `references/tells.md` says: before the compositions go to the owner, while writing, and on the built page. An entry with `severity: advisory` is a prompt to look, not a fault. A typeface, a colour or a shape the brief records is the brand's, whichever entry names it. |
| The same file, the entries marked `quality` | Rule | Plain faults, most of which the rubrics under `review/roles/` also test. Where a figure differs from a rubric's, the rubric's is the one the page is reviewed against. The four `design-system-*` entries are about a file of the catalogue's own skill: read them as "outside the brief's Brand section". |
| `skill/reference/craft-floor.md`, "Verify" | Rule | Checks on the built page: the limits on display type, what the browser draws (the selection, the caret, the scrollbar, the focus ring), states, one authored movement. Two exceptions: a value the brief or the brand has stands; and where its line on motion allows more than B7 of the source does, B7 stands. |
| `skill/reference/craft-floor.md`, "Refuse" | Rule | Refused wherever the brief does not ask for the thing by name. The label above a heading is refused whatever the brief says. The block marked `<codex>` is addressed to one model; the habits in it are every model's, and it holds here. The line on modals belongs to product screens. |
| `skill/reference/mode-persuade.md` | Rule, two sentences of it | What the opening of a page that persuades must do (make the offer intelligible, expose the action, demonstrate something only this product can prove), and the two first windows that are the template whatever is painted on them (the last sentence of its first paragraph under "Comps"). Showing the action in its working form is a choice of the composition, not a rule. The rest, on worlds and comps, is not used. |
| `skill/reference/new-work.md`, section 6, "Both paths" | Rule, four of its points | "The first viewport is a thesis", "Prove, don't claim", "Pace the scroll like a studio" and "Use real, verified imagery". On "Prove, don't claim", see "Facts" below. The other points are not used. |
| `skill/reference/new-work.md`, section 4: the list of typefaces and the paragraph headed "Calibration" | Default | A brand's typefaces and colours are the brand's. Where a page has no brand and a value has to be proposed for the brief, a proposal that lands in one of the looks or on one of the faces named there says so to the owner. |
| `skill/reference/distill.md` | Rule: "Content Simplification", "Information Architecture" and the list under "Avoid" | The pass that cuts a page to its length (`references/composition.md`, "Length"). Its figures for type and colour are the brand's to set. Its last line, which hands the work to another command, is not used. |
| `NOTICE.md` | Kept | The licence asks that notices travel with the work. None of the three things it names is among the files copied here. |

Not used at all, though the files copied name them often: the catalogue's own commands, its
detector, its hooks and its agents; the files they read and write (`PRODUCT.md`, `DESIGN.md`, a
surface brief, anything under `.impeccable/`); the choosing of a look by a roll of worlds and by
generated pictures of a page (sections 1 to 3 and 5 of `new-work.md`); and its finishing review
(section 7), whose place here is taken by `review/`. Nothing in this skill runs or expects any of
them. `{{scripts_path}}` and the like in those files are the catalogue's own unfilled placeholders,
not markers of this skill.

## The third source: the words and the pictures

Paths are under `sources/taste-skill/skills/taste-skill/`. Where it and this skill disagree, this
skill's rule stands and the part is marked not used.

| File or part | Standing | Notes |
|---|---|---|
| `references/copy-tells.md` | Rule | What gives model-written words away, the fix for each, what over-correcting breeds, and what is not a tell. Walked with the catalogue (`references/tells.md`). |
| `scripts/copy-lint.mjs` | Rule | Run on the draft and on the built page. A FAIL is fixed. A WARN is fixed, or reported with why it stays. A hit on words the brief gives (a customer's quotation, the brand's own name) is reported and never rewritten: the brief wins. It reads a marker such as `{{price}}` as a leftover and fails it, which is right: a page that holds a marker is not finished. Its `--kind` is the third source's own sorting of businesses and may be left out. Needs Node 22 or later. |
| `references/copy-voice.md`, sections 1, 3, 4 and 5, and checks 1 to 5 of section 6 | Rule | The fact sheet, the page's shape from the reader's questions, drafting, the budget for each device, and the checks. The fact sheet is filled from the page brief and adds nothing to it: a field the brief cannot fill is a question for the owner, never a reason to write on. Its two allowances for invention (a coined name; plausible hours and prices) are not used. |
| `references/copy-voice.md`, section 2, and `references/copy-registers.md` | Default | The brief's Voice decides. Where the brief has none, two or three registers are put to the owner and the choice is recorded. "Take the one least like the last page" is not used. |
| `references/copy-moves.md` | Default | The move for each part of a page, with examples. Its table of heroes assumes the rule below on the headline. |
| `references/copy.md`: rules 2 to 5, "Plain versions", "Headlines and text", "Banned" | Default | Where the source's A5 or a rubric under `review/roles/` says otherwise, they stand. |
| `references/copy.md`, rule 1: the headline names the category | Not used | `review/roles/copy.md` W1 asks the headline for what the visitor gets and for whom. |
| `references/copy.md`: the words allowed on a screen, and 900 words a page | Not used | The length is the composition's (`references/composition.md`, "Length"). They belong to the third source's own layout, one section to a screen. |
| `references/copy.md`, "What may be assumed": "No invented proof" and "Each fact once" | Rule | |
| `references/copy.md`, "What may be assumed": assumed hours and prices, "No sample notes", "No placeholders", "No caption" | Not used | "Facts" below stands: a missing fact is a marker a visitor can see, and sample material is marked where it stands. |
| `references/copy.md`, "Contacts the brief does not give" | Not used | Contacts come from the brief. |
| `references/photos.md`, "Where pictures come from": the order of sources | Rule | The owner's own first, then a picture found elsewhere under a licence that allows it, then none. Each one is entered under Proof in the brief before it is used (`references/pictures.md`). |
| `references/photos.md`: its library of photographs and every `photos.mjs` command | Not used | Neither is carried here. |
| `references/photos.md`, "Live search": which licences, and the look at full size | Rule | What a picture found elsewhere has to pass before it is used. |
| `references/photos.md`: a stand-in shown with nothing on the page to say so, and the draft path | Not used | "Facts" below stands. |
| `references/photos.md`, "Place them": one light and one grade across the set, no frame twice, words on a picture only where it is calm, in a solid box or off it, a crop for the phone | Rule | Its ratios, its column positions and its rules by kind of business are its own layout: not used. |
| `references/photos.md`, "Show them": visible from the first paint, sizes set, no print, grade or effect on a photograph | Rule | Its file sizes are a default. Its hover rules are not used. |
| `references/photos.md`, "Credits and words": one credit line in the footer and a list behind it | Rule | Its ban on any caption is not used. |
| `references/photos.md`, "Never" | Rule | |
| `references/layout-v4.md`, section 1: what a study of 327 sites found | Reference | How often the first window holds the first section alone, how tall sections are and how far apart. Evidence for decisions 1, 2 and 9 in `references/composition.md`. Its sample holds no local shops, as it says itself. |
| `references/layout-v4.md`, section 2: one section to a window | Reference | One rhythm among those a composition may choose (decision 9). Its exact heights, its tables and its checker belong to its kit. |
| `references/layout-v4.md`, section 3: the table of eleven first windows, and what a first window may hold | Reference | Forms for decision 2, each with what it needs from the brief and how it is drawn on a phone. That they are dealt and never chosen is not used: here the owner chooses. One of them may be the common alternative, and no more than one. |
| `references/layout-v4.md`, sections 4 to 6: its grid, its type and its checker | Not used | They are its kit's. The look, type included, is the brand's. |

The files name many things that are not here: the kit under `assets/`, the other scripts, the gate,
the dealing of palettes and layouts, the other references. Nothing in this skill runs or expects
them.

## What none of them settles

How the page is drawn. The source gives the questions a page answers and their order (A2), four
types of page (A3) and one rule for the words in the first window (B5). It does not say what the
picture is, where the words sit against it, or what form any section takes, and a page built from
it alone takes the commonest form of each. The catalogue says what not to reach for, and nothing
about what to do in its place for this offer. That is settled for each page with its owner, from
references, as `references/composition.md` describes, and recorded in the brief. It ranks where the
brief ranks: above the brand's general system, this file and all three sources. It never sets aside a
rule of Part A: a composition decides how the page is drawn and which of its parts are sections of
their own, never which questions the page answers, their order, or what the first window must
hold.

## Not used at all, of the source

- **Scope.** The source says it applies to all web interface work, dashboards included, and that it
  wins over framework defaults. Here it applies to landing pages only, and it sits last in the order
  of authority.
- **Its description's instruction to consult it for every font, size, spacing value and colour.**
  Those come from the brand first.
- **The companion skill it names.** It is not part of this package.

## Facts

The source allows invented people, brands and numbers in "fictional demos and prototypes", and
forbids them on a real product's page. This package draws the line harder, because a draft landing
page is routinely pasted into a real one:

- On any page for a real offer, every price, number, customer, logo, quotation, award and guarantee
  comes from the Proof section of the page brief. Nothing else may appear, however plausible.
- A missing fact is a visible marker (`{{price}}`, `{{testimonial}}`), and is reported.
- Invented sample content is allowed only on a page the owner has said is a fiction (a template, a
  teaching example), and the page says that it is one.
- The product shown at work is not a claim. A demonstration may run on sample material (the invoice
  in the editor, the message being answered), written with care and marked as sample where it
  stands. It carries no fact about the offer: no price, no customer's name, no result
  (`review/roles/copy.md` W5).
- The source's list of filler words to avoid is a rule.

## When a source changes

After `node scripts/update-sources.cjs --update --source elaya`, read the diff of the source file.
A new section needs a row here. A changed rule in Part A may need a changed test in
`review/roles/conversion.md` or `review/roles/copy.md`; changing a rubric means raising the rubric
version in all six files, which starts a new series of scores.

After `node scripts/update-sources.cjs --update --source impeccable`, read the diff of the list. A
new entry marked `slop` needs a place in `references/tells.md`, and `scripts/review-set.test.cjs`
fails until it has one. A changed line under "Refuse" may change a row above.

After `node scripts/update-sources.cjs --update --source taste-skill`, read the whole of
`copy-lint.mjs` again before it is run: it is the one file among the sources that is executed, and
a pin is only as good as the reading behind it. It should still do nothing but read the files it
is given and print. Then read the diff of the six references against the rows above. That skill
changes often, and a release may move a rule from one file to another.
