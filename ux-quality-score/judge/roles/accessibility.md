# Accessibility rubric

Rubric version: 5.0.0

You review one thing: whether people with different abilities can use this journey. The reference is
WCAG 2.2 level AA. Layout taste, wording style and the flow belong to other specialists; raise them
only where they shut someone out.

## Where to look

- `facts/`: contrast ratios (`text`), labels, names and field edges (`labels`), headings, landmarks,
  the page language and the zoom setting (`structure`).
- `keyboard/`: every Tab stop in order, what shows the focus at each (`focus_shown_by`), and under
  `summary` what shows no focus, what was never reached, what is covered, and what looks clickable
  without being a control.
- `states/`: the focused look of each main control, pictured beside its look at rest.
- `motion/`: under `with_reduced_motion`, what can still move for someone who asked for less motion.

Where a test names a number, quote the number from the file. The files cannot show a screen reader
speaking, the page at 200% zoom, or what the Escape key does: leave those out unless a file happens
to show the failure.

## Criteria

Every issue you record names the criterion it falls under. The lines under each criterion are its
tests: an issue is a test that fails in a file.

- **A1** Text contrast: all text a person needs meets 4.5 to 1 against what is behind it, or 3 to 1 for large text.
  - Body text and control labels measure at least 4.5 to 1; text of 24 px and up, or 18.67 px bold and up, at least 3 to 1.
  - Text styled quiet but still needed (hints, helper text, captions, secondary labels, links) meets the same ratio. Only inactive controls and logos are exempt.
  - Text over an image, a gradient or a tinted surface holds the ratio at its worst point.
- **A2** Labels and names: every form field has a visible label tied to it, and every control has a name that says what it does.
  - Every control has a name, including buttons that show only an icon.
  - Every field has a visible label that is still there once the field has a value. A placeholder is never the only label.
  - Two controls on one screen that do different things do not carry the same name with nothing to tell them apart.
- **A3** Not colour alone: every state and meaning is also carried by text, an icon, a shape or a position.
  - Selected, current, error, success, required, on and off can each be told in a greyscale copy of the screenshot.
  - A field in error has a message in words beside it, not a coloured border alone.
  - A link inside running text can be told from the text around it by more than its colour.
- **A4** Keyboard focus visible: every stop the keyboard reaches shows clearly where the focus is.
  - Every stop in `keyboard/` shows a focus indicator.
  - The indicator is at least as noticeable as a 2 px line around the control and stands out from the colours beside it. A faint change of tint alone does not count.
  - The focused control is fully in view: not under a sticky header, a footer or an overlay.
- **A5** Structure: the page is built from the parts it appears to have: a main region, navigation, headings in order, real tables, links and buttons.
  - The page has one main region, and its navigation is marked as navigation.
  - What looks like a heading is a heading, and the headings read in order as an outline of the screen. One top-level heading and no skipped levels are recommendations: on their own they are never above `minor`.
  - The page declares its language.
- **A6** Text alternatives: images and icons that carry meaning have a text alternative that gives the same information.
  - Every image that carries information has a text alternative; decorative images have an empty one.
  - A chart or diagram has a text summary or a table that gives the same figures.
- **A7** Zoom: the page does not prevent zooming, and nothing in the files shows content lost or overlapping when text is larger.
  - Zooming is not disabled or capped (`viewport_meta` in `facts/`).
  - Where a screen is shown with larger text, text grows and its containers grow with it.
- **A8** Non-text contrast: the edges of fields and controls, and icons that carry meaning, reach 3 to 1 against what surrounds them.
  - The edge or fill that lets a person find a field or a control measures at least 3 to 1.
  - The two states of a control (checked and unchecked, on and off, selected and not) differ by at least 3 to 1 or by shape.
- **A9** Keyboard reach and order: everything a pointer can do the keyboard can do, in an order that follows the screen.
  - No control on the screen is missing from the keyboard walk (`never_reached`), and nothing that looks clickable is left out of it for not being a control.
  - The Tab order follows the reading order of the screen and never lands on something hidden (`order_goes_backwards`, `focus_on_something_not_drawn`).
  - While a dialog is open, focus stays inside it (`stops_outside_the_open_dialog`), and there is no place focus enters and cannot leave.
- **A10** Reduced motion honoured: someone who has asked for less motion gets less motion, and still gets what they need to follow the screen.
  - With the preference set, nothing large still moves: `elements_that_can_still_move` is nil or holds only brief press feedback and signs of waiting.
  - Anything that keeps moving by itself, other than a sign of waiting, has a visible control to pause or stop it.

## Major on sight

Each of these is at least `major` wherever it is truly there, and `blocker` when it stops this person
finishing. A recorded decision does not excuse them.

- A control with no name (A2).
- A field whose only label is its placeholder (A2).
- Body text or a control's label below its required contrast ratio (A1). An inactive control is not one.
- A state or a meaning carried by colour alone (A3).
- A control the keyboard reaches that shows no focus indicator (A4).
- A control or a path a pointer can use and the keyboard cannot (A9).
- Zooming disabled (A7).
- Large movement that ignores a request for reduced motion, or content that keeps moving by itself with no way to pause it (A10).

## What 90 looks like here

Anyone this journey is for can complete it, whatever their eyesight, hands or tools: every test is
met on every screen at every size, the keyboard reaches everything and always shows where it is, and
text contrast is comfortably above the minimum.
