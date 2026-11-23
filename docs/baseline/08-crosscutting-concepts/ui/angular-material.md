# Angular UI: Angular Material and Material Design 3

Our Angular apps use **Angular Material** (material.angular.dev) and the CDK as their component library, and follow the **Material Design 3** guidelines (m3.material.io) for layout, color, typography and interaction. The `angular-material-design` skill (our adaptation) maps Material Design concepts to Angular Material APIs and follows these rules.

Implements: [10-quality-requirements/accessibility.md](../../10-quality-requirements/accessibility.md) for the UI layer and the framework-neutral [ui-patterns.md](ui-patterns.md) (`UI-*`). The NG-UI rules on layout, responsiveness and screen readers keep their IDs and add only the Angular mechanism to the UI rule they cite.

## Rules

### Components

- **NG-UI-01: Use an Angular Material component when one exists for the job.** Don't build a custom button, select, dialog, menu, table or date picker.
  *Why:* Material components come with keyboard support, ARIA and test harnesses; custom widgets have to earn all of that (A11Y-08).
- **NG-UI-02: Material Design patterns that Angular Material doesn't ship are built as a shared component in `src/shared/ui/`** (navigation rail, bottom navigation bar, search bar, carousel, split button, FAB menu): from CDK or Angular Aria primitives, styled only with system tokens, following the matching WAI-ARIA pattern, with a keyboard journey test (A11Y layer L5).
- **NG-UI-03: Never style Angular Material internals** (`.mdc-*`, `.mat-mdc-*` selectors, `::ng-deep`). Customize through the theme and the per-component override mixins (`mat.<component>-overrides(...)`).
  *Why:* internal class names change between versions; override APIs are supported.

### Theme and tokens

- **NG-UI-04: One global theme**, defined with `mat.theme(...)` in `src/styles/theme.scss`: color (custom palettes generated with `ng generate @angular/material:theme-color`), typography, density. Light and dark come from the same theme via `color-scheme: light dark`.
- **NG-UI-05: Own styles use the system tokens only**: `var(--mat-sys-primary)`, `var(--mat-sys-surface-container)`, `font: var(--mat-sys-body-large)`, `border-radius: var(--mat-sys-corner-medium)`, `box-shadow: var(--mat-sys-level2)`. No hard-coded colors, font sizes, radii or shadows in component styles. Angular Material emits no spacing or motion tokens, so the app defines its own `--app-space-*` and `--app-motion-*` / `--app-easing-*` custom properties once, next to the theme (NG-UI-11), with the Material Design 3 values. Semantic product colours the design needs and Material has no role for (warning, success, chart series, a project palette) form one `--app-color-*` family, defined once next to the theme with a light, dark and high-contrast value each and contrast-checked like the system roles; components never define colours of their own. Those are the only other allowed tokens. A value computed at runtime (a fill width, a chart offset) reaches the stylesheet through a host-bound custom property (`host: { '[style.--usage-fill]': 'fill()' }`, used as `inline-size: var(--usage-fill)`), never a style binding in the template.
  *Why:* themes, dark mode and high contrast then work everywhere without extra code.
