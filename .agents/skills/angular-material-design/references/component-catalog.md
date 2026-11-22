# Component Catalog

MD3 components by category: when to use which (MD3 guidance), the Angular Material API, a11y notes and
the test harness (NG-UI-17). Rules: NG-UI-01 (Material first), NG-UI-02 (gaps), NG-UI-03 (no internal
styling), NG-UI-12..14 (labels, names, dialogs). Full API and the per-component override tokens:
material.angular.dev, Styling tab.

Harnesses import from `@angular/material/<component>/testing`; everything that isn't a Material composite
widget is queried by role (Testing Library).

## Actions

### Buttons

MD3 orders the five buttons by emphasis: **filled > tonal > elevated > outlined > text**.

| MD3 | Angular | Use when |
|---|---|---|
| Filled | `<button matButton="filled">` | The one primary, final action of a view (Save, Place order) |
| Filled tonal | `matButton="tonal"` | Important but secondary action; next to a filled button, or primary in a less important area |
| Elevated | `matButton="elevated"` | Needs separation from a patterned / image background; otherwise prefer tonal |
| Outlined | `matButton="outlined"` | Medium emphasis, neutral alternative (Back, Edit) |
| Text | `matButton` | Lowest emphasis: dialog actions, inline, "Learn more" |

- One filled button per view region. Several equal options → same emphasis, not several filled.
- `<a matButton routerLink="…">` for navigation, `<button>` for actions (A11Y-07).
- Icons: `<mat-icon>` inside the button; `iconPositionEnd` on the icon to put it after the label.
- Busy state: `[showProgress]="saving()"` with a `<mat-progress-spinner progressIndicator mode="indeterminate" diameter="20" />`
  child (current versions); keep the label for the accessible name and announce completion (live region or
  snackbar).
- Disabled buttons aren't focusable and give no reason. If users need to discover **why** an action is
  unavailable, use `disabledInteractive` (focusable, `aria-disabled`) plus a visible explanation. Better:
  keep the button enabled and show validation errors on submit.
- Harness: `MatButtonHarness`.

### Icon buttons

`<button matIconButton aria-label="Delete order">` with a `mat-icon`. Variants in MD3 (standard, filled,
tonal, outlined) are styled through `mat.icon-button-overrides(...)`; Angular Material ships the standard
one.

- Accessible name is mandatory (NG-UI-13); `matTooltip` with the same text helps sighted mouse users but
  doesn't replace `aria-label`.
- Toggle icon buttons: `[attr.aria-pressed]="isFavorite()"` with a stable label ("Favorite"), not a label
  that flips.
- Target size: the default 48 px touch target meets 44 px (A11Y-10); density < 0 can shrink it.

### FAB and extended FAB

| MD3 | Angular |
|---|---|
| FAB | `<button matFab aria-label="New order">` |
| Small FAB | `matMiniFab` |
| Extended FAB | `<button matFab extended><mat-icon>add</mat-icon>New order</button>` |

- One FAB per screen, for the single most important constructive action (create, compose). Not for
  destructive or minor actions.
- On compact place it bottom-end above the navigation bar; on medium+ at the top of the rail or in the
  content.
- Color via `mat.fab-overrides(...)` (MD3 default container is primary-container).
- FAB menu (Expressive) has no Material component: `matFab` + `[matMenuTriggerFor]` (gap, NG-UI-02).
- Harness: `MatButtonHarness`.

### Segmented buttons and button groups

MD3 segmented button → `mat-button-toggle-group` (single select default, `multiple` for multi). 2–5
options, short labels. Use for switching views or a filter, not for actions.

```html
<mat-button-toggle-group [(value)]="view" aria-label="Order view" hideSingleSelectionIndicator>
  <mat-button-toggle value="list">List</mat-button-toggle>
  <mat-button-toggle value="board">Board</mat-button-toggle>
</mat-button-toggle-group>
```

Harness: `MatButtonToggleGroupHarness`. MD3 Expressive button groups (connected action buttons) and split
buttons have no Material component; see SKILL.md § Gap components.

## Communication

### Badge

`matBadge` on the element it annotates. Small (dot, `matBadgeSize="small"` with empty content) for "new",
large with a count (max ~3 characters, `999+`). Provide the information in text too:
`matBadgeDescription="3 unread messages"` or the host's accessible name. `matBadgeHidden` when zero.
Harness: `MatBadgeHarness`.

### Progress indicators

