# Angular UI: Angular Material and Material Design 3

Our Angular apps use **Angular Material** (material.angular.dev) and the CDK as their component library, and follow the **Material Design 3** guidelines (m3.material.io) for layout, color, typography and interaction. The `angular-material-design` skill (our adaptation) maps Material Design concepts to Angular Material APIs and follows these rules.

Implements: [10-quality-requirements/accessibility.md](../../10-quality-requirements/accessibility.md) for the UI layer.

## Rules

### Components

- **NG-UI-01: Use an Angular Material component when one exists for the job.** Don't build a custom button, select, dialog, menu, table or date picker.
  *Why:* Material components come with keyboard support, ARIA and test harnesses; custom widgets have to earn all of that (A11Y-08).
- **NG-UI-02: For Material Design patterns that Angular Material doesn't ship** (navigation rail, bottom navigation bar, search bar, carousel, split button, FAB menu), build a shared component in `src/shared/ui/` from CDK or Angular Aria primitives, styled only with system tokens, following the matching WAI-ARIA pattern, with a keyboard journey test (A11Y layer L5).
- **NG-UI-03: Never style Angular Material internals** (`.mdc-*`, `.mat-mdc-*` selectors, `::ng-deep`). Customize through the theme and the per-component override mixins (`mat.<component>-overrides(...)`).
  *Why:* internal class names change between versions; override APIs are supported.

### Theme and tokens

- **NG-UI-04: One global theme**, defined with `mat.theme(...)` in `src/styles/theme.scss`: color (custom palettes generated with `ng generate @angular/material:theme-color`), typography, density. Light and dark come from the same theme via `color-scheme: light dark`.
- **NG-UI-05: Own styles use the system tokens only**: `var(--mat-sys-primary)`, `var(--mat-sys-surface-container)`, `font: var(--mat-sys-body-large)`, `border-radius: var(--mat-sys-corner-medium)`, `box-shadow: var(--mat-sys-level2)`. No hard-coded colors, font sizes, radii or shadows in component styles. Angular Material emits no spacing or motion tokens, so the app defines its own `--app-space-*` and `--app-motion-*` / `--app-easing-*` custom properties once, next to the theme (NG-UI-11), with the Material Design 3 values; those are the only other allowed tokens.
  *Why:* themes, dark mode and high contrast then work everywhere without extra code.
