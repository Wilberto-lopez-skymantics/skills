# Visual design rubric

Rubric version: 5.2.0

You review one thing: how the screens look and how they direct the eye. Whether a person with a
disability can use them, what the words say and how the flow behaves belong to other specialists;
raise them only where the visual design causes them.

## Where to look

- `screens/`: every test below is first a matter of looking.
- `facts/`: font sizes (`text`) and control sizes (`targets`), to check what the eye suspects. Under
  `styles`, how many looks one kind of thing has on a screen: each look of button and of link, the
  corners and shadows in use, the sizes and weights of text, each typeface and whether it is the one
  drawn, and how deep boxes sit inside boxes. Under `pictures`, each picture that did not load, is
  drawn larger than its file or is out of proportion. Under `layout.lies_on_something_else`, text
  and controls that cross. These are counts to read beside the screens: a product has several
  kinds of button on purpose, and things are laid over each other on purpose too.
- `states/`: each main control pictured at rest, hovered, focused, pressed and disabled, with what
  changed.
- `motion/`: how far the layout shifted (`layout_shift`), and how long the screen kept changing.
- `frames/`: pictures taken while a step's action played out.
- `decisions.md`: its Style section is this product's chosen look. Judge the screens against it.

## Criteria

Every issue you record names the criterion it falls under. The lines under each criterion are its
tests: an issue is a test that fails in a file.

- **V1** Hierarchy: on every screen the action this person came to take is the most prominent action, and nothing else competes with it at equal weight.
  - You can name the most important thing on the screen at a glance, and it matches what the step is for.
  - Each view has one primary action, visibly stronger than the rest. Two equally loud buttons side by side fail this.
  - Heading sizes go down with heading level, and no heading is smaller than the body text.
- **V2** Grouping: related things are grouped and unrelated things separated, so each screen can be scanned in parts.
  - The space between groups is clearly larger than the space inside a group (about twice), so the groups can be counted without reading.
  - Each label, hint and error sits nearer to its own control than to any other.
  - Controls look different from static text, and nothing static looks pressable.
  - A box is drawn where it separates something. Where `styles.boxes_inside_boxes` lists a box three deep or more, each of the three sets apart something the one outside it does not.
- **V3** Spacing and alignment: spacing follows a consistent rhythm, equal things have equal gaps, and elements line up on shared edges.
  - Elements in one column or row share an edge. A stray edge a few pixels off fails this.
  - The same relation uses the same gap on every screen: label to field, card to card, section to section.
  - Nested rounded corners look parallel, and an icon and its text sit on the same line, centred in their control.
- **V4** Type: a small set of sizes and weights, each with a visible job, used the same way on every screen.
  - Body text is at least 16 px, supporting text at least 13 px, and nothing a person needs to read is below 12 px.
  - Long-form text runs about 60 to 75 characters a line, and text of three or more lines has line spacing of at least 1.4 times its size.
  - Numbers that change or sit in columns keep the same width per digit, so they do not jiggle or misalign.
  - The sizes and weights in use are few, and each has a job (`styles.text_sizes_px`, `styles.text_weights`). Two sizes a pixel or two apart that do the same job are one size drawn twice; so is a heading level drawn at two sizes in one region (`styles.heading_levels_drawn_at_more_than_one_size`).
- **V5** Colour: one colour means one thing, and colours with a common meaning are used for that meaning.
  - The same hue does not mean two things: the colour of the main action is not also the colour of errors or of decoration.
  - Danger is used for destructive and failed, success for done, warning for caution.
  - Beyond the neutrals, one accent and the status colours, every further colour has a job you can name.
- **V6** Consistent components: the same component looks and responds the same wherever it appears.
  - The same kind of control has the same height, corner, padding and label style on every screen. Read `styles.button_looks` and `styles.link_looks` across the screens: two looks that differ only in a corner, a height, a weight or the room at the sides are one kind drawn two ways, unless the difference marks a difference (a smaller button in a dense table).
  - No detail is done two ways in one product: two corner sizes for the same card, two icon families, two shadow styles (`styles.corners`, `styles.shadows`).
  - Controls of one kind show the same change on hover, focus and press (`states/`).
- **V7** Finish: nothing looks broken or unfinished.
  - Nothing is clipped, overlapping or touching the edge of its container without padding. `layout.lies_on_something_else` lists text and controls that cross: find each on the screen, and leave out what is laid there on purpose.
  - Nothing jumps when content, images or fonts arrive: `layout_shift` in `motion/` is nil or too small to see.
  - Images are sharp and in proportion, and text that is cut short shows that it is cut short. A picture drawn larger than its file is soft, and one out of proportion is stretched (`pictures.drawn_larger_than_the_file`, `pictures.out_of_proportion`); none is missing (`pictures.did_not_load`).
  - Every typeface the product brings is the one drawn: `styles.typefaces` shows none with `comes_with_the_page` true and `drawn` false. A face named first in a list of the device's own faces, and absent from the machine that took the pictures, is not this.
- **V8** Data at a glance: numbers, dates and statuses that matter are aligned, carry their units, and emphasise what is due, changed or unusual.
  - Numbers in a column align so they can be compared down the column, with their unit stated.
  - A chart's type fits its question, its bars start at zero, and its series are labelled.
  - The figure or status the screen exists to show can be read without hovering or opening anything.
- **V9** Character: the product has a look of its own, carried through every screen.
  - Where `decisions.md` has a Style section, the screens follow it: its type, colour, shape, density and motion. A departure from it is an issue; following it is not, whatever you would have chosen.
  - Without one, judge only whether the product is consistent with itself: a distinctive choice made on one screen is kept on the next.
  - No unstyled leftovers stand beside designed parts: a browser-default control among custom ones, a stock placeholder picture, a default link colour (`styles.link_looks` says where a link is in the browser's own blue).

## Major on sight

Each of these is at least `major` wherever it is truly there. A recorded decision does not excuse them.

- A colour used against its common meaning: the success colour on a destructive action, the danger colour on a safe one (V5).
- Content a person needs that is clipped or covered by something else, so that it cannot be read (V7).
- Two actions of equal weight where one of them destroys or commits something and the other does not (V1).

## What 90 looks like here

The screens look made with care and made as one product: the main action leads on every screen,
everything lines up, every control answers the pointer the same way, and the detail holds up to close
inspection.
