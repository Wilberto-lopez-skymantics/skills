# Routing

Which source files to open for a task. Find the row, open only the files it names, and read
`ownership.md` first if two of them might disagree. Never load the whole of `sources/`.

Paths are relative to `sources/`. In the tables, `J/` stands for `jakub/skills/`, `E/` for
`emil/skills/`, `O/` for `owl/interaction-design/skills/`, and `OU/` for `owl/ui-design/skills/`.
The first file in a row is the owner; the ones after it are supporting detail, opened only if the
first does not settle the task.

In the jakub folders, `SKILL.md` states every rule of its domain in brief and the files beside it
hold the detail and the recipes. A row names `SKILL.md` where the rule lives there.

Before any source file, check the project's `design-decisions.md` and its existing tokens and
components. If the project already has the value, use it and open nothing.

## By kind of issue

| The issue is about | Open |
|---|---|
| Text contrast, a failing colour pair | `J/better-colors/contrast.md`, `J/better-accessibility/SKILL.md` |
| Contrast of borders, icons, control states | `J/better-accessibility/SKILL.md`, `J/better-colors/contrast.md` |
| Focus indicator, Tab order, keyboard reach, focus in dialogs and menus | `J/better-accessibility/focus-and-keyboard.md` |
| Names of controls, icon-only buttons, text alternatives, announcements | `J/better-accessibility/screen-readers.md`, `J/better-accessibility/semantics-and-aria.md` |
| Headings, landmarks, page title, the right element for the job | `J/better-accessibility/semantics-and-aria.md` |
| Meaning carried by colour alone | `J/better-colors/color-usage.md`, `J/better-accessibility/SKILL.md` |
| Zoom, reflow at narrow widths, timed or auto-playing content | `J/better-accessibility/motion-and-zoom.md` |
| Reduced motion | `J/better-accessibility/motion-and-zoom.md`, `E/animate/SKILL.md` |
| Forms: labels, field types, validation, error placement | `J/better-accessibility/forms.md` |
| Forms: order, grouping, length, steps, review before submit | `O/form-design/SKILL.md` |
| Errors: what the message says | `J/better-writing/SKILL.md` |
| Errors: where they show, keeping input, focus | `J/better-accessibility/forms.md` |
| Empty states and first run | `J/better-writing/SKILL.md`, `O/onboarding-design/SKILL.md` |
| Waiting, loading, skeletons, progress | `O/loading-states/SKILL.md` |
| Navigation, current place, depth, number of destinations | `O/navigation-patterns/SKILL.md` |
| Search, filters, no results | `O/search-ux/SKILL.md` |
| Destructive actions, confirm or undo | `J/better-writing/SKILL.md`, `J/better-writing/patterns.md` |
| Wording, terminology, tone, button and link labels | `J/better-writing/SKILL.md` |
| Status messages, plurals, dates and numbers by locale | `J/better-writing/patterns.md` |
| Hierarchy, grouping, alignment, one primary action | `J/better-layout/SKILL.md`, `J/better-layout/grouping-and-alignment.md` |
| Spacing, container sizes, breakpoints, content hidden or cut short | `J/better-layout/SKILL.md`, `J/better-layout/spacing-and-adaptivity.md` |
| Type sizes, weights, line length, line spacing | `J/better-typography/SKILL.md`, `J/better-typography/spacing-and-sizing.md` |
| Wrapping, truncation, punctuation, numerals in tables | `J/better-typography/SKILL.md`, `J/better-typography/wrapping-and-punctuation.md` |
| Underlines, text selection, text in fields | `J/better-typography/details-and-accessibility.md` |
| Fonts: choice, loading, variable fonts | `J/better-typography/choosing-fonts.md`, `J/better-typography/variable-fonts-and-opentype.md` |
| Colour: palette, meaning, one accent, dark theme | `J/better-colors/SKILL.md`, `J/better-colors/color-usage.md`, `J/better-colors/palette-structure.md` |
| Colour tokens: naming, formats, generating a ramp | `J/better-colors/token-naming.md`, `J/better-colors/color-formats.md`, `J/better-colors/palette-generation.md` |
| Surfaces: radius, borders, shadows, image edges, optical alignment | `J/better-ui/SKILL.md`, `J/better-ui/surfaces.md` |
| Icons | `J/better-ui/icons.md`, `J/better-ui/icon-transitions.md` |
| Control states: hover, pressed, disabled, working | `J/better-accessibility/semantics-and-aria.md` (disabled), `J/better-accessibility/forms.md` (working), `E/animate/RECIPES.md` (press), `J/better-ui/SKILL.md` |
| Motion: should this move at all | `E/review-animations/STANDARDS.md` (frequency table), `E/remove-animations/SKILL.md` |
| Motion: duration, easing, springs | `E/review-animations/STANDARDS.md`, `E/animate/SKILL.md` |
| Motion for one component (button, menu, tooltip, dialog, drawer, toast, accordion, tabs) | `E/animate/RECIPES.md` |
| Motion: things entering, leaving, sequences | `E/choreograph/SKILL.md`, `E/choreograph/RECIPES.md` |
| Motion that stutters, drops frames or shifts layout | `E/animation-performance/SKILL.md`, `J/better-ui/performance.md` |
| Drag, swipe, sheets, hold to confirm | `E/gestures/SKILL.md` |
| Touch targets | `J/better-accessibility/hit-areas.md` |
| Touch-device behaviour: viewport height, safe areas, tap delay, sticky hover, keyboard | `E/mobile-native/SKILL.md` |
| Small-screen layout | `J/better-layout/SKILL.md`, `J/better-layout/spacing-and-adaptivity.md`, `O/navigation-patterns/SKILL.md` |
| Charts and data display | `OU/data-visualization/SKILL.md`, `J/better-typography/SKILL.md` for numbers in columns |
| A component that breaks with long, missing or odd content | `J/break/scenarios.md`, `E/break-ui/CATALOG.md` |
| Seeing every state of a component | `J/state-machine/SKILL.md` |
| Reviewing a change before it is handed back | `J/interface-review/SKILL.md`, `J/better-interface/review-format.md` |
| Auditing motion across a codebase | `E/improve-animations/AUDIT.md`, `E/review-animations/SKILL.md` |
| Naming an effect someone describes | `E/animation-vocabulary/SKILL.md` |