| MD3 | Angular | Use |
|---|---|---|
| Linear determinate / indeterminate | `mat-progress-bar` `mode="determinate"` / `"indeterminate"` (also `buffer`, `query`) | Page or section loading, uploads |
| Circular | `mat-progress-spinner` / `mat-spinner` | Inline or component-level loading |
| Loading indicator (Expressive) | Not available; use `mat-progress-spinner` | |

- Name it: `aria-label="Loading orders"`. Determinate needs `value` 0–100.
- Don't show a spinner for < ~300 ms (flicker); keep content stable to avoid layout shift.
- Harnesses: `MatProgressBarHarness`, `MatProgressSpinnerHarness`.

### Snackbar

`MatSnackBar.open(message, action?, config)`; for custom content `openFromComponent`. MD3: brief,
low-priority feedback about a completed process, at most one action, bottom of the screen
(above the navigation bar on compact), `inverse-surface` colors.

- Material announces the message through a live region (`politeness` config, default polite).
- **With an action, don't auto-dismiss** (`duration` unset) or give ≥ 10 s and an alternative path: users
  of screen readers and keyboards need time to reach it (WCAG 2.2.1, 2.1.1). Without an action a
  `duration` of 4–10 s is fine.
- Critical errors are not snackbars: show them inline or in a dialog.
- Harness: `MatSnackBarHarness`.

### Tooltip

`matTooltip` = MD3 **plain** tooltip: short label for an icon button or truncated text, on hover and
focus. Never essential information only in a tooltip, never interactive content in it. It's dismissible
with Escape and hoverable (WCAG 1.4.13, A11Y-31). Rich tooltips (title, text, actions) are a gap: CDK Overlay
panel or a small non-modal dialog. Harness: `MatTooltipHarness`.

## Containment

### Cards

| MD3 | Angular | Visual |
|---|---|---|
| Elevated | `mat-card` (default `appearance="raised"`) | `surface-container-low` + level 1 |
| Filled | `appearance="filled"` | `surface-container-highest`, level 0 |
| Outlined | `appearance="outlined"` | `surface` + `outline-variant` border |

Parts: `mat-card-header`, `mat-card-title`, `mat-card-subtitle`, `mat-card-avatar`, `mat-card-image`,
`mat-card-content`, `mat-card-actions` (`align="end"`), `mat-card-footer`.

- A card groups content and actions about **one** subject. Not every box needs to be a card.
- Put a real heading in `mat-card-title` (`<h3>`) when cards form a list of sections.
- Whole-card click: one primary link (the title) stretched with a pseudo-element, other actions above it;
  no nested interactive elements inside an `<a>` wrapper.
- Harness: `MatCardHarness`.

### Dialogs (NG-UI-14)

`MatDialog.open(Component, { data, … })`; content uses `<h2 mat-dialog-title>`, `mat-dialog-content`,
`mat-dialog-actions` (`align="end"`), `mat-dialog-close`.

- MD3 basic dialog for decisions that block the flow (confirm deletion, unsaved changes); full-screen
  dialog on compact for complex input (see layout reference). Otherwise prefer inline UI or a page.
- Title states the question; actions are verbs ("Delete", "Keep"), not "Yes/No". Confirming action last,
  text buttons (or tonal for the confirming one).
- Material moves focus into the dialog (`autoFocus` default `'first-tabbable'`; use `'dialog'` or
  `'first-heading'` for long content), traps it, closes on Escape, restores focus to the trigger.
- `disableClose` only if closing would lose data, and then offer an explicit cancel.
- Harness: `MatDialogHarness`.

### Sheets

- **Bottom sheet** (modal): `MatBottomSheet.open(Component)`; MD3 for secondary content or a short action
  list on compact. On expanded+ use a side sheet or menu instead.
- **Side sheet**: `mat-sidenav position="end"` (`mode="side"` standard, `"over"` modal).
- Standard (non-modal) bottom sheet has no Material component; a supporting pane usually fits better.
- Harnesses: `MatBottomSheetHarness`, `MatSidenavHarness`.

### Divider

`mat-divider` (`[inset]`, `[vertical]`) uses `outline-variant`. Use dividers to separate groups in lists
and menus, not as decoration between every item; whitespace often suffices. Decorative dividers are
`role="separator"` by default; that's fine. Harness: `MatDividerHarness`.

### Expansion panels

`mat-accordion` + `mat-expansion-panel` (`mat-expansion-panel-header`, `mat-panel-title`) for progressive
disclosure of secondary content. Don't hide required form fields in collapsed panels. Harnesses:
`MatAccordionHarness`, `MatExpansionPanelHarness`.

### Carousel

