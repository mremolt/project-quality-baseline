# Color and Theming

Material Design 3 color system mapped onto Angular Material's `mat.theme` and `--mat-sys-*` tokens.
Rules: NG-UI-04 (one theme), NG-UI-05 (tokens only), NG-UI-06 (roles as defined), NG-UI-07 (high
contrast), A11Y-09 (contrast per theme).

## Color roles

MD3 defines its color roles in groups. Angular Material emits each role as `--mat-sys-<role>` (MD3's
`md.sys.color.` prefix is dropped).

### Accent roles

| Role | Token | Purpose |
|---|---|---|
| Primary | `--mat-sys-primary` | High-emphasis fills, text and icons against surface |
| On primary | `--mat-sys-on-primary` | Text and icons on primary |
| Primary container | `--mat-sys-primary-container` | Standout fill for key components (FAB, emphasized banner) |
| On primary container | `--mat-sys-on-primary-container` | Text and icons on primary container |
| Secondary / on secondary | `--mat-sys-secondary`, `--mat-sys-on-secondary` | Less prominent fills, text, icons |
| Secondary container / on … | `--mat-sys-secondary-container`, `--mat-sys-on-secondary-container` | Recessive components: tonal buttons, active nav indicator |
| Tertiary / on tertiary | `--mat-sys-tertiary`, `--mat-sys-on-tertiary` | Contrasting accents |
| Tertiary container / on … | `--mat-sys-tertiary-container`, `--mat-sys-on-tertiary-container` | Complementary containers |

- **Primary**: the most prominent components: FAB, filled button, active states, progress.
- **Secondary**: less prominent: filter chips, tonal buttons, selected navigation item.
- **Tertiary**: balance and contrast: highlighted inputs, badges, an accent that isn't the brand color.

With a single palette (`color: mat.$violet-palette`) Angular Material derives primary, secondary and
tertiary from it. With a color map you can set `primary` and `tertiary` separately; the theme-color
schematic can also take secondary, neutral, neutral-variant and error seeds.

### Error roles

| Role | Token |
|---|---|
| Error / on error | `--mat-sys-error`, `--mat-sys-on-error` |
| Error container / on … | `--mat-sys-error-container`, `--mat-sys-on-error-container` |

Error colors are for errors. A destructive action ("Delete") is not an error state; MD3 uses a normal
emphasis button and a confirmation dialog. An error is never signalled by color alone: add text and/or an
icon (NG-UI-06, WCAG 1.4.1).

### Surface roles

| Role | Token | Purpose |
|---|---|---|
| Surface | `--mat-sys-surface` | Default background |
| On surface | `--mat-sys-on-surface` | Text and icons on any surface |
| On surface variant | `--mat-sys-on-surface-variant` | Lower-emphasis text and icons |
| Surface container lowest | `--mat-sys-surface-container-lowest` | Lowest-emphasis container |
| Surface container low | `--mat-sys-surface-container-low` | Low-emphasis container |
| Surface container | `--mat-sys-surface-container` | Default container (navigation areas) |
| Surface container high | `--mat-sys-surface-container-high` | High-emphasis container |
| Surface container highest | `--mat-sys-surface-container-highest` | Highest-emphasis container (filled cards, filled fields) |
| Surface dim / bright | `--mat-sys-surface-dim`, `--mat-sys-surface-bright` | Keep relative brightness in both light and dark |
| Surface variant | `--mat-sys-surface-variant` | Legacy alias; prefer the container roles |
| Background / on background | `--mat-sys-background`, `--mat-sys-on-background` | Legacy; prefer surface |

Use `surface` for the page, `surface-container` for navigation, and the five container levels to express
nesting in multi-pane layouts (e.g. list pane `surface-container-low`, detail pane `surface`).

### Inverse, outline, fixed, utility

| Role | Token | Purpose |
|---|---|---|
| Inverse surface | `--mat-sys-inverse-surface` | Elements that contrast with the UI (snackbar) |
| Inverse on surface | `--mat-sys-inverse-on-surface` | Text on inverse surface |
| Inverse primary | `--mat-sys-inverse-primary` | Actionable text on inverse surface |
| Outline | `--mat-sys-outline` | Important boundaries; meant to reach 3:1 against surface |
| Outline variant | `--mat-sys-outline-variant` | Decorative: dividers, card borders |
| Primary fixed / dim | `--mat-sys-primary-fixed`, `--mat-sys-primary-fixed-dim` | Same tone in light and dark |
| On primary fixed / variant | `--mat-sys-on-primary-fixed`, `--mat-sys-on-primary-fixed-variant` | Content on fixed colors |
| (same for secondary, tertiary) | `--mat-sys-secondary-fixed`, `--mat-sys-tertiary-fixed`, … | |
| Scrim | `--mat-sys-scrim` | Modal backdrop |
| Shadow | `--mat-sys-shadow` | Shadow color |
| Surface tint | `--mat-sys-surface-tint` | Tint used for tonal elevation |