## By rubric criterion

For findings that arrive with a criterion id from `ux-quality-score` (rubric version 5) or from
`review-standards.md`. The ids are the same in both.

### Accessibility

| Id | Criterion | Open |
|---|---|---|
| A1 | Text contrast | `J/better-colors/contrast.md`, `J/better-accessibility/SKILL.md` |
| A2 | Labels and names | `J/better-accessibility/SKILL.md`, `J/better-accessibility/forms.md`, `J/better-accessibility/semantics-and-aria.md` |
| A3 | Not colour alone | `J/better-accessibility/SKILL.md`, `J/better-colors/color-usage.md` |
| A4 | Keyboard focus visible | `J/better-accessibility/focus-and-keyboard.md` |
| A5 | Structure | `J/better-accessibility/semantics-and-aria.md` |
| A6 | Text alternatives | `J/better-accessibility/screen-readers.md`, `OU/data-visualization/SKILL.md` for charts |
| A7 | Zoom | `J/better-accessibility/motion-and-zoom.md`, `J/better-layout/SKILL.md` |
| A8 | Non-text contrast | `J/better-accessibility/SKILL.md`, `J/better-colors/contrast.md` |
| A9 | Keyboard reach and order | `J/better-accessibility/focus-and-keyboard.md` |
| A10 | Reduced motion honoured | `J/better-accessibility/motion-and-zoom.md`, `E/review-animations/STANDARDS.md` |

### Visual design

| Id | Criterion | Open |
|---|---|---|
| V1 | Hierarchy | `J/better-layout/SKILL.md`, `J/better-typography/spacing-and-sizing.md` for heading sizes |
| V2 | Grouping | `J/better-layout/SKILL.md`, `J/better-layout/grouping-and-alignment.md` |
| V3 | Spacing and alignment | `J/better-layout/grouping-and-alignment.md`, `J/better-layout/spacing-and-adaptivity.md`, `J/better-ui/surfaces.md` for nested corners and optical alignment |
| V4 | Type | `J/better-typography/SKILL.md`, `J/better-typography/spacing-and-sizing.md` |
| V5 | Colour | `J/better-colors/SKILL.md`, `J/better-colors/color-usage.md`, `J/better-colors/palette-structure.md` |
| V6 | Consistent components | `J/better-ui/SKILL.md`, `J/better-ui/icons.md`, `J/better-colors/token-naming.md` |
| V7 | Finish | `J/better-ui/SKILL.md`, `J/better-ui/surfaces.md`, `J/better-typography/SKILL.md` for text cut short, `E/animation-performance/SKILL.md` for layout shift |
| V8 | Data at a glance | `OU/data-visualization/SKILL.md`, `J/better-typography/SKILL.md` for numbers in columns |
| V9 | Character | The project's `design-decisions.md` first. Then `J/better-typography/choosing-fonts.md`, `J/better-colors/palette-structure.md` |