No Material component. MD3 configurations: multi-browse, uncontained, hero. Build in `src/shared/ui/`
(NG-UI-02): horizontal scroll container with `scroll-snap`, items in a list, previous/next buttons with
labels, no auto-advance (or pause/stop control, WCAG 2.2.2), all items reachable by keyboard, follow the
APG carousel pattern for announcements.

## Input

### Text fields

`mat-form-field` + `matInput` (`<input>` / `<textarea>`). `appearance="outline"` or `"fill"` (MD3 outlined
and filled text fields). Pick one appearance per app, set it once:

```ts
{ provide: MAT_FORM_FIELD_DEFAULT_OPTIONS, useValue: { appearance: 'outline', subscriptSizing: 'dynamic' } }
```

- Always `mat-label` (NG-UI-12); `mat-hint` for format help; `mat-error` with a specific message
  (WCAG 3.3.1, 3.3.3); `matPrefix` / `matSuffix` / `matTextPrefix` / `matTextSuffix` for icons and units.
- `required` on the input adds the asterisk; explain it once at the top of the form.
- `autocomplete` tokens for personal data (WCAG 1.3.5); correct `type` / `inputmode`.
- `maxlength` + a character counter in `mat-hint align="end"`.
- Password fields: allow paste and password managers (WCAG 3.3.8 / 3.3.9); a visibility toggle is an icon
  button with `aria-pressed`.
- Harnesses: `MatFormFieldHarness`, `MatInputHarness`.

### Select, autocomplete, chips input

| Need | Component | Harness |
|---|---|---|
| Pick 1 of ≥ 6 options (fewer: radios) | `mat-select` in `mat-form-field` | `MatSelectHarness` |
| Pick several from a list | `mat-select multiple` or `mat-selection-list` | `MatSelectHarness`, `MatSelectionListHarness` |
| Type to filter many options / search | `input[matInput][matAutocomplete]` + `mat-autocomplete` | `MatAutocompleteHarness` |
| Enter several free values (tags, recipients) | `mat-chip-grid` + `mat-chip-row` + `input[matChipInputFor]` | `MatChipGridHarness` |

### Chips

| MD3 chip | Angular | Use |
|---|---|---|
| Assist | `mat-chip-set` + `mat-chip` (with action / link) | Smart shortcut related to content ("Add to calendar") |
| Filter | `mat-chip-listbox` + `mat-chip-option` (`multiple`) | Filtering a collection; selected state shows a check |
| Input | `mat-chip-grid` + `mat-chip-row` | User-entered tokens; removable with `matChipRemove` (labelled) |
| Suggestion | `mat-chip-set` + `mat-chip` | Dynamically generated suggestions (replies, queries) |

- Chips appear in groups, never as a single primary action (use a button).
- `mat-chip-listbox` gets an `aria-label`; selection isn't conveyed by color alone (Material adds the
  check mark; keep it).
- Harnesses: `MatChipSetHarness`, `MatChipListboxHarness`, `MatChipGridHarness`, `MatChipHarness`.

### Selection controls

| MD3 | Angular | Use | Harness |
|---|---|---|---|
| Checkbox | `mat-checkbox` (`indeterminate` for parent of a group) | Independent options; multi-select in lists; consent | `MatCheckboxHarness` |
| Radio button | `mat-radio-group` + `mat-radio-button` | One of 2–5 visible options | `MatRadioGroupHarness` |
| Switch | `mat-slide-toggle` | Immediate on/off of a setting (no Save needed) | `MatSlideToggleHarness` |

- Groups of checkboxes/radios sit in a `<fieldset>` with `<legend>` or the group gets `aria-labelledby`
  (WCAG 1.3.1).
- A switch applies immediately; if the change needs a Save button, it's a checkbox.
- The label is part of the control (click target); keep it short and positive ("Email notifications").

### Slider

`mat-slider` with `<input matSliderThumb>` (single) or `matSliderStartThumb` + `matSliderEndThumb`
(range); `discrete` + `step` + `showTickMarks` for discrete values.

- Each thumb input needs an accessible name (`aria-label` or associated label); for ranges "Minimum
  price" / "Maximum price".
- Provide a text input alternative for precise values; dragging needs a non-drag alternative (WCAG 2.5.7):
  arrow keys work, and clicking the track moves the thumb.
- Harness: `MatSliderHarness`.

### Date and time pickers

