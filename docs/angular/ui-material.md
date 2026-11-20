# Angular UI: Angular Material and Material Design 3

Our Angular apps use **Angular Material** (material.angular.dev) and the CDK as their component library, and follow the **Material Design 3** guidelines (m3.material.io) for layout, color, typography and interaction. The `angular-material-design` skill (our adaptation) maps Material Design concepts to Angular Material APIs and follows these rules.

Implements: [wcag.md](../shared/accessibility/wcag.md) for the UI layer.

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
- **NG-UI-07: A high-contrast variant is provided** (the theme-color schematic's high-contrast overrides) for `prefers-contrast: more`. The prebuilt palettes (`mat.$azure-palette`, …) ship no high-contrast overrides, so generate the palette with the schematic even when using a prebuilt seed color. If the default theme doesn't reach 7:1 text contrast (adopted AAA criterion 1.4.6), adjust the palette or document the deviation in the project's conformance notes (A11Y-02).
- **NG-UI-08: Density 0 is the default.** Lower density only for desktop-focused data-dense views (tables, toolbars), never below the point where targets stay ≥ 24 × 24 px (WCAG 2.5.8); targets below 44 × 44 px are a documented AAA deviation (A11Y-10).

### Layout and navigation

- **NG-UI-09: Layouts adapt to the Material Design window size classes** (compact < 600 px, medium 600–839, expanded 840–1199, large 1200–1599, extra-large ≥ 1600), with CSS grid/flex, CSS container queries or the CDK `BreakpointObserver` with **custom queries**. The CDK `Breakpoints` presets (600/960/1280/1920) don't match the Material Design 3 classes and are not used. No Tailwind, no layout libraries.
- **NG-UI-10: Navigation follows the window size**: compact → navigation bar (bottom) or modal drawer; medium → navigation rail; expanded and larger → rail or standard drawer (`mat-sidenav`). Navigation is consistent across pages (WCAG 3.2.3) and so is the help location (WCAG 3.2.6).
- **NG-UI-11: Spacing follows the 4/8 px grid**, via a small set of spacing custom properties defined once next to the theme.

### Content and interaction

- **NG-UI-12: Form fields always have a visible `mat-label`**; placeholders are hints, not labels. Errors use `mat-error`, are specific (WCAG 3.3.3), and don't rely on color. Don't ask for data the user already entered in the same process (WCAG 3.3.7).
- **NG-UI-13: Icon-only buttons have an accessible name** (`aria-label`); decorative icons stay hidden from assistive technology (the `mat-icon` default).
- **NG-UI-14: Dialogs use `MatDialog`** with a `mat-dialog-title`; focus moves into the dialog and returns to the trigger on close.
- **NG-UI-15: Motion respects `prefers-reduced-motion`** (adopted AAA criterion 2.3.3): Angular Material switches its own animations off when `prefers-reduced-motion` matches (and can be switched off explicitly with the `MATERIAL_ANIMATIONS` token, `{ animationsDisabled: true }`); custom transitions must do the same with a `prefers-reduced-motion` media query. Material Design 3 Expressive is not supported by Angular Material; don't emulate it by restyling Material internals (NG-UI-03).
- **NG-UI-16: Typography uses the type-scale roles** (`display`, `headline`, `title`, `body`, `label` in large/medium/small) through the system tokens; heading levels (`h1`–`h6`) follow document structure, not size.

### Tests

- **NG-UI-17: Tests interact with Material composite widgets through their harnesses** (`MatSelectHarness`, `MatDatepickerInputHarness`, `MatTableHarness`, …); everything else through Testing Library role queries ([testing.md](testing.md)).
- **NG-UI-18: Axe scans run for every theme variant** (light, dark, high contrast) on the main screens (A11Y-09, TS-TEST-12).

## Skill overrides

| Skill | Says | Our rule |
|---|---|---|
| `angular-new-app` / `angular-developer` | Add Tailwind (`ng add tailwindcss`), Tailwind reference | No Tailwind (NG-UI-09) |
| `angular-developer` | Angular Aria for Accordion, Listbox, Menu, Tabs, … | Material component first; Angular Aria/CDK only for gaps (NG-UI-01/02) |
| `material-3` (original, not installed) | `@material/web` elements and `--md-sys-*` tokens; Compose and Flutter code | Angular Material components and `--mat-sys-*` tokens; replaced by our `angular-material-design` skill |

## Agent checklist

- [ ] Material component used where one exists; gap components built from CDK/Aria with a keyboard test?
- [ ] Only `--mat-sys-*` tokens in styles; no `.mat-mdc-*` or `::ng-deep`?
- [ ] Works in light, dark and high contrast; density doesn't shrink targets below 24 px?
- [ ] Labels, errors, icon-button names, dialog focus handled?
- [ ] Harnesses for Material widgets in tests; axe per theme?

## Sources

Angular Material documentation and theming guide (material.angular.dev/guide/theming), Material Design 3 (m3.material.io). Design concepts adapted from the `material-3` skill by CWTI Ltd (github.com/hamen/material-3-skill, MIT).