- **NG-UI-06: Color roles are used as Material Design defines them**: `on-X` text only on `X` surfaces, containers for emphasis, `error` only for errors. A color never carries meaning alone (WCAG 1.4.1).
- **NG-UI-07: A high-contrast variant is provided** (the theme-color schematic's high-contrast overrides) for `prefers-contrast: more`. The prebuilt palettes (`mat.$azure-palette`, …) ship no high-contrast overrides, so generate the palette with the schematic even when using a prebuilt seed color. If the default theme doesn't reach 7:1 text contrast (adopted AAA criterion 1.4.6), adjust the palette or document the deviation in the project's conformance notes (A11Y-02). Own components that show a state only by background, shadow or tint add a `@media (forced-colors: active)` rule with system colors (`CanvasText`, `Highlight`) (A11Y-28).
- **NG-UI-08: Density 0 is the default.** Lower density only for desktop-focused data-dense views (tables, toolbars), never below the point where targets stay ≥ 24 × 24 px (WCAG 2.5.8); targets below 44 × 44 px are a documented AAA deviation (A11Y-10).

### Layout and navigation

- **NG-UI-09: Layouts adapt to the Material Design window size classes** (compact < 600 px, medium 600–839, expanded 840–1199, large 1200–1599, extra-large ≥ 1600), with CSS grid/flex, CSS container queries or the CDK `BreakpointObserver` with **custom queries**. The CDK `Breakpoints` presets (600/960/1280/1920) don't match the Material Design 3 classes and are not used. No Tailwind, no layout libraries.
- **NG-UI-10: Navigation follows the window size**: compact → navigation bar (bottom) or modal drawer; medium → navigation rail; expanded and larger → rail or standard drawer (`mat-sidenav`). Navigation is consistent across pages (WCAG 3.2.3) and so is the help location (WCAG 3.2.6).
- **NG-UI-11: Spacing follows the 4/8 px grid**, via a small set of spacing custom properties defined once next to the theme.

### Content and interaction

- **NG-UI-12: Form fields always have a visible `mat-label`**; placeholders are hints, not labels. Errors use `mat-error`, are specific (WCAG 3.3.3), and don't rely on color. Don't ask for data the user already entered in the same process (WCAG 3.3.7).
- **NG-UI-13: Icon-only buttons have an accessible name** (`aria-label`); decorative icons stay hidden from assistive technology (the `mat-icon` default).
- **NG-UI-14: Dialogs use `MatDialog`** with a `mat-dialog-title`; focus moves into the dialog and returns to the trigger on close (NG-UI-33).
- **NG-UI-15: Motion respects `prefers-reduced-motion`** (adopted AAA criterion 2.3.3): Angular Material switches its own animations off when `prefers-reduced-motion` matches (and can be switched off explicitly with the `MATERIAL_ANIMATIONS` token, `{ animationsDisabled: true }`); custom transitions must do the same with a `prefers-reduced-motion` media query. Material Design 3 Expressive is not supported by Angular Material; don't emulate it by restyling Material internals (NG-UI-03).
- **NG-UI-16: Typography uses the type-scale roles** (`display`, `headline`, `title`, `body`, `label` in large/medium/small) through the system tokens; heading levels (`h1`–`h6`) follow document structure, not size. Type doesn't scale with the viewport (no `clamp()` or `vw` font sizes); responsiveness comes from layout, and text scales through the user's browser settings.

### Tests

- **NG-UI-17: Tests interact with Material composite widgets through their harnesses** (`MatSelectHarness`, `MatDatepickerInputHarness`, `MatTableHarness`, …); everything else through Testing Library role queries ([08-crosscutting-concepts/testing/angular.md](../testing/angular.md)).
- **NG-UI-18: Every theme variant is scanned:** light, dark and high contrast, plus forced colors on the shell, through the theme projects of [TS-TEST-28](../testing/typescript-e2e.md#matrix) (A11Y-09, A11Y-28). Scans per viewport: A11Y-17.
- Responsive structure and layout are tested as described in NG-TEST-09..11 and [TS-TEST-17..21](../testing/typescript-e2e.md).

### Responsive layout

- **NG-UI-19: Window size is UI-adapter state.** One `WindowSize` contract in `src/shared/ui/layout` (an abstract class used as the DI token, with the implementation that derives the size class from custom queries behind it, so component tests can stub it, NG-TEST-09). It is never imported by `domain`, `application` or `ports`, never passed into a use case or command, and stores don't read it.
  *Why:* layout is presentation; the dependency rule keeps it out of the inner rings ([04-solution-strategy/hexagonal-architecture.md](../../04-solution-strategy/hexagonal-architecture.md)).
- **NG-UI-20: Data loading doesn't depend on the size class.** Every size class calls the same use cases and gets the same data; layout hides or restructures, it doesn't fetch less or more.
  *Why:* no refetch on resize and no hidden extra requests (NG-ARCH-15); state survives a resize.
- **NG-UI-21: CSS first, TypeScript when the component tree changes.** Columns, gaps, pane widths and hiding decorative content use media or container queries. `WindowSize` is for structure only: rail vs drawer, one vs two panes, dialog vs bottom sheet.
  *Why:* least code, no flicker, nothing to keep in sync.
- **NG-UI-22: Shells and pages respond to the window; reusable `shared/ui` components respond to their container** (`container-type: inline-size`, `@container` queries).
  *Why:* a reusable component doesn't know where it is placed.
- **NG-UI-23: Every new screen states its layout for compact, medium and expanded** (canonical layout, navigation form, what moves where) in its spec or story; large and extra-large only when they differ.
  *Why:* makes the responsive decision explicit and reviewable.
- **NG-UI-24: Layout CSS uses logical properties** (`margin-inline`, `padding-block`, `inset-inline`, `text-align: start`) and `rem`, not physical left/right or px font sizes.
  *Why:* right-to-left languages and the user's text-size settings (WCAG 1.4.4) work without extra code.
- **NG-UI-25: Wide content never forces page-level horizontal scrolling.** Tables and code blocks scroll inside their own region (`role="region"`, `aria-label`, `tabindex="0"` so keyboard users can scroll it), or switch to a list or card form on compact. Images and media use `max-inline-size: 100%` and an `aspect-ratio` or `width`/`height`; content images use `NgOptimizedImage` with `sizes`.
  *Why:* reflow (A11Y-13) and no layout shift.
- **NG-UI-26: Full-height and fixed elements use dynamic viewport units and safe areas**: `dvh`, not `100vh`; `viewport-fit=cover` with `env(safe-area-inset-*)` padding for fixed bars. The viewport meta tag never disables zoom (no `user-scalable=no`, no `maximum-scale`).
  *Why:* mobile browser chrome, notches and rounded corners; zoom is required by WCAG 1.4.4.
- **NG-UI-27: Hover is an enhancement.** No function or content is reachable by hover only; hover-only styling sits in `@media (hover: hover)`; pointer gestures have a single-tap alternative (WCAG 2.5.1, 2.5.7).
  *Why:* touch devices have no hover.
- **NG-UI-28: Form inputs set `type`, `autocomplete` and `inputmode`**, and fields are full width on compact.
  *Why:* the right on-screen keyboard and autofill (WCAG 1.3.5).
- **NG-UI-29: Print is out of scope by default.** A product that needs printable views records that in an ADR and adds a print stylesheet with an E2E test using `page.emulateMedia({ media: 'print' })`.
  *Why:* most apps don't need it; when one does, it is a requirement with a test, not an accident.

### Screen readers

- **NG-UI-30: Status messages (A11Y-20) use a visible `role="status"` region or `mat-error` where possible; otherwise the app `Announcer`.** `Announcer` is a contract in `src/shared/ui/a11y` (abstract class as the DI token) whose implementation wraps the CDK `LiveAnnouncer`. No hand-rolled `aria-live` elements per component, no nested live regions, no `ariaNotify()` for now. Only UI adapters use it: stores expose state, the component announces on change, so the wording stays in the UI adapter.
  *Why:* one consistent mechanism that tests can mock (NG-TEST-12). The CDK announcer's delayed clear-and-write works around repeated-message bugs in screen readers; don't "fix" it.
- **NG-UI-31: Route title and focus (A11Y-21):** every route defines a `title` (static or `ResolveFn`) and the app provides one `TitleStrategy` ("Page | App"). One app-wide `RouteFocus` service in `src/platform/adapter/in/ui`, started once by the shell, listens to `NavigationEnd`: when the URL path (without query and fragment) differs from the previous one, it focuses the routed `h1` (`tabindex="-1"`), falling back to `main`, with `preventScroll: true`; it does nothing on the first navigation. It treats back/forward like any other navigation, so the router's scroll restoration (`withInMemoryScrolling({ scrollPositionRestoration: 'enabled' })`) keeps the position. It waits for the heading to render with `afterNextRender`, not with timers. Navigation links set `ariaCurrentWhenActive="page"`.
  *Why:* the Angular router manages neither focus nor announcements.
- **NG-UI-32: Snackbars are polite, short, and never the only place for an error or a required action;** a snackbar with an action has no `duration`. Content loaded by `@defer` or lazy routes announces its completion; every `mat-progress-spinner`, `mat-progress-bar` and `mat-table` has an accessible label.
  *Why:* Material's own accessibility guidance.
- **NG-UI-33 (extends NG-UI-14): Dialogs set their label through `mat-dialog-title`** (`ariaLabelledBy`), and when the trigger may disappear (opened from a menu, row deleted), focus is restored explicitly in `afterClosed()`.
  *Why:* Material restores focus only if the trigger element still exists.
- **NG-UI-35: Loading, empty and error states use shared components from `src/shared/ui`:** loading is a labelled `mat-progress-bar` or spinner ("Loading orders"); an empty result says so and offers the next action ("No orders yet. Create order"); a load error says what failed in plain words and offers a retry button. Each state is a status message (NG-UI-30, A11Y-20), keeps the page heading, and is a main state in the inventory (A11Y-27).
  *Why:* the same three states appear on every screen; built once, they are accessible and tested once.

### Fonts and icons

- **NG-UI-34: Fonts and icon fonts are self-hosted** with the app: Roboto / Roboto Flex and Material Symbols from npm packages (`@fontsource/*`) or files in `public/`, referenced from `src/styles/`. No Google Fonts `<link>` in `index.html` (remove the one `ng add @angular/material` may add) and no CLI font inlining (`optimization.fonts.inline`), which still loads the font files from Google. `font-src` stays `'self'` (NG-SEC-05).
  *Why:* every third-party request transmits the user's IP address to a processor ([DP-PROC-03](../data-protection/data-protection.md)); self-hosting also keeps the CSP strict.

## Skill overrides

| Skill | Says | Our rule |
|---|---|---|
| `angular-new-app` / `angular-developer` | Add Tailwind (`ng add tailwindcss`), Tailwind reference | No Tailwind (NG-UI-09) |
| `angular-developer` | Angular Aria for Accordion, Listbox, Menu, Tabs, … | Material component first; Angular Aria/CDK only for gaps (NG-UI-01/02) |
| `accessibility` | Hand-rolled live-region announcer; `role="alert"` nested inside an `aria-live` field wrapper; Lighthouse as the automated check | CDK `LiveAnnouncer` behind the app `Announcer` (NG-UI-30); `mat-error` already handles field errors (NG-UI-12); axe fixture ([TS-TEST-12](../testing/typescript.md)) |
| Angular Material docs | "Prefer a native `<select>` over `MatSelect`" for accessibility | Material first (NG-UI-01); `MatSelect` follows the ARIA combobox pattern |
| `material-3` (original, not installed) | `@material/web` elements and `--md-sys-*` tokens; Compose and Flutter code | Angular Material components and `--mat-sys-*` tokens; replaced by our `angular-material-design` skill |

## Agent checklist

- [ ] Material component used where one exists; gap components built from CDK/Aria with a keyboard test?
- [ ] Only `--mat-sys-*` tokens in styles; no `.mat-mdc-*` or `::ng-deep`?
- [ ] Works in light, dark and high contrast; density doesn't shrink targets below 24 px?
- [ ] Labels, errors, icon-button names, dialog focus handled?
- [ ] Status via visible region or `Announcer`; route `title`; `RouteFocus` only on path changes; snackbar, spinner and table labelled; dialog focus restored when the trigger can vanish?
- [ ] Loading, empty and error states from the shared components (NG-UI-35)?
- [ ] Harnesses for Material widgets in tests; theme projects cover the screen (TS-TEST-28)?
- [ ] Layout stated for compact, medium and expanded; CSS for layout, `WindowSize` only for structure; same data in every size class?
- [ ] Logical properties, `dvh`, safe areas, no hover-only function, zoom not blocked?
- [ ] Fonts and icons self-hosted, no Google Fonts link (NG-UI-34)?

## Sources

Angular Material documentation and theming guide (material.angular.dev/guide/theming), Material Design 3 (m3.material.io). Design concepts adapted from the `material-3` skill by CWTI Ltd (github.com/hamen/material-3-skill, MIT).
