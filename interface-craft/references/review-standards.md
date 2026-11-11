# Review standards

What a good product interface looks like on the screen, stated as outcomes a reviewer can see or
measure. Reviewers grade against this file. Workers run it as a self-check before handing work
back. It holds no recipes and no implementation values: how to reach an outcome is in the source
files that `routing.md` names.

Every test is drawn from the vendored sources (`ownership.md` says which file owns each topic).
The numbers here are thresholds a person experiences or a standard states: contrast ratios, sizes
in CSS pixels, durations in milliseconds, line length in characters.

## How to read a test

- Each criterion has an id (`A1` ... `R8`). The ids are fixed; `routing.md` uses the same ones.
- Each test ends with a marker:
  - `[script]` a script can check it from the page (measurements, the keyboard walk, control-state
    pictures, declared motion). Where the evidence carries the measurement, use it and quote it.
  - `[eyes]` it needs a person or a model looking at the screenshot, the page text or the frames.
- A test you cannot run with the evidence you were given is **not verified**. Say so. It is never
  a finding and never a pass.
- A failed test is a finding. Its severity comes from what happens to the person (`severity.md`),
  except for the failures in "Major on sight", which are at least major whenever they are seen.

## Evidence a reviewer is given

For each step of the flow, at each screen size:

| Evidence | What it holds | Supports |
|---|---|---|
| Still screenshot | The screen as the person sees it | Everything marked `[eyes]` |
| Page text | The words on the screen, in reading order | Content tests, labels, messages |
| Measurements | Text and non-text contrast, control sizes, overflow, labels and names, field types, headings and landmarks, small text | Most `[script]` tests in Accessibility and Responsive |
| Keyboard walk | Each Tab stop in order, with its name and whether a focus indicator shows | A4, A9, I8 |
| Control-state pictures | Rest, hover, focus, pressed and disabled of the main controls, with the measured style change between them | A4, I2, I12, V6 |
| Declared motion | For each transition: duration, easing, what remains under reduced motion, layout shift, time to settle | A10, I4, I11, V7 |
| Frame sequences | A series of frames for steps marked as motion steps | I11, I2, A10 |

The project's `design-decisions.md`, when it has one, is given whole. A choice recorded there is
chosen, not found (see "Not an issue").

What this evidence cannot show: real touch hardware (tap delay, the on-screen keyboard, safe
areas), a screen reader's speech, and sizes that were not captured. Tests that depend on them are
marked in the text; report them as not verified unless the evidence happens to show the failure.

---

## Accessibility

### A1 Text contrast

- Body text and control labels measure at least 4.5:1 against the background actually behind
  them. Large text (24 px and up, or 18.67 px bold and up) measures at least 3:1. `[script]`
- Text the person needs but that is styled quiet (placeholder used as a hint, helper text,
  captions, secondary labels, links) meets the same ratio. Only truly inactive controls and logos
  are exempt. `[script]`
- Text over an image, a gradient or a tinted surface holds the ratio at its worst point, not on
  average. `[eyes]`
- The ratios hold in every theme the product offers, not only the default one. `[script]`

### A2 Labels and names

- Every control has a name that says what it does, including buttons that show only an icon.
  `[script]`
- Every field has a visible label that is still there once the field has a value. A placeholder
  is never the only label. `[script]`
- The name a control exposes contains the words it shows, so a person who says or searches for
  the visible label reaches it. `[script]`
- Two controls on one screen that do different things do not carry the same name with nothing to
  tell them apart (six "Edit" buttons in a list each name their row). `[script]`

### A3 Not colour alone

- Every state and meaning (selected, current, error, success, required, on or off) is also
  carried by text, an icon, a shape or a position. In a greyscale copy of the screenshot it can
  still be told. `[eyes]`
- A field in error has a message in words beside it, not a coloured border alone. `[eyes]`
- A link inside running text can be told from the text around it by more than its colour.
  `[eyes]`
- Chart series and status categories can be told apart by label, pattern or position as well as
  colour. `[eyes]`

### A4 Keyboard focus visible

- Every stop in the keyboard walk shows a focus indicator. `[script]`
- The indicator contrasts at least 3:1 with the colours next to it and is at least as noticeable
  as a 2 px line around the control. A change of tint alone does not count. `[script]`
- The focused control is fully in view: not under a sticky header, a footer or an overlay.
  `[script]`