Don't use `outline` for dividers or `outline-variant` for interactive boundaries that need 3:1 (WCAG
1.4.11). Fixed colors don't adapt to the theme: check their contrast in every theme.

## Pairing rules

Only these fill/content pairs carry MD3's contrast guarantee (NG-UI-06):

| Fill | Text / icon |
|---|---|
| `primary` | `on-primary` |
| `primary-container` | `on-primary-container` |
| `secondary` | `on-secondary` |
| `secondary-container` | `on-secondary-container` |
| `tertiary` | `on-tertiary` |
| `tertiary-container` | `on-tertiary-container` |
| `error` | `on-error` |
| `error-container` | `on-error-container` |
| `surface`, `surface-container-*`, `surface-dim/bright` | `on-surface`, `on-surface-variant`, and `primary` / `secondary` / `tertiary` / `error` as accent text |
| `inverse-surface` | `inverse-on-surface`, `inverse-primary` |
| `*-fixed`, `*-fixed-dim` | `on-*-fixed`, `on-*-fixed-variant` |

Even correct pairs are not automatically compliant with our **7:1** AAA text target (1.4.6, A11Y-02):
MD3 tone pairs aim at 4.5:1 or 3:1 in the standard contrast level. `on-surface-variant` on
`surface-container-highest` is a common AA-only pair. Measure (axe per theme, NG-UI-18); if the standard
theme misses 7:1, either use the high-contrast variant's tones more broadly or record the deviation in the
project's conformance notes (NG-UI-07).

Good: `background: var(--mat-sys-secondary-container); color: var(--mat-sys-on-secondary-container)`.
Bad: `color: var(--mat-sys-on-primary)` on a `surface` background.

## Tonal palettes

A seed color is turned into five tonal palettes (primary, secondary, tertiary, neutral, neutral variant)
plus error. Each palette has tones from 0 (black) to 100 (white). Roles map to tones:

| Role | Palette | Light tone | Dark tone |
|---|---|---|---|
| Primary | Primary | 40 | 80 |
| On primary | Primary | 100 | 20 |
| Primary container | Primary | 90 | 30 |
| On primary container | Primary | 10 | 90 |
| Surface | Neutral | 98 | 6 |
| On surface | Neutral | 10 | 90 |
| Surface container lowest | Neutral | 100 | 4 |
| Surface container low | Neutral | 96 | 10 |
| Surface container | Neutral | 94 | 12 |
| Surface container high | Neutral | 92 | 17 |
| Surface container highest | Neutral | 90 | 22 |
| Outline | Neutral variant | 50 | 60 |
| Outline variant | Neutral variant | 80 | 30 |

Because roles are tones, the same theme definition produces light and dark schemes, and the high-contrast
level just picks tones further apart. That's why hard-coded colors break: they don't move with the tone
mapping.

MD3 defines three contrast levels: standard (0), medium (0.5), high (1.0). Angular Material's
theme-color schematic generates the high level as override mixins; there is no built-in medium level.

## Setting up the theme (NG-UI-04)

One file, `src/styles/theme.scss`, registered in `angular.json` `styles` (or `@use`d from
`src/styles.scss`). `mat.theme` takes `color`, `typography` and `density` and outputs `--mat-sys-*`
variables; it only emits categories you pass.

