# Design decisions

An example to copy and replace. The product here is made up: an internal tool for a warehouse
team, used at a desk and on a handheld. Rename the tokens to your own and delete what you have
not decided. The format and its rules are in `references/decisions-format.md` of the
`interface-craft` skill.

## Style

### Type

- One family for the interface (`font-sans`), one fixed-width family for codes and quantities
  (`font-mono`). No third family.
- Sizes in use: 13 px captions and table meta, 14 px controls and table cells, 16 px body, 20 px
  section headings, 28 px screen titles. Nothing below 13 px.
- Weights: 400 for text, 500 for labels and table headers, 600 for headings.
- Long text (help, notes) is capped at 70 characters a line.
- Quantities and codes use equal-width digits everywhere.

### Colour

- Neutrals: the `slate` ramp. Accent: `teal`, used for the primary action and the current place
  in navigation, and for nothing else.
- Status: `red` means failed or destructive, `amber` means needs attention, `green` means done.
  Status is always shown with an icon and a word as well.

Colour contract:

| Foreground | Background | Used for | Minimum contrast |
|---|---|---|---|
| `text-default` | `surface` | Body text, table cells | 4.5:1 |
| `text-muted` | `surface` | Captions, helper text, placeholders | 4.5:1 |
| `text-default` | `surface-raised` | Text on cards and dialogs | 4.5:1 |
| `text-on-accent` | `accent` | Label of the primary button | 4.5:1 |
| `text-danger` | `surface` | Error messages | 4.5:1 |
| `text-on-danger` | `danger` | Label of a destructive button | 4.5:1 |
| `border-control` | `surface` | Edges of fields, checkboxes, quiet buttons | 3:1 |
| `focus-ring` | `surface` and `accent` | Focus indicator | 3:1 |
| `icon-status-*` | `surface` | Status icons | 3:1 |

### Spacing

- Scale: 4, 8, 12, 16, 24, 32, 48 px.
- Inside a control: 8 px vertical, 12 px horizontal. Label to its field: 4 px. Field to field:
  16 px. Group to group: 32 px. Section to section: 48 px.

### Shape

- Corners: 6 px on controls, 10 px on cards and dialogs, full on status pills.
- Borders separate things on the same level. Shadows are used only for things that float above
  the page: menus, dialogs, toasts.
- One icon family, outline style, 1.5 px line.

### Density

- Desk screens are dense: table rows 36 px high, controls 32 px high.
- Handheld screens are roomy: rows and controls at least 56 px high, one column (D-006).

### Motion

- Navigation between screens and anything started from the keyboard does not animate.
- Menus and tooltips: 150 ms. Dialogs and the handheld sheet: 250 ms. Press feedback: 120 ms.
  All use `ease-out-strong`.
- Under reduced motion every change is an opacity fade of 100 ms or instant.

### Voice

- Speaks to "you". Plain, short, calm. No exclamation marks.
- Sentence case for everything: buttons, headings, table headers.
- The product says "order", "pallet", "bay" and "pick". It does not say "item", "container",
  "location" or "fulfil".
- Buttons are a verb and an object: "Print labels", "Close order".

## Decisions

### D-001  Desk tables are dense

- Date: 2026-03-02
- Decision: Tables on desk screens use 36 px rows and 14 px text. They are not given more air.
- Why: Supervisors compare forty or more orders at once and asked not to scroll.
- Applies to: Every table at widths of 1024 px and above.
- Supersedes: nothing.

### D-002  No dark theme

- Date: 2026-03-02
- Decision: The product ships one light theme.
- Why: The handhelds are used under strong warehouse lighting, where a dark theme reads worse.
- Applies to: The whole product.
- Supersedes: nothing.

### D-003  Handheld rows are 48 px

- Date: 2026-03-16
- Decision: Rows and controls on the handheld are at least 48 px high.
- Why: Fingers, not a pointer.
- Applies to: Every screen below 600 px wide.
- Supersedes: nothing.

### D-004  Navigation does not animate

- Date: 2026-03-16
- Decision: Moving between screens and switching tabs is instant.
- Why: Pickers change screen hundreds of times a shift. Any transition reads as delay.
- Applies to: The whole product.
- Supersedes: nothing.

### D-005  Closing an order asks first

- Date: 2026-04-07
- Decision: "Close order" asks for confirmation, naming the order and the number of unpicked
  lines that will be cancelled. It does not offer undo.
- Why: Closing releases stock to other orders at once and cannot be reversed.
- Applies to: The order screen, desk and handheld.
- Supersedes: nothing.

### D-006  Handheld rows are 56 px

- Date: 2026-05-11
- Decision: Rows and controls on the handheld are at least 56 px high.
- Why: Pickers wear gloves. 48 px led to wrong taps in the first trial.
- Applies to: Every screen below 600 px wide. Style, Density was updated in the same edit.
- Supersedes: D-003.