- The focus indicator is the same kind of mark on every kind of control, so the person learns it
  once. `[eyes]`

### A5 Structure

- The page has one main region, its navigation is marked as navigation, and when navigation comes
  before the content there is a way to skip to the content. `[script]`
- What looks like a heading is a heading, and the headings read in order as an outline of the
  screen. One top-level heading and no skipped levels are recommendations: on their own they are
  never above minor. `[script]`
- Things are what they look like: data in rows and columns is a table with header cells, a thing
  that goes somewhere is a link, a thing that acts is a button, a set of options is a group with
  a name. `[script]`
- The page declares its language, and its title names this screen, most specific part first.
  `[script]`

### A6 Text alternatives

- Every image that carries information has a text alternative that gives the same information.
  Decorative images are hidden from assistive technology rather than described. `[script]` for
  presence, `[eyes]` for whether the text says what the image shows.
- A chart or diagram has a text summary or a table that gives the same figures. `[eyes]`
- A message that appears without a page change (saved, failed, results updated) is announced
  without moving the person's focus. `[script]`

### A7 Zoom

- At 200% zoom, every piece of content and every control can still be reached, and reading does
  not need scrolling sideways. Tables, maps and code may scroll inside their own area. `[script]`
- Zooming is never disabled or capped. `[script]`
- When the browser's text size is raised, text grows and its containers grow with it. Nothing is
  cut off or overlaps. `[eyes]`

### A8 Non-text contrast

- The edge or fill that lets a person find a field or a control measures at least 3:1 against
  what surrounds it. `[script]`
- Icons and graphics that carry meaning measure at least 3:1. `[script]`
- The two states of a control (checked and unchecked, on and off, selected and not) differ by at
  least 3:1 or by shape. `[eyes]`

### A9 Keyboard reach and order

- Everything a pointer can do, the keyboard can do. No clickable thing on the screen is missing
  from the keyboard walk. `[script]`
- The Tab order follows the reading order of the screen. It never jumps across the layout and
  never lands on something hidden. `[script]`
- An open dialog, menu or sheet keeps focus inside it, closes on Escape, and returns focus to the
  control that opened it. `[script]`
- There is no place focus enters and cannot leave, and anything done by dragging can also be done
  without dragging. `[eyes]`

### A10 Reduced motion honoured

- When the person has asked for reduced motion, no parallax, auto-playing or large movement
  remains. Changes arrive by a fade or at once. `[script]`
- What the person needs to follow the screen stays: progress indicators, the change of state
  itself, brief press feedback. Reduced motion means fewer and gentler, not broken. `[script]`
- Anything that moves, blinks or scrolls by itself for more than 5 seconds has a visible control
  to pause or stop it. `[eyes]`

---

## Visual design

### V1 Hierarchy

- The most important content or action for this step is the most prominent thing on the screen.
  A reviewer can name it at a glance, and it matches what the step is for. `[eyes]`
- Each view has one primary action, visibly stronger than the rest. Two equally loud buttons side
  by side are a finding. `[eyes]`
- Heading sizes go down with heading level, and no heading is smaller than the body text.
  `[script]`
- Where one place offers more than three secondary actions, the extra ones are gathered behind a
  menu rather than all shown at full strength. `[eyes]`

### V2 Grouping

- The space between groups is at least twice the space inside a group, so groups can be counted
  without reading. `[eyes]`
- Each label, hint and error sits nearer to its own control than to any other. `[eyes]`
- Controls look different from static text and nothing static looks pressable. `[eyes]`
- Things that belong together share a container or an edge, and things that do not belong
  together do not. `[eyes]`

### V3 Spacing and alignment

- Elements in one column or row share an edge. Count the distinct left edges in a region: a stray
  edge a few pixels off is a finding. `[eyes]`
- The same relation uses the same gap on every screen (label to field, card to card, section to
  section). A third value for the same relation is a finding. `[eyes]`
- Nested rounded corners look parallel: the inner curve follows the outer one. `[eyes]`
- An icon and its text sit on the same line and look centred in their control. `[eyes]`

### V4 Type

- Body text is at least 16 px, supporting text at least 13 px, and nothing a person needs to read
  is below 12 px. `[script]`
- Long-form text runs 60 to 75 characters a line. `[script]`
- Text that wraps to three or more lines has line spacing of at least 1.4 times its size.
  `[script]`
