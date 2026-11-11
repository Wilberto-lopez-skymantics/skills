# Responsive design rubric

Rubric version: 5.0.0

You review one thing: whether the journey works and feels right at every screen size it was captured
at, on the devices those sizes stand for. Contrast, wording and the flow in general belong to other
specialists; raise them only where a screen size causes them.

## Where to look

- `screens/`: every step at every size. Put the sizes of one step side by side.
- `facts/`: sideways scrolling and what overflows (`layout`), control sizes (`targets`), font sizes
  (`text`), field types (`labels.field_types`), and whether a dialog is larger than the screen
  (`structure.open_dialogs`).
- `journey.md`: which sizes are touch screens.

The files cannot show the on-screen keyboard, the browser's own bars or a real finger: leave those out
unless a file happens to show the failure.

## Criteria

Every issue you record names the criterion it falls under. The lines under each criterion are its
tests: an issue is a test that fails in a file.

- **R1** Fits: at every size nothing is cut off, nothing overlaps, and the page does not scroll sideways.
  - `scrolls_sideways` is false at every size, and nothing is listed as overflowing that a person needs.
  - Nothing is clipped, overlapping or pushed out of reach.
  - Long content (a long name, a long number) wraps or is cut short on purpose; it does not break out of its container.
- **R2** Complete at the smallest size: every step can still be done: no action, column or piece of information the task needs is missing or out of reach.
  - Everything that can be done and read at the largest size can be done and read at the smallest.
  - Table columns or details folded away at small sizes can still be reached, and there is a cue that they exist.
  - The primary action of each step can be reached at the smallest size without hunting.
- **R3** Touch targets: on touch sizes controls are large enough and far enough apart to press without error.
  - Every control is at least 24 by 24 px, or has enough clear space around it that a near miss presses nothing else.
  - The main action of each screen, and controls used often, are at least 44 by 44 px on touch sizes. Missing this alone is never above `minor`.
  - Neighbouring controls are far enough apart that a near miss does not press the wrong one, above all beside a destructive control.
- **R4** Readable without zooming: text can be read at every size as it is.
  - No text a person needs is smaller than 12 px, and running text on phone sizes is at least 16 px.
  - On phone sizes the text in fields is at least 16 px.
  - On wide sizes long-form text runs no more than about 75 characters a line.
- **R5** Reshaped, not shrunk: tables, long lists and multi-column layouts are restructured for small screens.
  - Columns that stood side by side stack in an order that keeps the most important first.
  - A table or chart takes a form suited to a small screen (cards, fewer columns, or scrolling inside its own area with a visible cue), not a scaled-down copy.
  - Navigation changes form with the size instead of staying one bar that shrinks.
- **R6** Overlays fit: dialogs, menus and overlays fit inside the screen at every size and show a way to close them.
  - No open dialog is larger than the screen (`exceeds_viewport`), and its actions are in view or reachable by scrolling inside it.
  - The way to close it is in view at every size.
- **R7** Designed for each size: every size looks composed for that size.
  - A wide screen uses its width: no single stretched column with very long lines, no phone layout floating in the middle of a desktop.
  - A small screen keeps the main action within easy reach of a thumb.
  - Density follows the input: roomier where fingers press, tighter where a pointer does.
- **R8** Device habits: on touch sizes nothing depends on hovering, and fields bring up the right keyboard.
  - Anything shown or offered on hover has another way to reach it on touch.
  - Each field has the type that brings up the keyboard that suits it: numbers, email, search (`field_types`).

## Major on sight

Each of these is at least `major` wherever it is truly there, and `blocker` when it stops this person
finishing. A recorded decision does not excuse them.

- Content or a control the task needs that is clipped, covered or out of reach at a captured size (R1).
- The page scrolling sideways at a phone size (R1).
- A step that cannot be completed at the smallest size because something it needs is missing there (R2).
- On a touch size, a control smaller than 24 by 24 px with another control close beside it (R3).
- A dialog whose actions cannot be reached at a captured size (R6).

## What 90 looks like here

Each screen size looks designed for, not squeezed or stretched: everything fits, everything can be
reached and read, and the main action is where the hand expects it.
