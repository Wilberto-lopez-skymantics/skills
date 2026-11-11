# Accessibility rubric

Rubric version: 1.0.0

You review one thing: whether people with different abilities can read this page and take its action.
The reference is WCAG 2.2 level AA. Layout taste, wording style and the order of the argument belong
to other specialists; raise them only where they shut someone out.

## Where to look

- `facts/`: contrast ratios (`text`), labels, names, images and field edges (`labels`), headings,
  landmarks, the page language and the zoom setting (`structure`).
- `keyboard/`: every Tab stop in order, what shows the focus at each (`focus_shown_by`), and under
  `summary` what shows no focus, what was never reached, what is covered, and what looks clickable
  without being a control.
- `states/`: the focused look of the main button and links, pictured beside their look at rest.
- `motion/`: under `with_reduced_motion`, what can still move for someone who asked for less motion;
  under `animations`, anything that repeats for ever.
- `screens/`: text set over pictures, and anything said by colour alone.

Where a test names a number, quote the number from the file. The files cannot show a screen reader
speaking, the page at 200% zoom, or a video's captions: leave those out unless a file happens to show
the failure.

## Criteria

Every issue you record names the criterion it falls under. The lines under each criterion are its
tests: an issue is a test that fails in a file.

- **X1** Text contrast: all text a visitor needs meets 4.5 to 1 against what is behind it, or 3 to 1 for large text.
  - Body text and button labels measure at least 4.5 to 1; text of 24 px and up, or 18.67 px bold and up, at least 3 to 1.
  - Quiet text that is still needed (the line under the headline, captions, the small print beside the action, the footer) meets the same ratio.
  - A headline over a picture, a film or a gradient holds the ratio at its worst point.
- **X2** Labels and names: every form field has a visible label tied to it, and every control has a name that says what it does.
  - Every button and link has a name, including a menu button or a social link that shows only an icon.
  - Every field has a visible label that stays once the field has a value. A placeholder is never the only label.
  - Two links on the page that go to different places do not carry the same name.
- **X3** Not colour alone: every state and meaning is also carried by text, an icon, a shape or a position.
  - A field in error has a message in words beside it, not a coloured border alone.
  - A link inside running text can be told from the text around it by more than its colour.
  - A plan, a tick or a cross in a comparison can be told in a greyscale copy of the screenshot.
- **X4** Keyboard focus visible: every stop the keyboard reaches shows clearly where the focus is.
  - Every stop in `keyboard/` shows a focus indicator.
  - The indicator is at least as noticeable as a 2 px line around the control and stands out from the colours beside it.
  - The focused control is fully in view: not under a header that stays at the top, a bar at the bottom or a consent banner.
- **X5** Structure: the page is built from the parts it appears to have.
  - One main region, navigation marked as navigation, a footer marked as one.
  - What looks like a heading is a heading, and the headings read in order as an outline of the page. One top-level heading and no skipped levels are recommendations: on their own they are never above `minor`.
  - The page declares its language.
- **X6** Text alternatives: pictures that carry meaning have a text alternative that gives the same information.
  - A product picture, a diagram and a customer's logo each have an alternative that says what they show; decoration has an empty one (`labels.images_without_alt`).
  - A film that carries part of the argument has the same argument in words on the page.
- **X7** Zoom: the page does not prevent zooming, and nothing in the files shows content lost when text is larger.
  - Zooming is not disabled or capped (`structure.viewport_meta`).
- **X8** Non-text contrast: the edges of fields and buttons, and icons that carry meaning, reach 3 to 1 against what surrounds them.
  - The edge or fill that lets a visitor find a field or a button measures at least 3 to 1 (`labels.field_edges_below_3_to_1`).
- **X9** Keyboard reach and order: everything a pointer can do the keyboard can do, in an order that follows the page.
  - The main action, the form and the menu are all in the keyboard walk (`never_reached` holds none of them).
  - The Tab order follows the reading order and never lands on something hidden.
  - The first stop, or one near it, lets a keyboard user skip the navigation and reach the content.
  - A menu or a dialog that opens keeps the focus inside it and gives it back when closed.
- **X10** Reduced motion honoured: someone who has asked for less motion gets less motion, and still gets the whole page.
  - With the preference set, sections that slide or fade in on scrolling, moving backgrounds and text that reveals word by word are shown at rest: `elements_that_can_still_move` is nil or holds only brief press feedback.
  - Nothing the visitor needs stays hidden because its animation never ran.
  - Anything that keeps moving by itself (a film, a carousel, a row of logos that slides) has a visible control to pause it.

## Major on sight

Each of these is at least `major` wherever it is truly there, and `blocker` when it stops this visitor
taking the action. A recorded decision does not excuse them.

- A button or a link with no name (X2).
- A field whose only label is its placeholder (X2).
- The headline, body text or the main action's label below its required contrast ratio (X1).
- A meaning carried by colour alone (X3).
- A control the keyboard reaches that shows no focus indicator (X4).
- The main action or the form out of the keyboard's reach (X9).
- Zooming disabled (X7).
- Large movement that ignores a request for reduced motion, or content that keeps moving by itself with no way to pause it (X10).

## What 90 looks like here

Anyone this page is for can read it and act on it, whatever their eyesight, hands or tools: every
test is met at every size, the keyboard reaches everything and always shows where it is, and the
headline and the main action are comfortably above the minimum contrast.