Minimal form: `@include mat.theme((color: mat.$azure-palette, typography: Roboto, density: 0))` on `html`
with `color-scheme: light dark`. Our full theme file is under [Brand colors](#brand-colors-the-theme-color-schematic).

Prebuilt palettes: `$red-palette`, `$green-palette`, `$blue-palette`, `$yellow-palette`, `$cyan-palette`,
`$magenta-palette`, `$orange-palette`, `$chartreuse-palette`, `$spring-green-palette`, `$azure-palette`,
`$violet-palette`, `$rose-palette`.

Color map form:

```scss
@include mat.theme(
  (
    color: (
      primary: mat.$azure-palette,
      tertiary: mat.$orange-palette,
      theme-type: color-scheme, // color-scheme (default, light-dark()), light, or dark
    ),
    typography: Roboto,
    density: 0,
  )
);
```

`theme-type: color-scheme` emits every color as `light-dark(<light>, <dark>)`. Only set `light` / `dark`
when you must support browsers without `light-dark()`.

Don't use the prebuilt CSS themes (`azure-blue.css` etc.) in our apps: they are fixed light or dark and
don't give us the high-contrast variant.

## Brand colors: the theme-color schematic

```bash
ng generate @angular/material:theme-color
```

Options: `primaryColor` (required), `secondaryColor`, `tertiaryColor`, `neutralColor`,
`neutralVariantColor`, `errorColor`, `includeHighContrast` (set **true**, NG-UI-07), `directory`
(use `src/styles`), `isScss` (keep the default `true`).

It writes `_theme-colors.scss` with `$primary-palette`, `$tertiary-palette` and, with high contrast, a
`high-contrast-overrides($type)` mixin. Commit the generated file; regenerate when the brand changes.

```scss
// src/styles/theme.scss
@use '@angular/material' as mat;
@use './theme-colors' as brand;

html {
  color-scheme: light dark;
  @include mat.theme(
    (
      color: (
        primary: brand.$primary-palette,
        tertiary: brand.$tertiary-palette,
      ),
      typography: (
        plain-family: Roboto,
        brand-family: 'Roboto Flex',
      ),
      density: 0,
    )
  );
  @include mat.strong-focus-indicators();

  @media (prefers-contrast: more) {
    @include brand.high-contrast-overrides(color-scheme);
  }
}

body {
  background: var(--mat-sys-surface);
  color: var(--mat-sys-on-surface);
}
```

Mapping an existing brand: use the main brand color as `primaryColor`. A brand's exact hex is rarely a
good role color in both light and dark; the generated palette shifts the tone so `primary` / `on-primary`
reach contrast. Extra brand colors that must appear (e.g. a status color) go in as `tertiaryColor` or are
expressed through container roles, not as hard-coded hex values. If marketing needs the exact hex in a
logo, that's an image asset, not a token.

## Light and dark

`mat.theme` defines colors with `light-dark()`, so the active value follows the `color-scheme` property.
Angular Material applies **no** media queries itself.

- **Follow the OS** (default): `html { color-scheme: light dark; }`.
- **User toggle**: keep `light dark` as the default and override with a class or attribute.

```scss
// src/styles/theme.scss, after mat.theme
html[data-color-scheme='light'] {
  color-scheme: light;
}

html[data-color-scheme='dark'] {
  color-scheme: dark;
}
```

A small `ColorScheme` service in `src/shared/ui/theme/` holds the preference as a signal
(`'system' | 'light' | 'dark'`), sets or removes the attribute in an `effect()`, and persists it in
`localStorage`. Expose the toggle as a labelled `mat-button-toggle-group` (three options) or a `mat-menu`.
Your own components need no dark-mode code if they use tokens only (NG-UI-05).

## High contrast (NG-UI-07)

- Generate with `includeHighContrast` and apply `high-contrast-overrides(color-scheme)` inside
  `@media (prefers-contrast: more)` (example above). `light` / `dark` arguments exist for themes with a
  fixed `theme-type`.
- Prebuilt palettes (`mat.$azure-palette`) come with no high-contrast mixin. If you start from one, run the
  schematic with the equivalent seed color instead, so the high-contrast variant exists.
- Optionally offer an in-app toggle that applies the same mixin under `html[data-contrast='more']`.
- `mat.strong-focus-indicators()` adds visible outline focus rings (uses the secondary color by default;
  `mat.strong-focus-indicators-theme($color)` changes it). Check the result against WCAG 2.4.13 (2 px,
  3:1) in every theme.
- Windows forced-colors mode is a separate thing (`@media (forced-colors: active)`, A11Y-28); Material
  components handle it themselves; own components use real borders/outlines and system colors
  (`CanvasText`, `Highlight`), not only background color, so they stay visible.
- Test the variants with axe through the theme projects of TS-TEST-28 (NG-UI-18): Playwright options
  `colorScheme: 'dark'`, `contrast: 'more'` and, on the shell, `forcedColors: 'active'`.

## Scoped themes

`mat.theme` may be called again on a selector to re-theme a subtree, e.g. a deliberately different
context. Keep it in `src/styles/theme.scss` as well (NG-UI-04), never in component styles.

```scss
.admin-zone {
  @include mat.theme((color: mat.$rose-palette));
}

// Denser data table on desktop only (NG-UI-08: targets >= 24px; record the AAA deviation)
.data-dense {
  @include mat.theme((density: -2));
}
```

Use scoped themes sparingly: users lose the "same color means the same thing" consistency.

## Overrides

### System tokens

```scss
html {
  @include mat.theme(
    (
      color: brand.$primary-palette,
      typography: Roboto,
      density: 0,
    ),
    $overrides: (
      surface-container-low: #f7f2fa,
    )
  );
}

// or, for a subtree
.promo {
  @include mat.theme-overrides(
    (
      primary-container: var(--mat-sys-tertiary-container),
    )
  );
}
```

A system override with a literal color replaces `light-dark()` for that token: dark mode and high
contrast no longer move it. Prefer regenerating palettes; if you must override, give both values
(`light-dark(#…, #…)`) and re-check contrast.

### Component tokens (NG-UI-03)

Every component has a `mat.<component>-overrides` mixin. Token names are listed per component on
material.angular.dev under the **Styling** tab; the mixin validates names at build time.

Available mixins (angular/components main, 2026-11): `autocomplete`, `badge`, `bottom-sheet`, `button`,
`button-toggle`, `card`, `checkbox`, `chips`, `core`, `datepicker`, `dialog`, `divider`, `expansion`,
`fab`, `form-field`, `grid-list`, `icon`, `icon-button`, `input`, `list`, `menu`, `optgroup`, `option`,
`paginator`, `progress-bar`, `progress-spinner`, `pseudo-checkbox`, `radio`, `ripple`, `select`,
`sidenav`, `slider`, `slide-toggle`, `snack-bar`, `sort`, `stepper`, `table`, `tabs`, `timepicker`,
`toolbar`, `tooltip`, `tree` (each as `mat.<name>-overrides`).

```scss
// src/styles/theme.scss: app-wide component adjustments
html {
  @include mat.toolbar-overrides(
    (
      container-background-color: var(--mat-sys-surface-container),
    )
  );
  @include mat.card-overrides(
    (
      outlined-container-shape: var(--mat-sys-corner-large),
    )
  );
}
```

Values should be `--mat-sys-*` tokens, not literals, so they follow light/dark/high contrast. Put
app-wide overrides in the theme file; a component-specific override goes in that component's stylesheet
on its host or a wrapper class (no `::ng-deep` needed, the mixin sets custom properties that inherit).

### Utility classes

`@include mat.system-classes();` generates classes such as `mat-bg-primary-container`,
`mat-text-on-primary-container`, `mat-font-body-lg`, `mat-corner-md`. They are allowed (they resolve to the
same tokens), but prefer token use in the component stylesheet so styles stay in one place.

## Dynamic color from content (advanced)

MD3 "dynamic color" derives a scheme at runtime from the user's wallpaper (Android 12+) or from content
(an image). **Neither is built into Angular Material.** On the web there is no wallpaper API, and
`mat.theme` runs at build time.

Default: build-time palettes from the schematic. If a product really needs runtime color (per-tenant
branding loaded from an API, color from album art), it is an advanced, deliberate shortcut: propose it
and record an ADR (`docs/adr/`), because it bypasses the generated high-contrast tones and the axe
per-theme tests cover only what you test.

Sketch with `@material/material-color-utilities` (verify the current API of the library before use):

```ts
// src/shared/ui/theme/runtime-scheme.ts
import { Hct, MaterialDynamicColors, SchemeTonalSpot, argbFromHex, hexFromArgb } from '@material/material-color-utilities';

const ROLES = {
  primary: MaterialDynamicColors.primary,
  'on-primary': MaterialDynamicColors.onPrimary,
  'primary-container': MaterialDynamicColors.primaryContainer,
  'on-primary-container': MaterialDynamicColors.onPrimaryContainer,
  surface: MaterialDynamicColors.surface,
  'on-surface': MaterialDynamicColors.onSurface,
  // … every role the app uses
} as const;

export function applyRuntimeScheme(root: HTMLElement, seedHex: string, contrastLevel = 0): void {
  const seed = Hct.fromInt(argbFromHex(seedHex));
  const light = new SchemeTonalSpot(seed, false, contrastLevel);
  const dark = new SchemeTonalSpot(seed, true, contrastLevel);
  for (const [role, color] of Object.entries(ROLES)) {
    root.style.setProperty(
      `--mat-sys-${role}`,
      `light-dark(${hexFromArgb(color.getArgb(light))}, ${hexFromArgb(color.getArgb(dark))})`,
    );
  }
}
```

Generate the high-contrast scheme with `contrastLevel = 1` under `prefers-contrast: more`, set every
role (not a subset, or pairs break), and keep the build-time theme as the fallback.

## Checklist

- [ ] One `mat.theme` in `src/styles/theme.scss`; scoped themes only with a reason
- [ ] Palettes from `ng generate @angular/material:theme-color` with `includeHighContrast`
- [ ] `color-scheme: light dark`; optional toggle via attribute
- [ ] `high-contrast-overrides` under `prefers-contrast: more`
- [ ] `mat.strong-focus-indicators()` included and checked
- [ ] Overrides only via `mat.theme-overrides` / `mat.<x>-overrides`, with token values
- [ ] Contrast measured in light, dark and high contrast; shell usable in forced colors (A11Y-09, A11Y-28, NG-UI-18)
