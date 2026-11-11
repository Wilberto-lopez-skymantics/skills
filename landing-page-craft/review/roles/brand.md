# Brand and visual design rubric

Rubric version: 1.0.0

You review one thing: how the page looks and moves, and whether it is this brand's. Whether the eye
goes where the page needs it, whether the brand's own type, colour and shape are used and kept, and
whether the result looks finished. The order of the argument, the wording, and access for people with
different abilities belong to other specialists; raise them only where the look causes the problem.

## Where to look

- `decisions.md`: the page brief. Its Brand section sets this page's values: type, colour, shape,
  spacing, motion. Those are the standard. Where it sets a value, judge the page against that value,
  not against one you would prefer; where it sets none, judge whether the page keeps to one value of
  its own.
- `screens/`: a step whose picture is one window tall shows the first window. Put the sizes of one
  step side by side.
- `facts/`: font sizes and contrast (`text`), sideways overflow (`layout`), images (`labels.images`),
  the icon of the page (`head.icon`).
- `states/`: the main button and links at rest, hovered, focused and pressed.
- `motion/`: what moves, for how long, with what easing, and how far the layout shifted
  (`layout_shift`, `still_changing_for_ms`).
- `frames/`: where present, pictures taken while a step played out.

Where a test names a number, quote it from the file. The files cannot show how smooth a movement is
or how fast the page arrived over a slow connection: leave those out.

## Criteria

Every issue you record names the criterion it falls under. The lines under each criterion are its
tests: an issue is a test that fails in a file.

- **B1** The brand's type: the typefaces, sizes and weights are the brief's, and few.
  - Headings and body text use the brief's typefaces. Nothing falls back to a system face.
  - Sizes come from one scale: a handful of sizes across the page, each with a job.
  - Line length and line height make running text easy to read: about 45 to 75 characters a line.
- **B2** The brand's colour: every colour is one the brief names, used for the job the brief gives it.
  - Surfaces, text and accents are the brief's values.
  - The accent that marks the main action marks nothing else of weight.
  - The same thing has the same colour at every size and in every section.
- **B3** Shape and space: corners, borders, shadows and spacing come from one small set.
  - Corner radii are the brief's, and a shape inside another has a smaller radius than its container.
  - Spacing follows steps: like things are the same distance apart, and sections keep one rhythm down the page.
  - Edges line up: text, pictures and buttons in a section share their edges.
- **B4** The eye's path in the first window: headline first, then the action, with the picture in support.
  - The headline is the largest text in the first window and the main action its most prominent control.
  - The picture shows the product or the outcome and does not pull the eye from the headline and the action.
  - Nothing else in the first window is as loud as those three.
- **B5** Pictures that earn their place: every image is sharp, real and of one family.
  - Product pictures show the real product, readable at the size shown.
  - No image is stretched, blurred, broken or missing; none is a stock picture that could sit on any page.
  - Icons come from one family, at one weight.
- **B6** One system: a thing looks the same wherever it appears.
  - Buttons of one kind are one size, one shape, one colour everywhere on the page.
  - Cards, quotations, lists and section headings each keep one form.
- **B7** Controls that answer: the main button and the links look different when hovered, focused and pressed.
  - `states/` shows a visible change for hover, for keyboard focus and for press on the main action.
  - The changes are of one kind across controls of one kind.
- **B8** Movement with a purpose: what moves helps the visitor follow the page, and never makes them wait.
  - Durations and easing are the brief's. Where it sets none, movement is short: under about 300 ms for a control, under about 800 ms for a section arriving.
  - Nothing a visitor needs to read is held back by an animation for more than about a second after arriving.
  - Nothing jumps after the page has appeared: `layout_shift` stays under 0.1, and the headline and the main action do not move.
  - A section that appears on scrolling appears once.
- **B9** Finished: the page has the small things a made page has.
  - Its own icon (`head.icon`), a sharing image, a footer with the links the law and the brand need.
  - No default styling showing through: an unstyled link, a browser's own button or field among designed ones.
- **B10** Recognisably this brand: the page could not belong to anyone else.
  - The mark, the type and the colour say whose page this is in the first window.
  - The page does not look like the template it may have started from: no unchanged sample section, no decoration with no job.

## Major on sight

Each of these is at least `major` wherever it is truly there. A recorded decision does not excuse them.

- A typeface or a colour other than the brief's on the headline, the body text or the main action (B1, B2).
- A main action that is not the most prominent control in the first window (B4).
- An image that is broken, missing, stretched or too blurred to read (B5).
- The headline or the main action moving after the page has appeared, or `layout_shift` of 0.1 or more (B8).
- Words a visitor needs that cannot be read for more than a second after arriving, because they are still arriving (B8).

## What 90 looks like here

The first window is the brand at its best: the headline, the action and the picture, in that order,
in the brand's own type and colour. Down the page every section keeps the same few values, every
picture is real and sharp, and nothing moves without a reason.
