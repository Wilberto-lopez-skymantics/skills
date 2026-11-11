# Responsive design rubric

Rubric version: 1.0.0

You review one thing: whether the page works and looks composed at every screen size it was captured
at, on the devices those sizes stand for. Most visitors to a landing page arrive on a phone, so the
smallest size is the page, not a version of it. Contrast, wording and the order of the argument
belong to other specialists; raise them only where a screen size causes the problem.

## Where to look

- `screens/`: every step at every size. Put the sizes of one step side by side. A step whose picture
  is one window tall shows what that device shows before any scrolling.
- `facts/`: sideways scrolling and what overflows (`layout`), how many windows tall the page is
  (`layout.screens_tall`), control sizes (`targets`), font sizes (`text`), field types
  (`labels.field_types`), and what the first window holds at each size (`first_window`).
- `journey.md`: which sizes are touch screens.

The files cannot show the on-screen keyboard, the browser's own bars or a real finger: leave those out
unless a file happens to show the failure.

## Criteria

Every issue you record names the criterion it falls under. The lines under each criterion are its
tests: an issue is a test that fails in a file.

- **S1** Fits: at every size nothing is cut off, nothing overlaps, and the page does not scroll sideways.
  - `scrolls_sideways` is false at every size, and nothing a visitor needs is listed as overflowing.
  - A long headline wraps; a button keeps its words inside it; a picture stays inside its section.
  - Nothing sits on top of something else: a header that stays at the top, a chat bubble or a consent banner does not cover the headline, the action or a field.
- **S2** The first window at the smallest size: it still holds the promise and the action.
  - At the smallest size the headline, the line under it and the main action are in the first window, the action whole (`first_window`).
  - The header takes no more of a phone's window than it needs: about a tenth of its height.
  - A picture that fills the first window on a phone and pushes the action below it fails this.
- **S3** Complete at the smallest size: everything the page says and offers at the widest size is there at the smallest.
  - No section, proof or answer is dropped for small screens.
  - What is folded away (a menu, a list of questions) can be opened, and shows that it can.
- **S4** Touch targets: on touch sizes controls are large enough and far enough apart to press without error.
  - Every control is at least 24 by 24 px, or has enough clear space around it that a near miss presses nothing else.
  - The main action is at least 44 px tall on touch sizes, and on a phone close to the full width of its column.
  - Links in the footer and the menu are far enough apart for a thumb.
- **S5** Readable without zooming: text can be read at every size as it is.
  - No text a visitor needs is smaller than 12 px, and running text on phone sizes is at least 16 px.
  - The text in fields on phone sizes is at least 16 px.
  - The headline is sized for the screen: on a phone it does not run to more than about four lines; on a wide screen running text stays under about 75 characters a line.
- **S6** Reshaped, not shrunk: sections change form for small screens.
  - Columns that stood side by side stack, with the words before the picture where the words carry the point.
  - A comparison table, a row of plans or a row of logos takes a form made for a small screen, not a scaled-down copy.
  - The navigation changes form with the size.
- **S7** Composed for each size: every size looks made for that size.
  - A wide screen uses its width without stretching text across it; nothing looks like a phone layout floating in the middle.
  - A phone is not a long list of full sections at desktop spacing: `screens_tall` stays in reach of a thumb's patience, and spacing tightens with the screen.
  - Pictures are cropped or swapped to suit the shape of the screen, not shrunk until they cannot be read.
- **S8** Device habits: on touch sizes nothing depends on hovering, and fields bring up the right keyboard.
  - Anything shown on hover has another way to reach it on touch.
  - An email field is of type email, a telephone field of type tel (`labels.field_types`).

## Major on sight

Each of these is at least `major` wherever it is truly there, and `blocker` when it stops this visitor
taking the action. A recorded decision does not excuse them.

- The page scrolling sideways at a phone size (S1).
- The headline, the main action or a form field clipped, covered or out of reach at a captured size (S1).
- A first window at the smallest size with no main action in it (S2).
- A section, a proof or the form missing at the smallest size (S3).
- On a touch size, a control smaller than 24 by 24 px with another control close beside it (S4).

## What 90 looks like here

On a phone the page reads as if it had been made for a phone first: the promise and the action in the
first window, every section reshaped for one column, everything within a thumb's reach. On a wide
screen it uses the room without stretching.