- The screen uses a small set of sizes and weights, each with a visible role. Text below 18 px is
  not set lighter than regular weight. Numbers that change or sit in columns keep the same width
  per digit, so they do not jiggle or misalign. `[eyes]`

### V5 Colour

- One colour, one meaning. The same hue does not mean two things (the brand accent is not also
  the error colour). `[eyes]`
- Colours with a common meaning are used for that meaning: danger for destructive and failed,
  success for done, warning for caution. `[eyes]`
- Beyond the neutrals, one accent and the status colours, every further colour has a job a
  reviewer can name. `[eyes]`

### V6 Consistent components

- The same kind of control measures the same wherever it appears: height, corner, padding, label
  style. `[script]`
- No detail is done two ways in one product: two corner sizes for the same card, two icon
  families, two shadow styles, two date formats. `[eyes]`
- Controls of one kind show the same change on hover, focus and press. `[script]`
- Icons come from one family, and their line weight matches the weight of the text beside them.
  `[eyes]`

### V7 Finish

- Nothing is clipped, overlapping or touching the edge of its container without padding.
  `[eyes]`
- Nothing jumps when content, images or fonts arrive: the measured layout shift is nil.
  `[script]`
- Images are sharp, in proportion, and have a visible edge where they sit on a background close
  to their own colour. `[eyes]`
- Text that is cut short shows that it is cut short. `[eyes]`

### V8 Data at a glance

- The chart type fits the question: bars to compare, a line for change over time, parts of a
  whole only for a few parts. Bars start at zero. `[eyes]`
- Series are labelled on the chart or in a legend in the same order as the marks, and one colour
  means the same series across every chart on the screen. `[eyes]`
- Numbers in a column align so they can be compared down the column, with their unit stated.
  `[eyes]`
- The figure or status the screen exists to show can be read without hovering or opening
  anything. `[eyes]`

### V9 Character

- The screen follows the Style section of the project's decisions file where there is one: its
  type, colour, shape, density and voice. A departure from it is a finding. Without a decisions
  file, judge only whether the product is consistent with itself. `[eyes]`
- Distinctive choices are carried through every screen, not made on one and dropped on the next.
  `[eyes]`
- No unstyled leftovers stand beside designed parts: a browser-default control among custom
  ones, a stock placeholder picture, a default link colour. `[eyes]`

---

## Interaction

### I1 Where am I

- The current place is marked in the navigation by more than colour, and the screen's title
  names it in the same words. `[eyes]`
- Navigation is in the same place and the same order on every screen. `[eyes]`
- In a flow of several steps, the screen shows which step this is and how many there are.
  `[eyes]`
- Deep content shows the path back to its parents. The top level offers at most seven
  destinations. `[eyes]`

### I2 Feedback

- Every press produces a visible response within 100 ms: the control shows it was pressed or the
  screen starts to change. `[script]`
- The result of an action is stated where the person is looking, and it is clear whether it
  worked. Success names what happened. `[eyes]`
- A message that disappears by itself stays at least 5 seconds. A message that reports a failure
  or carries an action stays until the person dismisses it. `[script]`
- The thing the person changed shows the change without a reload. `[eyes]`

### I3 State

- What is selected, on, open or checked can be seen at rest, without hovering. `[eyes]`
- What the person typed, chose or scrolled to is still there after an error, after going back
  and after part of the screen refreshes. `[eyes]`
- A switch's label describes what is true when it is on, and the label does not change when the
  switch does. `[eyes]`
- Filters and sort orders in effect are shown, each can be removed alone, and all can be cleared
  at once. `[eyes]`

### I4 Empty and waiting states

- An empty place says what belongs there, how to fill it, and offers one next action. A blank
  area or a table with headers and no rows is a finding. `[eyes]`
- An empty result from a search or a filter names what was asked for and offers a way out.
  `[eyes]`
- Waiting is matched to its length: under 100 ms nothing is shown; up to 1 second a subtle sign;
  from 1 to 10 seconds a clear loading state; beyond 10 seconds progress, an estimate and a way
  to cancel or carry on elsewhere. `[script]`
- A placeholder for loading content has the shape of what replaces it, and nothing moves when the
  real content arrives. `[script]`

### I5 Errors

- An error says what happened and what to do next, in the person's words, beside the thing it is
  about. `[eyes]`