| MD3 | Angular | Harness |
|---|---|---|
| Docked date picker | `input[matInput][matDatepicker]` + `mat-datepicker-toggle` + `mat-datepicker` | `MatDatepickerInputHarness` |
| Modal date picker | same with `touchUi` (compact) | `MatDatepickerInputHarness` |
| Date range | `mat-date-range-input` (`matStartDate`, `matEndDate`) + `mat-date-range-picker` | `MatDateRangeInputHarness` |
| Time picker | `input[matInput][matTimepicker]` + `mat-timepicker-toggle` + `mat-timepicker` | `MatTimepickerInputHarness` |

- Provide a date adapter (`provideNativeDateAdapter()` or a library adapter) and locale.
- Typing the date must work; the calendar is an aid. Show the expected format in `mat-hint`.
- Density doesn't apply to pop-up pickers (by design).

### Menus

`mat-menu` + `[matMenuTriggerFor]` on a button. MD3: temporary list of choices or actions on a surface at
level 2. Use for overflow actions ("More"), sort options, a split-button dropdown, a FAB menu.

- Trigger has a name ("More actions"); Material sets `aria-haspopup`/`aria-expanded` and arrow-key
  navigation; nested menus via `[matMenuTriggerFor]` on a `mat-menu-item`.
- Destructive items get a confirmation, not error coloring alone.
- Right-click menus (`[matContextMenuTriggerFor]`) must have a keyboard-reachable alternative.
- Harnesses: `MatMenuHarness`, `MatContextMenuHarness`.

## Navigation

See [layout-and-navigation.md](layout-and-navigation.md) for selection by window size and gap components.

| MD3 | Angular | Harness |
|---|---|---|
| Top app bar | `mat-toolbar` (+ `mat-toolbar-row`) | `MatToolbarHarness` |
| Navigation drawer | `mat-sidenav` + `mat-nav-list` | `MatSidenavHarness`, `MatNavListHarness` |
| Navigation rail, navigation bar | Gap: `src/shared/ui/` | Role queries + keyboard journey |
| Tabs | `mat-tab-group` (same URL); route tabs are a `nav` with router links, not `mat-tab-nav-bar` (UI-22) | `MatTabGroupHarness`; route tabs by role `link` and `aria-current` |
| Search | Gap: `mat-form-field` + `matAutocomplete`, or Angular Aria combobox | `MatAutocompleteHarness` |
| Stepper (MD2 pattern, still useful) | `mat-stepper` (`linear`, `orientation` by window size) | `MatStepperHarness` |
| Paginator | `mat-paginator` | `MatPaginatorHarness` |

Search: a search field gets `role="search"` on its container (or a `<search>` element), a visible or
`aria-label` name, and results announced (count in a live region).

## Data display

### Lists

| Need | Angular | Harness |
|---|---|---|
| Static items (one to three lines) | `mat-list` + `mat-list-item` (`matListItemTitle`, `matListItemLine`, `matListItemIcon`, `matListItemAvatar`, `matListItemMeta`) | `MatListHarness` |
| Navigation links | `mat-nav-list` + `a[mat-list-item]` | `MatNavListHarness` |
| Actions | `mat-action-list` + `button[mat-list-item]` | `MatActionListHarness` |
| Selection | `mat-selection-list` + `mat-list-option` | `MatSelectionListHarness` |

- MD3: one-line (56 px), two-line (72 px), three-line (88 px); leading icon/avatar/image, trailing
  metadata or a control. Keep one primary action per item.
- A row that is a link must not also contain buttons inside the link; put secondary actions in
  `matListItemMeta` as siblings or in an overflow menu.
- Use `mat-subheader` for groups (`role="heading"` / real heading when it structures content).

### Tables

`mat-table` (`[dataSource]`, `matColumnDef`, `mat-header-row`, `mat-row`) + `matSort` + `mat-paginator`.

- Desktop-focused views may use density −1/−2 (NG-UI-08; record the AAA deviation if targets go below
  44 px).
- Sort headers announce state; give the table a caption (`<caption>` or `aria-label`).
- On compact, switch to a list or cards rather than horizontal scrolling of a 10-column table; if it must
  scroll, wrap it in a focusable region with a label.
- Harnesses: `MatTableHarness`, `MatSortHarness`, `MatPaginatorHarness`.

### Tree, grid list, icons

- `mat-tree` (`MatTreeHarness`): hierarchical data; follows the APG tree pattern.
- `mat-grid-list` (`MatGridListHarness`): fixed tile grid; prefer CSS grid (feed layout) for responsive
  content.
- `mat-icon` (`MatIconHarness`): decorative by default (`aria-hidden="true"`); for a meaningful standalone
  icon set `aria-hidden="false"` and an `aria-label`, or add visually hidden text. Use one icon set
  (Material Symbols) consistently, filled for active and outlined for inactive navigation states.
