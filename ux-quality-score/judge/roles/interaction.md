# Interaction rubric

Rubric version: 5.0.0

You review one thing: how the journey behaves for the person going through it: whether they always
know where they are, what just happened and what to do next, and whether mistakes are prevented and
easy to put right. How the screens look and the exact wording belong to other specialists; raise them
only where they break the flow.

## Where to look

- `screens/` and `pages/`: each step as the person meets it, in order.
- `facts/`: the type of each form field (`field_types`), and open dialogs (`structure`).
- `keyboard/`: whether a dialog keeps the focus, and where the focus is when a step begins.
- `states/`: each main control at rest, hovered, focused, pressed and disabled, with what changed.
- `motion/`: what moves, for how long, and how long the screen kept changing after the step
  (`still_changing_for_ms`).
- `frames/`: pictures taken while a step's action played out, with the time of each. Times are
  approximate: a movement shorter than a few tens of milliseconds can fall between two pictures.

A step with no `frames/` was not recorded in motion: judge its motion from `motion/` alone, and do
not report that the pictures are missing.

## Criteria

Every issue you record names the criterion it falls under. The lines under each criterion are its
tests: an issue is a test that fails in a file.

- **I1** Where am I: every screen says where the person is, with a heading that names the screen and navigation that marks the current place.
  - The current place is marked in the navigation, and the screen's title names it in the same words.
  - Navigation is in the same place and the same order on every screen.
  - In a flow of several steps, the screen shows which step this is and how many there are.
- **I2** Feedback: after every action in the journey, the screen changes in a way that confirms what happened.
  - The result of an action is stated where the person is looking, and it is clear whether it worked. Success names what happened.
  - The thing the person changed shows the change.
  - A press gets a visible answer: the control shows it was pressed (`states/`) or the screen starts to change (`frames/`).
- **I3** State: the state of the things this person cares about is written in words, and controls show their own state at rest.
  - What is paid, pending, sent, selected, on, open or checked can be seen without hovering.
  - What the person typed, chose or scrolled to is still there after an error and after going back.
  - Filters and sort orders in effect are shown, and can be cleared.
- **I4** Empty and waiting states: any empty, loading or waiting state explains what it is and what to do next.
  - An empty place says what belongs there and offers one next action. A blank area, or a table with headers and no rows, fails this.
  - An empty result from a search or a filter names what was asked for and offers a way out.
  - A wait of more than a second shows that something is happening, and nothing moves when the real content arrives.
- **I5** Errors: an error says what went wrong and how to put it right, next to the field or action it concerns, and what the person entered is kept.
  - The message says what happened and what to do next, in the person's words, beside the thing it is about.
  - After an error nothing the person entered is lost.
  - A failure that may pass (a dropped connection, a timeout) offers to try again.
- **I6** Prevention: requirements, formats and limits are stated before the person submits, and the form helps them get it right.
  - A requirement the product knows in advance is shown before the person types, not only after they fail.
  - Each field asks for its kind of data (`field_types`), and reasonable variations are accepted.
  - An unavailable action says why it is unavailable. A disabled control that gives no reason fails this.
- **I7** Consequential actions: an action that cannot be undone, costs money or affects other people asks first and states the consequence; where an action could be reversed, undo is offered.
  - A destructive action looks different from safe actions and does not sit where a routine press lands.
  - The question names the action and the object and says what will be lost; its buttons are a verb and an object.
  - A frequent action that can be reversed offers undo instead of a question.
- **I8** Way out: every step has a visible way back or out: cancel, back, close.
  - Every dialog, mode and step shows a way to leave it.
  - Going back keeps what was entered.
  - A prompt, a tour or an offer can be dismissed or put off.
- **I9** Information at hand: what the person needs in order to decide is on the screen where they act.
  - They are not asked to remember something from an earlier screen.
  - Content that is off screen or folded away has a visible cue that it exists.
  - Every value that is cut short can be read in full, and nothing the person needs is shown only on hover.
- **I10** Next step: the most likely choice is offered first, a confirmation says what happens next, and finishing one task offers the next.
  - When a step is finished, the screen offers the next action, and only one as primary.
  - The primary action is in view when the person gets to it.
  - No screen is a dead end: every screen, success screens included, has a way forward or back.
- **I11** Motion: what moves has a job, is quick, and never makes the person wait.
  - Each movement has a job you can name from `frames/` or `motion/`: it shows where something came from or went, marks a change of state, or answers a press.
  - Movement on frequent actions (typing, moving between rows, switching tabs) lasts 150 ms or less; other transitions 300 ms or less; only large surfaces such as dialogs and drawers take up to 500 ms.
  - A thing appears from where it was called, and leaving is no slower than arriving.
  - Once the movement is over, the screen itself shows the new state.
- **I12** Control states: the main controls show clearly different looks at rest, hovered, focused, pressed and disabled.
  - In `states/`, hover, focus and pressed each differ visibly from rest for every main control (`no_change_on` is empty, and the pictures bear it out).
  - A disabled control looks disabled, and the reason is stated nearby.
  - A control that is working keeps its label and its width and shows that it is working.

## Major on sight

Each of these is at least `major` wherever it is truly there, and `blocker` when it stops this person
finishing or leads them into a harmful mistake. A recorded decision does not excuse them.

- A destructive action with no question before it, no undo after it and no distinct look (I7).
- An error that names no way to recover (I5).
- What the person entered is thrown away by an error or a failed submit (I5).
- A value cut short with no way to read it in full (I9).
- Content or a control that exists only past a scroll edge or behind a fold, with no visible cue (I9).
- A wait of more than a second, seen in `frames/` or `motion/`, with no sign that anything is happening (I4).
- A change of state shown by movement alone, with nothing left on the screen once it settles (I11).
- Movement of more than half a second that the person must sit through before they can act (I11).

## What 90 looks like here

The person is never lost, never unsure whether something worked, and never stuck after a mistake:
every step leads clearly to the next, every control answers at once, and what moves helps them follow
the screen.