- After an error nothing the person entered is lost, and focus moves to the first problem.
  `[script]`
- When several fields fail, there is a summary at the top and a message at each field. `[eyes]`
- A failure that may pass (a network drop, a timeout) offers to try again. `[eyes]`

### I6 Prevention

- A requirement the product knows in advance (format, length, limits) is shown before the person
  types, not only after they fail. `[eyes]`
- Each field asks for its kind of data: the right keyboard on a phone, the browser's saved
  values offered, pasting allowed. Reasonable variations are accepted and tidied afterwards
  (spaces in a card number, either case). `[script]`
- The submit control stays usable and the form explains what is missing when pressed. A disabled
  control that gives no reason is a finding. `[eyes]`
- Fields are checked when the form is submitted, and at most when the person leaves a field.
  Nothing scolds while the person is still typing. `[eyes]`

### I7 Consequential actions

- An action that destroys or cannot be undone looks different from safe actions and does not sit
  where a routine press lands. `[eyes]`
- An action that cannot be undone, affects other people or touches many items asks first. The
  question names the action and the object, says what will be lost, and its buttons are a verb
  and an object. `[eyes]`
- A frequent action that can be reversed offers undo instead of a question. `[eyes]`
- The gravest actions (deleting an account or a workspace) ask the person to type its name.
  `[eyes]`

### I8 Way out

- Every dialog, mode and step has a visible way to leave it, and Escape leaves it too.
  `[script]`
- Going back keeps what was entered. Leaving with unsaved work warns first. `[eyes]`
- A tour, a prompt or an offer can be dismissed or put off. `[eyes]`
- A long operation can be cancelled. `[eyes]`

### I9 Information at hand

- What the person needs to decide or to fill in is on the screen where it is needed. They are not
  asked to remember it from an earlier screen. `[eyes]`
- Content that is off screen or folded away has a visible cue that it exists: the next item
  shows its edge, or there is a control that opens it. `[eyes]`
- Every value that is cut short can be read in full, by keyboard as well as pointer. `[eyes]`
- Nothing the person needs is shown only on hover. A search field says what it searches, shows
  how many results it found and keeps the query. `[eyes]`

### I10 Next step

- When a step is finished, the screen offers the next action, and only one as primary. `[eyes]`
- The primary action sits where reading ends and is in view when the person gets there. It is
  never parked where a resize, a zoom or a scroll hides it. `[eyes]`
- No screen is a dead end: every screen, success screens included, has a way forward or back.
  `[eyes]`
- A first run reaches something of value before it asks for optional setup. `[eyes]`

### I11 Motion

- Each motion has a job a reviewer can name from the frames: it shows where something came from
  or went, marks a change of state, or answers a press. `[eyes]`
- Frequent actions (typing, moving between rows, switching tabs, anything started from the
  keyboard) respond at once or within 150 ms. Other interface transitions settle within 300 ms;
  only large surfaces such as dialogs and drawers take longer, up to 500 ms. `[script]`
- Motion never makes the person wait: a press during a transition is taken, and a group of items
  that enters together is all there within about 300 ms. `[script]`
- A thing appears from where it was called (a menu from its button), nothing grows from nothing,
  and leaving is quicker and smaller than arriving. `[eyes]`

### I12 Control states

- The main controls show distinct rest, hover, focus, pressed and disabled states, and the
  measured change between each pair is large enough to see. `[script]`
- A disabled control looks disabled, does not react to a press, and the reason is stated nearby.
  `[eyes]`
- A control that is working keeps its label and its width, shows that it is working, and cannot
  be fired twice. `[eyes]`
- The pressed state shows on press, not on release. `[script]`

---

## Content

### C1 One name per thing

- One thing has one name on every screen: in the navigation, headings, buttons and messages.
  `[eyes]`
- A navigation label and the title of the screen it opens use the same words. `[script]`
- One action has one verb ("Delete" does not become "Remove" two screens later). `[eyes]`

### C2 Plain words

- No internal terms, codes or idioms. A person who has never seen the product knows each word.
  `[eyes]`
- The screen speaks to "you", and the verb matches the device in hand (tap, click or the neutral
  "select"). `[eyes]`
- One sentence carries one idea, and instructions lead with the action. `[eyes]`

### C3 Honesty

- A control does what its label says, and a status says what is true now: nothing reads "Saved"
  before it is saved. `[eyes]`