- **NG-UI-06: Color roles are used as Material Design defines them**: `on-X` text only on `X` surfaces, containers for emphasis, `error` only for errors. A color never carries meaning alone (WCAG 1.4.1).
- **NG-UI-07: A high-contrast variant is provided** (the theme-color schematic's high-contrast overrides) for `prefers-contrast: more`. The prebuilt palettes (`mat.$azure-palette`, …) ship no high-contrast overrides, so generate the palette with the schematic even when using a prebuilt seed color. If the default theme doesn't reach 7:1 text contrast (adopted AAA criterion 1.4.6), adjust the palette or document the deviation in the project's conformance notes (A11Y-02). Own components that show a state only by background, shadow or tint add a `@media (forced-colors: active)` rule with system colors (`CanvasText`, `Highlight`) (A11Y-28). So does a panel with a fixed foreground colour on a fixed background (a hero on a dark token), because the browser drops the background in forced colours; native elements styled through vendor pseudo-elements (`<progress>`) get `appearance: auto` there.
- **NG-UI-08: Density 0 is the default.** Lower density only for desktop-focused data-dense views (tables, toolbars), never below the point where targets stay ≥ 24 × 24 px (WCAG 2.5.8); targets below 44 × 44 px are a documented AAA deviation (A11Y-10).

### Layout and navigation

- **NG-UI-09 (implements UI-01): Size classes in Angular** come from CSS grid/flex, CSS container queries or the CDK `BreakpointObserver` with **custom queries** for the UI-01 breakpoints. The CDK `Breakpoints` presets (600/960/1280/1920) don't match the Material Design 3 classes and are not used. No Tailwind, no layout libraries.
- **NG-UI-10 (implements UI-02): Navigation changes with the window size:** the navigation bar or a modal `mat-sidenav` on compact, the navigation rail gap component (NG-UI-02) on medium, and the rail or a standard `mat-sidenav` on expanded and larger.
- **NG-UI-11 (implements UI-03): Spacing custom properties** (`--app-space-*`) are defined once in `src/styles/theme.scss`, next to the theme (NG-UI-05).

### Content and interaction

- **NG-UI-12: Form fields always have a visible `mat-label`**; placeholders are hints, not labels. Errors use `mat-error`, are specific (WCAG 3.3.3), and don't rely on color. Don't ask for data the user already entered in the same process (WCAG 3.3.7).
- **NG-UI-13: Icon-only buttons have an accessible name** (`aria-label`); decorative icons stay hidden from assistive technology (the `mat-icon` default).
- **NG-UI-14: Dialogs use `MatDialog`** with a `mat-dialog-title`; focus moves into the dialog and returns to the trigger on close (NG-UI-33).
- **NG-UI-15: Motion respects `prefers-reduced-motion`** (adopted AAA criterion 2.3.3): Angular Material switches its own animations off when `prefers-reduced-motion` matches (and can be switched off explicitly with the `MATERIAL_ANIMATIONS` token, `{ animationsDisabled: true }`); custom transitions must do the same with a `prefers-reduced-motion` media query. Material Design 3 Expressive is not supported by Angular Material; don't emulate it by restyling Material internals (NG-UI-03).
- **NG-UI-16: Typography uses the type-scale roles** (`display`, `headline`, `title`, `body`, `label` in large/medium/small) through the system tokens; heading levels (`h1`–`h6`) follow document structure, not size. Type doesn't scale with the viewport (no `clamp()` or `vw` font sizes); responsiveness comes from layout, and text scales through the user's browser settings.

### Tests

- **NG-UI-17: Tests interact with Material composite widgets through their harnesses** (`MatSelectHarness`, `MatDatepickerInputHarness`, `MatTableHarness`, …); everything else through Testing Library role queries ([08-crosscutting-concepts/testing/angular.md](../testing/angular.md)).
- **NG-UI-18: Every theme variant is scanned:** light, dark and high contrast, plus forced colors on the shell, through the theme projects of [TS-TEST-28](../testing/typescript-e2e.md#matrix) (A11Y-09, A11Y-28). Scans per viewport: A11Y-17.
- Responsive structure and layout are tested as described in NG-TEST-09..11 and [TS-TEST-17..21](../testing/typescript-e2e.md) (UI-01..14).

### Responsive layout

The responsive rules are framework-neutral ([ui-patterns.md](ui-patterns.md)); these add the Angular mechanism.

- **NG-UI-19 (implements UI-04): `WindowSize` is an abstract class in `src/shared/ui/layout` used as the DI token.** The implementation behind it derives the size class from custom `BreakpointObserver` queries, so component tests can stub it (NG-TEST-09). It is never injected into use cases or stores.
- **NG-UI-20 (implements UI-05): Every size class calls the same use cases** through the same store or `resource()`; no `resource()` or store method depends on `WindowSize` (NG-ARCH-15).
- **NG-UI-21 (implements UI-06): `WindowSize` is for structure only** (rail vs drawer, one vs two panes, `MatDialog` vs `MatBottomSheet`); columns, gaps and pane widths are CSS in the component's styles.
- **NG-UI-22 (implements UI-07): Reusable `shared/ui` components set `container-type: inline-size`** on their host (`:host`) and use `@container` queries. They never place themselves in a grid (`grid-column: span 2` on a card): the page's grid places them, because a span in a one-column grid opens an implicit column and shrinks every inline-size container beside it.
- **NG-UI-23 (implements UI-08): The layout statement for compact, medium and expanded** sits in the screen's spec or story.
- **NG-UI-24 (implements UI-09): Component styles (`.scss`) use logical properties and `rem`**; Angular Material's own styles already do.
- **NG-UI-25 (implements UI-10): Tables (`mat-table`) that can't reflow** scroll inside their own region or switch to a `mat-list` or card form on compact; content images use `NgOptimizedImage` with `sizes`.
- **NG-UI-26 (implements UI-11): `index.html`** carries `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`; fixed bars pad with `env(safe-area-inset-*)`, full-height panes use `dvh`.
- **NG-UI-27 (implements UI-12): Row and card actions shown on hover** are also in a `mat-menu` or always visible on touch; hover styling sits in `@media (hover: hover)`.
- **NG-UI-28 (implements UI-13): `matInput` fields set `type`, `autocomplete` and `inputmode`**, and `mat-form-field` is full width on compact.
- **NG-UI-29 (implements UI-14): Print** is out of scope unless an ADR adds it with a print stylesheet in `src/styles/` and its E2E test.

### Screen readers

- **NG-UI-30 (implements UI-15): `Announcer` is an abstract class in `src/shared/ui/a11y` used as the DI token**, whose implementation wraps the CDK `LiveAnnouncer`. Field errors use `mat-error`. Tests mock it (NG-TEST-12). The CDK announcer's delayed clear-and-write works around repeated-message bugs in screen readers; don't "fix" it.
- **NG-UI-31 (implements UI-16): Route title and focus in Angular:** every route defines a `title` (static or `ResolveFn`) and the app provides one `TitleStrategy` ("Page | App"). The `RouteFocus` service in `src/platform/adapter/in/ui`, started once by the shell, listens to `NavigationEnd` and waits for the heading with `afterNextRender`, not with timers. It skips navigations whose extras carry `replaceUrl` or `state: { keepFocus: true }`: a page that canonicalises its own URL navigates with `replaceUrl: true`, and an in-page pager of the same route (`/week/:date`) navigates with `state: { keepFocus: true }` and announces the new period (A11Y-21). Scroll restoration: `withInMemoryScrolling({ scrollPositionRestoration: 'enabled' })`. Navigation links set `ariaCurrentWhenActive="page"`.
  *Why:* the Angular router manages neither focus nor announcements.
- **NG-UI-32 (implements UI-17): Snackbars (`MatSnackBar`) with an action have no `duration`.** Content loaded by `@defer` or lazy routes announces its completion; every `mat-progress-spinner`, `mat-progress-bar` and `mat-table` has an accessible label.
- **NG-UI-33 (implements UI-18, extends NG-UI-14): Dialogs set their label through `mat-dialog-title`** (`ariaLabelledBy`), and when the trigger may disappear (opened from a menu, row deleted), focus is restored explicitly in `afterClosed()`.
  *Why:* Material restores focus only if the trigger element still exists.
- **NG-UI-36: Date inputs use `provideDateFnsAdapter` with parse formats for every supported locale**, never the native date adapter: `NativeDateAdapter` reads only what `Date.parse` understands, so `5.11.2026` silently becomes no date. `MAT_DATE_FORMATS` lists the locale's short forms (`d.M.yyyy`, `dd.MM.yyyy` for `de`) plus ISO `yyyy-MM-dd` for parsing; `MAT_DATE_LOCALE` follows the active language (NG-I18N). A harness test types a date in each locale's format.
- **NG-UI-37: A button or form control that stays focusable while unavailable uses Material's input, `[disabled]` with `disabledInteractive` or `[aria-disabled]`, never `[attr.aria-disabled]`.** The attribute binding sets the ARIA attribute but not the input Material styles by, so the button looks enabled. On a checkbox, radio or select the attribute is worse: the control stays operable, the user changes the value and the code silently ignores it. An unavailable form control is `mat-checkbox`/`mat-select` with `[disabled]` and `disabledInteractive` plus a visible reason (its hint), or it stays enabled and the rule that refuses the value is shown as a field error (A11Y-22).
- **NG-UI-35 (implements UI-19): The shared loading, empty and error components in `src/shared/ui`** use a labelled `mat-progress-bar` or spinner for loading and a `matButton` for the next action or retry; each state is announced through NG-UI-30.

### Fonts and icons

- **NG-UI-34: Fonts and icon fonts are self-hosted with the app.** Roboto / Roboto Flex (or the font the product's design names) and Material Symbols come from npm packages (`@fontsource/*`) or files in `public/`, referenced from `src/styles/`. No Google Fonts `<link>` in `index.html` (remove the one `ng add @angular/material` may add) and no CLI font inlining (`optimization.fonts.inline`), which still loads the font files from Google. `font-src` stays `'self'` (NG-SEC-05).
  *Why:* every third-party request transmits the user's IP address to a processor ([DP-PROC-03](../data-protection/data-protection.md)); self-hosting also keeps the CSP strict.

## Skill overrides

| Skill | Says | Our rule |
|---|---|---|
| `angular-new-app` / `angular-developer` | Add Tailwind (`ng add tailwindcss`), Tailwind reference | No Tailwind (NG-UI-09) |
| `angular-developer` | Angular Aria for Accordion, Listbox, Menu, Tabs, … | Material component first; Angular Aria/CDK only for gaps (NG-UI-01/02) |
| `accessibility` | Hand-rolled live-region announcer; `role="alert"` nested inside an `aria-live` field wrapper; Lighthouse as the automated check | CDK `LiveAnnouncer` behind the app `Announcer` (NG-UI-30); `mat-error` already handles field errors (NG-UI-12); axe fixture ([TS-TEST-12](../testing/typescript.md)) |
| Angular Material docs, `angular-material-design` (upstream habit) | Route tabs with `nav[mat-tab-nav-bar]` + `a[mat-tab-link]` | A plain `nav` with router links and `ariaCurrentWhenActive="page"`, styled like tabs: `mat-tab-nav-bar` gives the links `role="tab"`, which UI-22 forbids for navigation |
| Angular Material docs | "Prefer a native `<select>` over `MatSelect`" for accessibility | Material first (NG-UI-01); `MatSelect` follows the ARIA combobox pattern |
| `material-3` (original, not installed) | `@material/web` elements and `--md-sys-*` tokens; Compose and Flutter code | Angular Material components and `--mat-sys-*` tokens; replaced by our `angular-material-design` skill |

*Agent checklist in [checklists/angular.md](../../checklists/angular.md) and sources in [sources.md](../../sources.md), section "Angular UI: Angular Material and Material Design 3".*
