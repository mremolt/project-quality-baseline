---
name: angular-material-design
description: >
  Maps Material Design 3 (M3 / MD3 / Material You) concepts onto Angular Material and our baseline
  rules (docs/baseline/08-crosscutting-concepts/ui/angular-material.md, NG-UI-*; docs/baseline/10-quality-requirements/accessibility.md, A11Y-*). Use when
  working with Angular Material or mat- components (matButton, mat-sidenav, mat-toolbar, mat-tab-group,
  MatDialog, chips, lists, cards, pickers), when theming an Angular app (mat.theme, palettes, the
  theme-color schematic, dark mode, high contrast, density, mat.<component>-overrides), when styling with
  --mat-sys tokens (color roles, type scale, corners, elevation), when building responsive layout and
  navigation (window size classes, canonical layouts, sidenav, navigation rail, bottom navigation bar),
  or when running an MD3 compliance audit of an Angular app.
metadata:
  upstream-repo: hamen/material-3-skill
  upstream-path: skills/material-3
  upstream-commit: 14385f2bf3804d8779f8b4db2604211f1e70b4c1
  license: MIT (adapted; see LICENSE.upstream)
---

# Angular Material Design

Material Design 3 (m3.material.io) defines **what** a UI should look and behave like. Angular Material
(material.angular.dev) is **how** we build it in Angular. This skill translates between the two.

## Baseline rules first

Before writing any UI code, read **`docs/baseline/08-crosscutting-concepts/ui/ui-patterns.md`** (framework-neutral rules UI-*), **`docs/baseline/08-crosscutting-concepts/ui/angular-material.md`** (rules NG-UI-*) and
**`docs/baseline/10-quality-requirements/accessibility.md`** (A11Y-*, WCAG 2.2 AA + adopted AAA set). Folder layout
comes from `docs/baseline/05-building-block-view/typescript.md`: feature UI lives in
`src/features/<feature>/adapter/in/ui/`, shared presentational components and stateless UI services
(`WindowSize`, `Announcer`, `ColorScheme`) in `src/shared/ui/` (no feature or business logic, TS-ARCH-11).

- **The docs win.** If this skill, another skill, or MD3 guidance disagrees with them, follow the docs.
- **Cite rule ids** (`NG-UI-05`, `A11Y-10`) in reviews and PR text instead of restating rules.
- **Never** weaken an architecture or accessibility test to get a green build (A11Y-04). Raise it.
- A deviation (e.g. density below 0 on a data table) is proposed explicitly and recorded, not slipped in.

Most often missed: NG-UI-02 (gap components with a keyboard test), NG-UI-03 (no internal styling),
NG-UI-07 / 18 (high contrast and axe per theme), NG-UI-08 (density and target size).

## Philosophy

MD3 has three principles; here is what each means for an Angular Material app.

- **Personal**: color schemes are generated from a seed color into tonal palettes. In Angular this happens
  **at build time** (`mat.$<name>-palette` or the `theme-color` schematic). There is no OS wallpaper color
  on the web.
- **Adaptive**: layouts change across five window size classes. Navigation changes form (bar → rail →
  drawer); content changes from one pane to two or three.