- No invented urgency, no consent ticked in advance, no cost that first appears at the last step.
  `[eyes]`
- Sample or demonstration data is marked as such. `[eyes]`

### C4 Before commitment

- What an action will cost, change or send is stated before the control that commits it.
  `[eyes]`
- A form with real stakes shows a review of what will be submitted before it is submitted.
  `[eyes]`
- What happens next is said at the point of commitment (when it takes effect, whether it can be
  changed). `[eyes]`

### C5 No leftovers

- No placeholder or generated filler: sample Latin, "TODO", "Label", "Title goes here".
  `[script]`
- No raw output: `undefined`, `null`, `NaN`, an object printed as text, an internal key or id, a
  stack trace, an untranslated string. `[script]`
- No control that does nothing and no link that leads nowhere. `[eyes]`

### C6 Specific labels

- A button names its action with a verb, and its object where there could be doubt. "OK", "Yes",
  "No" and "Submit" alone are findings where a specific label exists. `[script]`
- Link text says where it leads. "Click here" and a bare "Learn more" are findings. `[script]`
- A heading says what its section holds, and a confirmation's title names the action and the
  object, never "Are you sure?". `[eyes]`

### C7 Written for this person

- The tone fits the stakes: calm and exact when something failed or will be destroyed, no jokes
  there, no blame, no "oops", no exclamation marks in errors. `[eyes]`
- Words are the person's, not the system's: what they call the thing, not what the database
  calls it. `[eyes]`
- One capitalisation rule for each kind of element (all buttons one way, all headings one way).
  `[script]`

### C8 Relevant

- Every sentence on the screen helps with this step. Nothing repeats the heading in the body or
  explains what is already plain. `[eyes]`
- The most needed words come first: in the screen, in each paragraph and in each label. `[eyes]`
- Help appears where the question arises, not gathered at the top or on another screen. `[eyes]`

### C9 Open about limits

- What the product cannot do, or cannot do right now, is said with the reason, rather than
  hidden or left to fail. `[eyes]`
- Values that are estimates, out of date or partial say so (as of when, roughly, first 50 of
  312). `[eyes]`
- An unavailable option is shown as unavailable with what would make it available. `[eyes]`

---

## Responsive design

### R1 Fits

- At every captured size the page does not scroll sideways. `[script]`
- At every captured size nothing is clipped, overlapping or pushed out of reach. `[script]`
- Long content (a long name, a long number, a translated label) wraps or is cut short on
  purpose. It does not break out of its container. `[eyes]`

### R2 Complete at the smallest size

- Everything that can be done and read at the largest size can be done and read at the smallest.
  Nothing is removed to make room. `[eyes]`
- Table columns or details folded away at small sizes can still be reached, and there is a cue
  that they exist. `[eyes]`
- The primary action of each step can be reached at the smallest size without hunting. `[eyes]`

### R3 Touch targets

- Every target is at least 24 by 24 px, or has enough clear space around it that a 24 px circle
  on it touches no other target. `[script]`
- At touch sizes, primary and frequent controls aim for 44 by 44 px (40 by 40 at pointer sizes
  where density allows). Missing this aim alone is never above minor. `[script]`
- Neighbouring targets are far enough apart that a near miss does not press the wrong one,
  above all beside a destructive control. `[eyes]`

### R4 Readable without zooming

- At phone sizes body text is at least 16 px and nothing needed is below 12 px. `[script]`
- At phone sizes text in fields is at least 16 px, so focusing a field does not zoom the page.
  `[script]`
- At wide sizes long-form text still runs no more than about 75 characters a line. `[script]`

### R5 Reshaped, not shrunk

- Columns that stood side by side stack at small sizes in an order that keeps the most important
  first. `[eyes]`
- A table or chart takes a form suited to a small screen (cards, a simpler chart, or scrolling
  inside its own area with a cue), rather than being scaled down until unreadable. `[eyes]`
- Navigation changes form with the size (three to five destinations in a bottom bar on a phone,
  a full bar on a desktop) rather than staying one bar that shrinks. `[eyes]`

### R6 Overlays fit

- A dialog, menu or sheet lies wholly inside the screen at every captured size, with its actions
  in view or reachable by scrolling inside it. `[script]`