### Interaction

| Id | Criterion | Open |
|---|---|---|
| I1 | Where am I | `O/navigation-patterns/SKILL.md` |
| I2 | Feedback | `E/animate/RECIPES.md` (press, toast), `J/better-accessibility/motion-and-zoom.md` for timed messages, `J/better-writing/patterns.md` for status wording |
| I3 | State | `J/better-writing/SKILL.md` (switch labels), `J/better-accessibility/forms.md` (keeping input), `O/search-ux/SKILL.md` for filters |
| I4 | Empty and waiting states | `J/better-writing/SKILL.md` (empty states), `O/loading-states/SKILL.md`, `O/onboarding-design/SKILL.md` |
| I5 | Errors | `J/better-writing/SKILL.md`, `J/better-accessibility/forms.md` |
| I6 | Prevention | `J/better-accessibility/forms.md`, `O/form-design/SKILL.md` |
| I7 | Consequential actions | `J/better-writing/SKILL.md`, `J/better-writing/patterns.md` |
| I8 | Way out | `J/better-accessibility/focus-and-keyboard.md`, `O/form-design/SKILL.md` for multi-step forms |
| I9 | Information at hand | `J/better-layout/SKILL.md`, `J/better-layout/spacing-and-adaptivity.md`, `O/search-ux/SKILL.md` |
| I10 | Next step | `J/better-layout/SKILL.md`, `O/onboarding-design/SKILL.md` |
| I11 | Motion | `E/review-animations/STANDARDS.md`, `E/animate/RECIPES.md`, `E/choreograph/SKILL.md` for groups |
| I12 | Control states | `J/better-accessibility/semantics-and-aria.md` (disabled), `J/better-accessibility/forms.md` (working), `E/animate/RECIPES.md` (press), `J/state-machine/SKILL.md` to see them all |

### Content

| Id | Criterion | Open |
|---|---|---|
| C1 | One name per thing | `J/better-writing/SKILL.md` |
| C2 | Plain words | `J/better-writing/SKILL.md` |
| C3 | Honesty | `J/better-writing/patterns.md` (status wording), `O/onboarding-design/SKILL.md` for sample data |
| C4 | Before commitment | `J/better-writing/patterns.md` (destructive flows), `O/form-design/SKILL.md` |
| C5 | No leftovers | `J/break/scenarios.md`, `E/break-ui/CATALOG.md` |
| C6 | Specific labels | `J/better-writing/SKILL.md` |
| C7 | Written for this person | `J/better-writing/SKILL.md` |
| C8 | Relevant | `J/better-writing/SKILL.md` |
| C9 | Open about limits | `J/better-writing/patterns.md` (status wording), `J/better-accessibility/semantics-and-aria.md` (unavailable controls) |

### Responsive design

| Id | Criterion | Open |
|---|---|---|
| R1 | Fits | `J/better-layout/SKILL.md`, `J/better-layout/spacing-and-adaptivity.md`, `J/break/scenarios.md` |
| R2 | Complete at the smallest size | `J/better-layout/spacing-and-adaptivity.md` |
| R3 | Touch targets | `J/better-accessibility/hit-areas.md` |
| R4 | Readable without zooming | `J/better-typography/SKILL.md` |
| R5 | Reshaped, not shrunk | `J/better-layout/spacing-and-adaptivity.md`, `O/navigation-patterns/SKILL.md`, `OU/data-visualization/SKILL.md` for charts |
| R6 | Overlays fit | `E/mobile-native/SKILL.md`, `J/better-ui/SKILL.md` (scroll inside overlays), `J/better-accessibility/focus-and-keyboard.md` |
| R7 | Designed for each size | `J/better-layout/SKILL.md`, `J/better-layout/spacing-and-adaptivity.md` |
| R8 | Device habits | `E/mobile-native/SKILL.md`, `E/gestures/SKILL.md`, `J/better-accessibility/forms.md` for field keyboards |

## When nothing matches

Open `J/better-interface/SKILL.md` for the review method and its ownership notes, pick the
nearest row above, and say in your hand-back that the routing table had no row for the issue, so
that one can be added.