- **Expressive**: shape, motion and emphasis. Angular Material implements **baseline M3**, not
  M3 Expressive (see [M3 Expressive](#m3-expressive)). Don't fake Expressive by styling internals.

Accessibility is not a fourth principle we may trade off: tonal pairing gives a contrast baseline, but
WCAG conformance is asserted by tests (A11Y-03), not assumed from the palette.

## Decision tree

```
What are you doing?
├── Setting up / changing the theme       → references/color-and-theming.md
├── Styling an own component              → "Token system" below (NG-UI-05)
├── Picking a component                   → "Component quick reference" below → references/component-catalog.md
│   └── No Angular Material equivalent?   → "Gap components" below (NG-UI-02)
├── App shell / navigation / breakpoints  → "Common patterns" + references/layout-and-navigation.md
├── Forms                                 → "Form layout" below + component-catalog.md § Input
├── Status messages, route focus/title, form-error and dialog focus, screen reader tests → references/screen-readers.md
├── Type, corners, elevation, motion      → references/typography-shape-motion.md
└── Reviewing an app against MD3          → "MD3 compliance audit" below
```

## Token system (`--mat-sys-*`)

`mat.theme` emits CSS custom properties prefixed `--mat-sys-`. MD3's `md.sys.color.primary` becomes
`--mat-sys-primary` (no `color-` segment), `md.sys.typescale.body-large` becomes `--mat-sys-body-large`,
`md.sys.shape.corner.medium` becomes `--mat-sys-corner-medium`, `md.sys.elevation.level2` becomes
`--mat-sys-level2`. Never use `--md-sys-*` names; they come from `@material/web` and are not defined in our
apps.

### Color roles

| MD3 role | Token | Use for |
|---|---|---|
| Primary / On primary | `--mat-sys-primary` / `--mat-sys-on-primary` | Highest-emphasis fills (filled button, active indicator) and their content |
| Primary container / On … | `--mat-sys-primary-container` / `--mat-sys-on-primary-container` | Standout containers (FAB, highlighted banner) |
| Secondary (+ container) | `--mat-sys-secondary`, `--mat-sys-secondary-container`, `on-` pairs | Less prominent accents: tonal buttons, selected nav item, filter chips |
| Tertiary (+ container) | `--mat-sys-tertiary`, `--mat-sys-tertiary-container`, `on-` pairs | Contrasting accents that balance primary and secondary |
| Error (+ container) | `--mat-sys-error`, `--mat-sys-error-container`, `on-` pairs | Errors **only** (NG-UI-06) |
| Surface / On surface | `--mat-sys-surface` / `--mat-sys-on-surface` | Page background and default text |
| On surface variant | `--mat-sys-on-surface-variant` | Lower-emphasis text and icons (check contrast, A11Y-09) |
| Surface containers | `--mat-sys-surface-container-lowest` … `-low`, `-container`, `-high`, `-highest` | Layered regions: cards, panes, nav areas |
| Surface dim / bright | `--mat-sys-surface-dim`, `--mat-sys-surface-bright` | Surfaces that keep relative brightness across light and dark |
| Inverse | `--mat-sys-inverse-surface`, `--mat-sys-inverse-on-surface`, `--mat-sys-inverse-primary` | Elements that contrast with the UI (snackbars) |
| Outline | `--mat-sys-outline` | Important boundaries that need 3:1 (field borders, focus-relevant edges) |
| Outline variant | `--mat-sys-outline-variant` | Decorative separation (dividers, card borders) |
| Fixed accents | `--mat-sys-primary-fixed`, `-fixed-dim`, `--mat-sys-on-primary-fixed`, `-variant` (also secondary, tertiary) | Same color in light and dark; use sparingly, check contrast |
| Scrim / shadow | `--mat-sys-scrim`, `--mat-sys-shadow` | Modal backdrops, shadow color |

Pairing rule: `on-X` text and icons only on `X` fills. Full pairing table and tonal mapping:
[references/color-and-theming.md](references/color-and-theming.md).

### Type scale

15 roles: `display`, `headline`, `title`, `body`, `label` × `large` / `medium` / `small`.

```scss
.page-title {
  font: var(--mat-sys-headline-medium);
  letter-spacing: var(--mat-sys-headline-medium-tracking);
}
```

`font` shorthand tokens don't carry letter-spacing; add the `-tracking` token. Sub-tokens exist per role:
`-font`, `-size`, `-weight`, `-line-height`, `-tracking`. Heading **levels** follow document structure,
not size (NG-UI-16). MD3 "emphasized" type styles are not exposed as system tokens (see the typography
reference).

### Shape (corners)

`--mat-sys-corner-none` 0, `-extra-small` 4px (snackbar), `-small` 8px (chips, menus, fields), `-medium`
12px (cards), `-large` 16px (FAB, drawer, panes), `-extra-large` 28px (dialogs, sheets), `-full` 9999px
(buttons, badges, pills).

Partial variants: `--mat-sys-corner-extra-small-top`, `-large-top`, `-large-start`, `-large-end`,
`-extra-large-top`. Expressive corners (`large-increased`, `extra-extra-large`) have no token.

### Elevation

`--mat-sys-level0` … `--mat-sys-level5`: level 0 most components at rest, 1 elevated card / modal
sheet, 2 menus / scrolled app bar / navigation bar, 3 FAB / dialogs / pickers, 4–5 hover and focus only.
Tonal equivalents: surface, surface-container-low, -container, -high, -highest.

The `--mat-sys-levelN` tokens are **box-shadow values**. MD3 expresses depth primarily through
**tonal surfaces**; use the surface-container role first and a shadow only where a component floats over
busy content.

### Motion and state

Angular Material emits **no motion system variables** (checked against angular/components main,
2026-11-20). MD3 easing and duration values live in
[references/typography-shape-motion.md](references/typography-shape-motion.md); define them once as
app custom properties next to the theme (same approach as spacing, NG-UI-11). State-layer opacities are
tokens: `--mat-sys-hover-state-layer-opacity` (0.08), `--mat-sys-focus-state-layer-opacity` (0.12),
`--mat-sys-pressed-state-layer-opacity` (0.12), `--mat-sys-dragged-state-layer-opacity` (0.16).

Material components skip their animations when the user prefers reduced motion. Your own transitions must
do the same (NG-UI-15).

## Component quick reference

Import standalone (`MatButtonModule`, `MatSidenavModule`, …) in the component's `imports`. Harnesses come
from `@angular/material/<component>/testing` (NG-UI-17).

| MD3 component | Angular Material | Harness |
|---|---|---|
| Filled / tonal / outlined / elevated / text button | `<button matButton="filled">`, `"tonal"`, `"outlined"`, `"elevated"`, `matButton` (text) | `MatButtonHarness` |
| Icon button | `<button matIconButton aria-label="…">` | `MatButtonHarness` |
| FAB / small FAB / extended FAB | `matFab`, `matMiniFab`, `matFab extended` | `MatButtonHarness` |
| Segmented button | `mat-button-toggle-group` (single or `multiple`) | `MatButtonToggleGroupHarness` |
| Badge | `matBadge` | `MatBadgeHarness` |
| Progress indicator | `mat-progress-bar`, `mat-progress-spinner`; `showProgress` on buttons | `MatProgressBarHarness`, `MatProgressSpinnerHarness` |
| Snackbar | `MatSnackBar` service | `MatSnackBarHarness` |
| Tooltip (plain) | `matTooltip` | `MatTooltipHarness` |
| Card (elevated / filled / outlined) | `mat-card` with `appearance="raised"` / `"filled"` / `"outlined"` | `MatCardHarness` |
| Dialog (basic, full-screen) | `MatDialog` + `mat-dialog-title` / `-content` / `-actions` | `MatDialogHarness` |
| Bottom sheet (modal) | `MatBottomSheet` | `MatBottomSheetHarness` |
| Side sheet | `mat-sidenav` / `mat-drawer` with `position="end"` | `MatSidenavHarness`, `MatDrawerHarness` |
| Divider | `mat-divider` | `MatDividerHarness` |
| Checkbox / radio / switch | `mat-checkbox`, `mat-radio-group` + `mat-radio-button`, `mat-slide-toggle` | `MatCheckboxHarness`, `MatRadioGroupHarness`, `MatSlideToggleHarness` |
| Chips (assist, filter, input, suggestion) | `mat-chip-set` / `mat-chip`, `mat-chip-listbox` / `mat-chip-option`, `mat-chip-grid` / `mat-chip-row` | `MatChipSetHarness`, `MatChipListboxHarness`, `MatChipGridHarness` |
| Text field (filled / outlined) | `mat-form-field` (`appearance="fill"` / `"outline"`) + `matInput`, `mat-label`, `mat-hint`, `mat-error` | `MatFormFieldHarness`, `MatInputHarness` |
| Menu / context menu | `mat-menu` + `[matMenuTriggerFor]`; right-click: `[matContextMenuTriggerFor]` | `MatMenuHarness`, `MatContextMenuHarness` |
| Select / autocomplete | `mat-select`, `matAutocomplete` | `MatSelectHarness`, `MatAutocompleteHarness` |
| Slider | `mat-slider` + `matSliderThumb` / `matSliderStartThumb` + `matSliderEndThumb` | `MatSliderHarness` |
| Date picker (docked, modal, range) | `mat-datepicker`, `mat-date-range-input` + `mat-date-range-picker` (`touchUi` for modal) | `MatDatepickerInputHarness`, `MatDateRangeInputHarness` |
| Time picker | `mat-timepicker` + `[matTimepicker]` input | `MatTimepickerInputHarness`, `MatTimepickerHarness` |
| Top app bar | `mat-toolbar` (title as heading, actions as icon buttons) | `MatToolbarHarness` |
| Navigation drawer (standard / modal) | `mat-sidenav` `mode="side"` / `mode="over"` + `mat-nav-list` | `MatSidenavHarness`, `MatNavListHarness` |
| Tabs (content) | `mat-tab-group` + `mat-tab` | `MatTabGroupHarness` |
| Tabs (routes) | `nav` + `a[routerLink]` with `ariaCurrentWhenActive="page"`, styled like tabs; not `mat-tab-nav-bar` (its `role="tab"` breaks UI-22) | `getByRole('link', { current: 'page' })` |
| List | `mat-list`, `mat-nav-list`, `mat-action-list`, `mat-selection-list` | `MatListHarness`, `MatNavListHarness`, … |
| Data table | `mat-table` + `matSort` + `mat-paginator` | `MatTableHarness`, `MatSortHarness`, `MatPaginatorHarness` |
| Expansion / accordion | `mat-expansion-panel`, `mat-accordion` | `MatExpansionPanelHarness`, `MatAccordionHarness` |
| Stepper | `mat-stepper` | `MatStepperHarness` |
| Tree | `mat-tree` | `MatTreeHarness` |
| Icon | `mat-icon` (decorative by default, `aria-hidden`) | `MatIconHarness` |

Usage guidance per component (when to use which variant, MD3 do's and don'ts, a11y notes):
[references/component-catalog.md](references/component-catalog.md).

### Gap components (NG-UI-02)

These MD3 components have **no** Angular Material equivalent. Build them once in `src/shared/ui/`, styled
only with system tokens, following the named WAI-ARIA pattern, with a keyboard journey test (A11Y-08, L5).

| MD3 component | Build from | WAI-ARIA pattern / semantics |
|---|---|---|
| Navigation rail | `<nav>` + `<a routerLink routerLinkActive ariaCurrentWhenActive="page">` | Navigation landmark with links (native semantics, A11Y-07) |
| Navigation bar (bottom) | Same as rail, laid out horizontally at the bottom | Navigation landmark with links |
| Search bar / search view | `mat-form-field` + `matAutocomplete`, or Angular Aria `ngCombobox` | Combobox |
| Carousel | Native scroll container + buttons; no auto-advance (or a pause control, WCAG 2.2.2) | Carousel (APG) |
| Split button | `matButton` + adjacent `matIconButton` with `[matMenuTriggerFor]` | Button + menu button |
| FAB menu | `matFab` with `[matMenuTriggerFor]` (or CDK menu) | Menu button |
| Button group (connected) | `mat-button-toggle-group` for selection; plain flex group of `matButton` for actions | Toolbar (Angular Aria `ngToolbar`) only when arrow-key navigation is wanted |
| Toolbar (floating / docked) | Angular Aria `ngToolbar` + `ngToolbarWidget` | Toolbar |
| Loading indicator (Expressive) | Use `mat-progress-spinner` | Progressbar |
| Rich tooltip | CDK Overlay anchored panel, dismissible, hoverable (WCAG 1.4.13) | Non-modal dialog or disclosure, not `role="tooltip"` with actions |

Nav rail and bottom bar are worked out in [references/layout-and-navigation.md](references/layout-and-navigation.md).

## Common patterns

Code follows our Angular conventions: standalone components, signals, built-in control flow (`@if`,
`@for`), `inject()`, suffixless file and class names (`app-shell.ts`, `AppShell`), OnPush.

### Theme file

`src/styles/theme.scss` holds the single `mat.theme` call with generated brand palettes,
`color-scheme: light dark`, `mat.strong-focus-indicators()` and the high-contrast overrides under
`@media (prefers-contrast: more)`. Full file: [references/color-and-theming.md](references/color-and-theming.md#brand-colors-the-theme-color-schematic).

### App shell with responsive navigation

Compact → modal drawer (or bottom bar), medium → rail, expanded+ → standard drawer (NG-UI-10).

```ts
// src/app/shell/app-shell.ts
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { NavRail } from '../../shared/ui/nav-rail/nav-rail';
import { WindowSize } from '../../shared/ui/layout/window-size';
import { NAV_DESTINATIONS } from './nav-destinations';

@Component({
  selector: 'app-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatSidenavModule,
    MatToolbarModule,
    NavRail,
  ],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppShell {
  private readonly windowSize = inject(WindowSize);

  protected readonly destinations = NAV_DESTINATIONS;
  protected readonly sizeClass = this.windowSize.sizeClass;
  protected readonly isWide = this.windowSize.atLeastExpanded;
  protected readonly drawerMode = computed(() => (this.isWide() ? 'side' : 'over'));
  protected readonly showRail = computed(() => this.sizeClass() === 'medium');
}
```

```html
<!-- src/app/shell/app-shell.html -->
<a class="skip-link" href="#main">Skip to content</a>
<mat-sidenav-container class="shell">
  <mat-sidenav #drawer [mode]="drawerMode()" [opened]="isWide()">
    <nav aria-label="Main">
      <mat-nav-list>
        @for (item of destinations; track item.path) {
          <a mat-list-item [routerLink]="item.path" routerLinkActive #rla="routerLinkActive"
             [activated]="rla.isActive" ariaCurrentWhenActive="page"
             (click)="isWide() || drawer.close()">
            <mat-icon matListItemIcon>{{ item.icon }}</mat-icon>
            <span matListItemTitle>{{ item.label }}</span>
          </a>
        }
      </mat-nav-list>
    </nav>
  </mat-sidenav>

  <mat-sidenav-content class="shell__content">
    @if (showRail()) {
      <app-nav-rail [destinations]="destinations" />
    }
    <div class="shell__main">
      <header>
        <mat-toolbar>
          @if (!isWide() && !showRail()) {
            <button matIconButton aria-label="Open navigation" (click)="drawer.open()">
              <mat-icon>menu</mat-icon>
            </button>
          }
          <span class="shell__title">Order desk</span>
        </mat-toolbar>
      </header>
      <main id="main" tabindex="-1" class="shell__body">
        <router-outlet />
      </main>
      <!-- a <footer> (contentinfo) only if the app has footer content (A11Y-23) -->
    </div>
  </mat-sidenav-content>
</mat-sidenav-container>
```

Landmarks (A11Y-23): `<header>` is the banner, the `<nav>` inside the drawer is the named main navigation
(label it on the `nav`, not on `mat-sidenav`), `<main>` holds the routed page. The shell also starts the
`RouteFocus` service once (NG-UI-31, code in [references/screen-readers.md](references/screen-readers.md)).

The stylesheet makes `.shell` `100dvh`, `.shell__content` a flex row (rail + main), and constrains
`.shell__body` to a readable max width with spacing tokens.

`WindowSize` and `NavRail` are in [references/layout-and-navigation.md](references/layout-and-navigation.md).
Drawer, rail and (optional) bottom bar show the same destinations in the same order (WCAG 3.2.3). For a
bottom navigation bar on compact instead of the modal drawer, see the same reference.

### Card grid

```html
<ul class="card-grid" role="list">
  @for (product of products(); track product.id) {
    <li>
      <mat-card appearance="outlined">
        <img mat-card-image [src]="product.imageUrl" [alt]="product.imageAlt" />
        <mat-card-header>
          <mat-card-title><h3>{{ product.name }}</h3></mat-card-title>
          <mat-card-subtitle>{{ product.category }}</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>{{ product.summary }}</mat-card-content>
        <mat-card-actions align="end">
          <a matButton [routerLink]="['/products', product.id]">Details</a>
          <button matButton="tonal" (click)="addToCart(product)">Add to cart</button>
        </mat-card-actions>
      </mat-card>
    </li>
  }
</ul>
```

```scss
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(18rem, 100%), 1fr));
  gap: var(--app-space-4);
  margin: 0;
  padding: 0;
  list-style: none;
}
```

One primary action per card at most; the whole card is not a click target when it also contains buttons
(nested interactive content).

### Form layout

```html
<form class="form" [formGroup]="form" (ngSubmit)="submit()">
  <mat-form-field appearance="outline">
    <mat-label>Full name</mat-label>
    <input matInput formControlName="name" autocomplete="name" required />
    @if (form.controls.name.hasError('required')) {
      <mat-error>Enter your full name.</mat-error>
    }
  </mat-form-field>

  <mat-form-field appearance="outline">
    <mat-label>Email</mat-label>
    <input matInput type="email" formControlName="email" autocomplete="email" required />
    <mat-hint>We send the order confirmation here.</mat-hint>
    @if (form.controls.email.hasError('email')) {
      <mat-error>Enter an email address like name@example.com.</mat-error>
    }
  </mat-form-field>

  <div class="form__actions">
    <button matButton type="button" (click)="cancel()">Cancel</button>
    <button matButton="filled" type="submit">Place order</button>
  </div>
</form>
```

`.form` is a flex column (`gap: var(--app-space-2)`, `max-width: 35rem`); `.form__actions` aligns the
buttons to the end, primary action last. Visible `mat-label` always, specific `mat-error`, `autocomplete` for personal data (WCAG 1.3.5), no
re-asking for data already entered (NG-UI-12). Signal forms work the same way with `mat-form-field`.

## Anti-patterns

- **Styling internals**: `.mat-mdc-button { … }`, `::ng-deep .mdc-*`. Use `mat.button-overrides(...)` or
  the theme (NG-UI-03).
- **Hard-coded values**: hex colors, `px` font sizes, raw radii and shadows in component styles. Use
  `--mat-sys-*` tokens (NG-UI-05).
- **`--md-sys-*` tokens or `@material/web` (`<md-*>`) elements** in an Angular Material app. Wrong library.
- **Mixing M2 and M3 theming** (`mat.m2-*`, `mat.define-light-theme`, prebuilt M2 CSS) in a new app.
- **Broken pairing**: `on-primary` text on `surface`, `primary` text on `primary-container`, error red for
  "delete" buttons that aren't errors (NG-UI-06).
- **`outline` for dividers / `outline-variant` for field borders**. Decorative vs. 3:1 boundaries.
- **Shadows everywhere**. MD3 uses tonal surfaces for depth; shadows are the exception.
- **Several `mat.theme` calls spread over components**. One theme file; scoped re-theming only for a
  deliberate context (NG-UI-04).
- **Density below 0 app-wide** to "fit more". Only for data-dense desktop views, targets ≥ 24 px (NG-UI-08).
- **Tailwind or a layout library** for responsiveness (NG-UI-09).
- **CDK `Breakpoints` presets as window size classes**. They use 600/960/1280/1920; MD3 uses
  600/840/1200/1600. Use your own queries.
- **Phone layout stretched to 1600 px**. Constrain reading width; use the space for panes.
- **Custom widget where Material has one** (own dropdown, own dialog) (NG-UI-01).
- **Icon-only button without `aria-label`**; `matTooltip` doesn't replace the accessible name (NG-UI-13).
- **Placeholder as label**, color-only error state (NG-UI-12, WCAG 1.4.1).
- **Auto-dismissing snackbar with an action** the user must reach (WCAG 2.2.1, 2.1.1).
- **Testing Material widgets via CSS classes** instead of harnesses (NG-UI-17).

## M3 Expressive

Angular Material implements baseline M3. As of 2026-11-20 the Expressive tracking issue
(angular/components#31206) is open with "needs: discussion"; emphasized type tokens
(angular/components#33557) are open too. So: no shape morphing, no spring motion, no expressive button
sizes, no expressive corner tokens. Button progress (`showProgress` + `progressIndicator` slot) is
available in current versions. Don't import third-party "expressive" add-ons that restyle `.mdc-*`
classes (NG-UI-03). Check material.angular.dev before claiming support for any Expressive feature.

## MD3 compliance audit

Run when asked to audit or review an Angular app against Material Design 3 and our rules.

### Procedure

1. **Identify the target**: source paths, a running URL, or both. For a URL, use browser tooling
   (Playwright) to inspect computed styles, `--mat-sys-*` values and resize through the size classes.
2. **Collect evidence** with the quick checks below; read `src/styles/theme.scss`, the app shell and two or
   three representative feature screens.
3. **Score each category 0–10** and cite rule ids for each finding:

| Category | What to check |
|---|---|
| Theme | Single `mat.theme` in `src/styles/theme.scss`; `color-scheme: light dark`; custom palettes from the schematic; no M2 APIs (NG-UI-04) |
| Color tokens | Only `--mat-sys-*` in own styles; correct pairing; `error` only for errors; color not the only signal (NG-UI-05/06) |
| Typography | Type-scale tokens, tracking added; headings follow structure (NG-UI-16) |
| Shape & elevation | Corner tokens; tonal surfaces before shadows; `--mat-sys-levelN` for shadows |
| Components | Material component used where one exists; correct variant by emphasis; gaps in `src/shared/ui` (NG-UI-01/02) |
| Customization | No `.mdc-*`, `.mat-mdc-*`, `::ng-deep`; overrides via `mat.<x>-overrides` (NG-UI-03) |
| Layout | Size classes 600/840/1200/1600; canonical layout per screen; readable max width; spacing grid (NG-UI-09/11) |
| Responsive | `WindowSize` only in the UI adapter, same data per size class; logical properties, `dvh`, safe areas; reflow at 320 px; no hover-only function; zoom not blocked (NG-UI-19..28, A11Y-13..16) |
| Navigation | Bar / rail / drawer by size; consistent order; consistent help location (NG-UI-10) |
| Motion | Own transitions honour `prefers-reduced-motion`; MD3 easing/duration (NG-UI-15) |
| Accessibility | Contrast per theme incl. high contrast and forced colors (A11Y-09, A11Y-28); targets ≥ 24 px, 44 px default (A11Y-10); focus visible and not obscured; labels, names, dialog focus (NG-UI-12..14, 33); status via visible region or `Announcer`, route title and focus on `h1`, snackbar/spinner/table labels, loading/empty/error states (NG-UI-30..32, 35, A11Y-20/21); WCAG 2.2 additions (A11Y-11) |
| Tests | Harnesses for Material widgets; axe per theme and per viewport; keyboard journeys for gap components; responsive E2E checks (NG-UI-17/18, A11Y-05/17, TS-TEST-17..21, 28); announcements, title/focus, form errors, ARIA snapshot (NG-TEST-12..14, TS-TEST-23..26) |

4. **Write the report**:

```
# MD3 Compliance Audit: <app>
Target: <paths / URL>   Date: <date>   Overall: <sum>/120

| Category | Score | Status | Rules |
|---|---|---|---|
| Theme | x/10 | pass/warn/fail | NG-UI-04 |
| … | | | |

## Critical (0–3)   file:line, rule id, fix
## Warnings (4–6)   recommendation
## Passing (7–10)   what's done well
## Fixes in priority order
```

Status: pass 7–10, warn 4–6, fail 0–3. Any **AA accessibility violation is critical** regardless of score
(A11Y-01, A11Y-03).

### Quick checks

```bash
# Hard-coded colors in component styles (theme files excluded)
grep -rnE '#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(' src --include='*.scss' --include='*.css' | grep -v 'src/styles/'

# Styling Material internals (NG-UI-03)
grep -rnE '\.mdc-|\.mat-mdc-|::ng-deep' src --include='*.scss' --include='*.css' --include='*.ts'

# Wrong token family or library
grep -rnE -- '--md-sys-|@material/web|@material/mdc-' src package.json

# M2 theming APIs in an M3 app
grep -rnE 'mat\.(m2-|define-(light|dark-)?theme|core\(\))' src --include='*.scss'

# More than one mat.theme call (scoped themes need a reason)
grep -rn 'mat.theme(' src --include='*.scss'

# Tailwind
grep -rnE 'tailwind' package.json src --include='*.css' --include='*.scss' --include='*.json'

# Icon-only buttons: check each for aria-label
grep -rnE 'matIconButton|matFab|matMiniFab' src --include='*.html'

# Raw font sizes / radii / shadows
grep -rnE 'font-size:|border-radius:|box-shadow:' src --include='*.scss' | grep -v 'var(--mat-sys-'
```

## Reference map

- [references/color-and-theming.md](references/color-and-theming.md): color roles, pairing, tonal
  palettes, `mat.theme`, theme-color schematic, light/dark, high contrast, scoped themes, overrides,
  runtime color
- [references/typography-shape-motion.md](references/typography-shape-motion.md): type scale, fonts,
  shape, elevation, motion values, reduced motion and disabling Material animations
- [references/layout-and-navigation.md](references/layout-and-navigation.md): window size classes,
  canonical layouts, `WindowSize` service, container queries, navigation selection, sidenav modes, nav rail
  and bottom bar
- [references/component-catalog.md](references/component-catalog.md): per MD3 category, when to use
  which component, Angular Material API, a11y notes, harness
- Rules: `docs/baseline/08-crosscutting-concepts/ui/angular-material.md`, `docs/baseline/10-quality-requirements/accessibility.md`,
  `docs/baseline/05-building-block-view/typescript.md`, `docs/baseline/08-crosscutting-concepts/testing/angular.md`
- External: material.angular.dev (API, Styling tabs list each component's override tokens),
  m3.material.io (design guidance)