- While an overlay is open, the page behind it does not scroll. `[eyes]`
- Nothing sits under the device's own chrome (browser bars, the notch, the home indicator), and
  the focused field and its submit control stay clear of the on-screen keyboard. `[eyes]`, and
  not verified without a real device.

### R7 Designed for each size

- A wide screen uses its width: no single stretched column with very long lines, and no phone
  layout floating in the middle of a desktop. `[eyes]`
- Each captured size looks composed for that size: no size at which the layout is merely the
  next size squeezed or stretched. `[eyes]`
- Density follows the input: roomier where fingers press, tighter where a pointer does. `[eyes]`

### R8 Device habits

- Anything shown or offered on hover has another way to reach it on touch. `[eyes]`
- Each field brings up the keyboard that suits it (numbers, email, search). `[script]`
- An action done by a gesture (swipe, long press, drag) also has a visible control. `[eyes]`
- On touch, a press answers when the finger lands, a hover style does not stay stuck after a
  tap, and a layout meant to fill the screen ends above the browser's bars. `[eyes]`, and not
  verified without a real device.

---

## Major on sight

These failures are at least **major** whenever they are seen, whatever the style guide or the
decisions file says. They are **blocker** when they stop the person finishing the task or mislead
them into harm. Each belongs to one role and one criterion, so it is reported once.

| # | Failure | Role | Criterion |
|---|---|---|---|
| 1 | A control with no accessible name | Accessibility | A2 |
| 2 | A field whose only label is its placeholder | Accessibility | A2 |
| 3 | A control the keyboard reaches that shows no focus indicator | Accessibility | A4 |
| 4 | A control or a path a pointer can use and the keyboard cannot | Accessibility | A9 |
| 5 | Body or control text below its required contrast ratio | Accessibility | A1 |
| 6 | A state or a meaning carried by colour alone | Accessibility | A3 |
| 7 | Content or a control clipped, overlapped or out of reach at 200% zoom, or zoom disabled | Accessibility | A7 |
| 8 | Motion or auto-playing content that ignores a request for reduced motion | Accessibility | A10 |
| 9 | Content that moves by itself for more than 5 seconds with no way to pause it | Accessibility | A10 |
| 10 | A semantic colour used against its meaning (success colour on a destructive action) | Visual design | V5 |
| 11 | A destructive action with no confirmation, no undo and no distinct look | Interaction | I7 |
| 12 | An error that names no way to recover | Interaction | I5 |
| 13 | What the person entered is thrown away by an error or a failed submit | Interaction | I5 |
| 14 | A value cut short with no way to read it in full | Interaction | I9 |
| 15 | Content or a control that exists only past a scroll edge or behind a fold, with no visible cue | Interaction | I9 |
| 16 | A wait of more than 1 second with no sign that anything is happening | Interaction | I4 |
| 17 | A message that reports a failure, or carries the only way to act, and disappears by itself | Interaction | I2 |
| 18 | A field that refuses pasted input | Interaction | I6 |
| 19 | A change of state shown by motion alone, with nothing left on the screen once it settles | Interaction | I11 |
| 20 | Motion the person must wait out before they can act | Interaction | I11 |
| 21 | Content or a control clipped, overlapped or out of reach at a captured size down to 320 px wide | Responsive design | R1 |
| 22 | A target smaller than 24 by 24 px without the clear space that excuses it | Responsive design | R3 |

Rows 1, 3 to 8, 10 to 12, 14, 15, 19 and 21 are the escalation triggers of the `better-interface`
source. Its "clipped at 320 px or 200% zoom" trigger is split in two (rows 7 and 21) so that each
row has one owner. The remaining rows are requirements the sources state without exception.

## Not an issue

Do not report any of these. They cost the loop a round and teach it nothing.

- **A recorded decision.** A choice written in the project's `design-decisions.md` is chosen. This
  never covers a failure in "Major on sight" or anything that stops or misleads a person.
- **A preference with no cost you can name.** If you cannot say what the person fails to do, does
  slower or doubts, it is not a finding. "I would have used a larger radius" is not one.
- **A departure from a source's house style.** The sources have tastes (a press scale, a favourite
  curve, a spring). A product that does it differently, deliberately and the same way everywhere,
  has made a choice. The same detail done two ways within the product is a finding (V6).
- **A check you could not run.** Report it as not verified.
- **The same cause a second time.** One cause is one finding, with every place it shows listed in
  it. Name the shared token or component when you can see that the cause is shared.
