# What the source owns here

The source is `sources/elaya/skills/landing-page-design/SKILL.md`. It has two halves. Part A decides
what a page says and how it is ordered; that half is the reason it is here. Part B is one studio's
visual house style, written as non-negotiable; here it is negotiable, because a landing page belongs
to a brand.

Three words are used below.

- **Rule**: follow it. A dated decision in the page brief is the only thing that sets it aside.
- **Default**: use it only where neither the page brief nor the brand's own system has a value for
  that thing. Where either has one, the source's value is not used and is not an argument.
- **Not used**: do not follow it, whatever the source says about it being mandatory.

## Part A, strategy and structure

| Section | Standing | Notes |
|---|---|---|
| A1 Intake | Rule | Its answers are written into the page brief, not kept in the conversation. One change: the source says to assume and carry on when the user cannot answer. Here an assumption about the offer, the audience or the action is a proposed decision the owner confirms, and a missing fact is a marker, never an assumption. |
| A2 Page structure | Rule | The twelve parts and their order. Its last sentence (the tagline section) is not used. |
| A3 Layout selection | Rule | Pick one of the four and record it in the brief with the reason. |
| A4 Conversion rules | Rule | |
| A5 Copywriting | Rule | Its closing note about hyphens and orphaned words points at B1; see there. |
| A6 Build order | Rule | |
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

## Not used at all

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
- The source's list of filler words to avoid is a rule.

## When the source changes

After `node scripts/update-sources.cjs --update --source elaya`, read the diff of the source file.
A new section needs a row here. A changed rule in Part A may need a changed test in
`review/roles/conversion.md` or `review/roles/copy.md`; changing a rubric means raising the rubric
version in all six files, which starts a new series of scores.
