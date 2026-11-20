# Typography, Shape, Elevation and Motion

MD3's non-color token systems mapped onto Angular Material. Rules: NG-UI-05 (tokens only), NG-UI-15
(reduced motion), NG-UI-16 (type-scale roles, headings by structure), NG-UI-11 (spacing grid).

## Typography

### Type scale

15 roles in five groups × three sizes. Values are Angular Material's defaults (rem at a 16 px root).

| Role | Token | Size / line height | Weight | Family | Typical use |
|---|---|---|---|---|---|
| Display large | `--mat-sys-display-large` | 3.562 / 4 rem | regular | brand | Hero numbers, landing headline |
| Display medium | `--mat-sys-display-medium` | 2.812 / 3.25 rem | regular | brand | |
| Display small | `--mat-sys-display-small` | 2.25 / 2.75 rem | regular | brand | |
| Headline large | `--mat-sys-headline-large` | 2 / 2.5 rem | regular | brand | Page title on expanded screens |
| Headline medium | `--mat-sys-headline-medium` | 1.75 / 2.25 rem | regular | brand | Page title |
| Headline small | `--mat-sys-headline-small` | 1.5 / 2 rem | regular | brand | Section title, dialog headline |
| Title large | `--mat-sys-title-large` | 1.375 / 1.75 rem | regular | brand | Top app bar title |
| Title medium | `--mat-sys-title-medium` | 1 / 1.5 rem | medium | plain | Card title, list section |
| Title small | `--mat-sys-title-small` | 0.875 / 1.25 rem | medium | plain | Tab label, small headers |
| Body large | `--mat-sys-body-large` | 1 / 1.5 rem | regular | plain | Default body text, input text |
| Body medium | `--mat-sys-body-medium` | 0.875 / 1.25 rem | regular | plain | Card body, dialog body, snackbar |
| Body small | `--mat-sys-body-small` | 0.75 / 1 rem | regular | plain | Captions, hints, tooltip |
| Label large | `--mat-sys-label-large` | 0.875 / 1.25 rem | medium | plain | Buttons, chips |
| Label medium | `--mat-sys-label-medium` | 0.75 / 1 rem | medium | plain | Navigation labels |
| Label small | `--mat-sys-label-small` | 0.688 / 1 rem | medium | plain | Badges, dense metadata |

Each role also has `-font`, `-size`, `-weight`, `-line-height`, `-tracking`; the label roles also
`-weight-prominent`.

```scss
.section-title {
  margin: 0;
  font: var(--mat-sys-title-large);
  letter-spacing: var(--mat-sys-title-large-tracking);
}

.metadata {
  font: var(--mat-sys-body-small);
  letter-spacing: var(--mat-sys-body-small-tracking);
  color: var(--mat-sys-on-surface-variant);
}
```

- The `font` shorthand token sets weight, size, line height and family, **not** letter-spacing. Add the
  `-tracking` token.
- `rem` sizes scale with the user's browser font setting; keep them (WCAG 1.4.4 Resize Text). Don't
  convert to `px`.
- Body text 0.75 rem (body-small) is fine for metadata, not for paragraphs; long-form text uses body-large
  or body-medium.
- **Heading level ≠ type role.** A card title is often an `h3` styled with title-medium; a dialog title is
  `<h2 mat-dialog-title>` (Material styles it headline-small). Choose the level from the
  document outline, then the role from the visual hierarchy (NG-UI-16, WCAG 1.3.1).
- Text spacing must survive user overrides (WCAG 1.4.12): no fixed heights on text containers.

### Font configuration

```scss
@include mat.theme(
  (
    color: brand.$primary-palette,
    typography: (
      plain-family: Roboto, // body, label, title medium/small
      brand-family: 'Roboto Flex', // display, headline, title large
      bold-weight: 700,
      medium-weight: 500,
      regular-weight: 400,
    ),
    density: 0,
  )
);
```

A single value (`typography: Roboto`) sets both families with weights 700/500/400. Roboto / Roboto Flex is
MD3's default and is fine to keep; replace it only for brand reasons. Fonts and icon fonts (Material Symbols)
are self-hosted, e.g. from `@fontsource/roboto` / `@fontsource-variable/material-symbols-outlined` or files
in `public/`; no Google Fonts `<link>` (which `ng add @angular/material` may add to `index.html`, remove it)
and no CLI font inlining, which still loads the font files from Google (NG-UI-34, DP-PROC-03). Include only
the weights you configure.

Angular Material components already apply MD3's role per element (button label: label-large, app bar
title: title-large, dialog headline: headline-small, card title: title-medium, navigation labels:
label-medium). Match those roles in own components next to them.

### Emphasized type styles

MD3 Expressive adds 15 emphasized styles (heavier weights). Angular Material does **not** expose them as
system tokens (angular/components#33557, open as of 2026-11-20). If a design needs emphasis, use
`font-weight: var(--mat-sys-<role>-weight-prominent)` where it exists (label roles) or the `bold-weight`
via `font-weight: bold` within the same family. Don't invent `--mat-sys-emphasized-*` names.

## Shape

| Token | Value | MD3 component defaults |
|---|---|---|
| `--mat-sys-corner-none` | 0 | Full-screen dialog, full-bleed media |
| `--mat-sys-corner-extra-small` | 4px | Snackbar, plain tooltip |
| `--mat-sys-corner-extra-small-top` | 4px 4px 0 0 | Filled text field container |
| `--mat-sys-corner-small` | 8px | Chips, menus, outlined field |
| `--mat-sys-corner-medium` | 12px | Cards |
| `--mat-sys-corner-large` | 16px | FAB, extended FAB, side panes |
| `--mat-sys-corner-large-top` | 16px 16px 0 0 | Standard bottom sheet |
| `--mat-sys-corner-large-start` / `-end` | start or end corners 16px | Navigation drawer (end corners in LTR) |
| `--mat-sys-corner-extra-large` | 28px | Dialogs, date picker |
| `--mat-sys-corner-extra-large-top` | 28px 28px 0 0 | Modal bottom sheet |
| `--mat-sys-corner-full` | 9999px | Buttons, icon buttons, badges, nav indicator pill, search bar |

```scss
.pane {
  border-radius: var(--mat-sys-corner-large);
  background: var(--mat-sys-surface-container-low);
}
```

- `-start` / `-end` tokens are physical values (`16px 0 0 16px`); for RTL, mirror them yourself
  (`:host-context([dir='rtl'])` or logical `border-start-end-radius` with the scalar token).
- Change a Material component's shape through its override mixin
  (`mat.card-overrides((elevated-container-shape: var(--mat-sys-corner-large)))`), not via CSS on its
  internals (NG-UI-03).
- MD3 Expressive corners (`large-increased` 20px, `extra-large-increased` 32px, `extra-extra-large` 48px)
  and shape morphing have no Angular Material support. If a design insists, define the value as an app
  custom property next to the theme and record it; don't animate Material internals.

## Elevation

| Level | Token (box-shadow) | Tonal role | Components at rest |
|---|---|---|---|
| 0 | `--mat-sys-level0` | `surface` | Flat app bar, filled / tonal / outlined buttons, filled and outlined cards, chips, lists, nav rail, tabs, full-screen dialog |
| 1 | `--mat-sys-level1` | `surface-container-low` | Elevated card, elevated button, modal bottom sheet, modal drawer |
| 2 | `--mat-sys-level2` | `surface-container` | Scrolled app bar, menus, navigation bar, rich tooltip |
| 3 | `--mat-sys-level3` | `surface-container-high` | FAB, modal dialogs, search, date and time pickers |
| 4 | `--mat-sys-level4` | `surface-container-highest` | Hover / focus raise from level 3 |
| 5 | `--mat-sys-level5` | `surface-container-highest` | Hover / focus raise from level 4 |

MD3 expresses depth **through tonal surfaces first**. Pick the surface-container role for the level; add
the shadow token only when the element floats over content that may be busy (FAB over images, sticky
header over a scrolled list) or overlaps other elements.

Example: a sticky list header stays on `surface` and switches to `surface-container` +
`box-shadow: var(--mat-sys-level2)` once content scrolls beneath it.

A sticky header must not hide the focused element underneath (WCAG 2.4.11 / 2.4.12, adopted AAA): set
`scroll-padding-top` on the scroll container to the header height.

## Spacing (NG-UI-11)

MD3 uses a 4 dp grid; on the web 1 dp ≈ 1 CSS px. Define the scale once next to the theme:

```scss
// src/styles/theme.scss (or src/styles/tokens.scss used by it)
html {
  --app-space-1: 0.25rem; // 4px
  --app-space-2: 0.5rem; // 8px
  --app-space-3: 0.75rem; // 12px
  --app-space-4: 1rem; // 16px
  --app-space-6: 1.5rem; // 24px
  --app-space-8: 2rem; // 32px
  --app-space-12: 3rem; // 48px
}
```

| Use | Values |
|---|---|
| Component internal padding | 4, 8, 12, 16, 24 |
| Between components | 8, 12, 16, 24 |
| Between sections | 24, 32, 48 |
| Window margins | 16 (compact), 24 (medium and up) |
| Pane spacer / gutter | 8 (compact), 16 (medium, expanded), 24 (large, extra-large) |

## Motion

### Values

Angular Material has MD3 motion values internally but emits **no** `--mat-sys-*` motion variables
(angular/components main, 2026-11-20). Define the ones you use as app custom properties beside the
spacing scale, with MD3's values:

```scss
html {
  --app-easing-emphasized: cubic-bezier(0.2, 0, 0, 1);
  --app-easing-emphasized-decelerate: cubic-bezier(0.05, 0.7, 0.1, 1);
  --app-easing-emphasized-accelerate: cubic-bezier(0.3, 0, 0.8, 0.15);
  --app-easing-standard: cubic-bezier(0.2, 0, 0, 1);
  --app-easing-standard-decelerate: cubic-bezier(0, 0, 0, 1);
  --app-easing-standard-accelerate: cubic-bezier(0.3, 0, 1, 1);

  --app-motion-short2: 100ms;
  --app-motion-short4: 200ms;
  --app-motion-medium2: 300ms;
  --app-motion-medium4: 400ms;
  --app-motion-long2: 500ms;
}
```

Full MD3 duration scale: short 1–4 = 50/100/150/200 ms, medium 1–4 = 250/300/350/400 ms, long 1–4 =
450/500/550/600 ms, extra-long 1–4 = 700/800/900/1000 ms.

| Transition | Easing | Duration |
|---|---|---|
| Element stays on screen (resize, move) | Emphasized | 500 ms |
| Element enters | Emphasized decelerate | 400 ms |
| Element exits permanently | Emphasized accelerate | 200 ms |
| Element exits temporarily (can come back) | Emphasized | 300 ms |
| Small utility change (color, opacity) | Standard | 200–300 ms |

MD3 Expressive's spring-based motion is not available in Angular Material. Use the easing/duration
system; don't emulate springs on Material components.

### Reduced motion (NG-UI-15, WCAG 2.3.3)

**Material components**: Angular Material checks `(prefers-reduced-motion)` and runs its components
without animations when it matches (via its internal animations-state check; the media query is read once
per page load). To turn Material animations off entirely (e.g. an in-app "reduce motion" setting, or
tests), provide the config token:

```ts
// src/app/app.config.ts
import { ApplicationConfig } from '@angular/core';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';

export const appConfig: ApplicationConfig = {
  providers: [{ provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } }],
};
```

Current Angular Material doesn't need `@angular/animations`; `provideNoopAnimations()` is the legacy way
and still disables Material animations if present. Prefer `MATERIAL_ANIMATIONS`.

**Own transitions** must opt out themselves:

```scss
.detail-pane {
  transition: transform var(--app-motion-medium4) var(--app-easing-emphasized-decelerate);

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}
```

Or set the `--app-motion-*` durations to `0ms` under `@media (prefers-reduced-motion: reduce)` once in
`src/styles.scss`; that keeps `transitionend` events firing for code that waits for them. Route animations (`animate.enter` / view transitions) need the
same check. Nothing moves, blinks or auto-advances for more than 5 s without a pause control (WCAG 2.2.2).

## Checklist

- [ ] Type via `--mat-sys-<role>` + `-tracking`; heading levels by structure
- [ ] Corners via `--mat-sys-corner-*`; Material shapes via override mixins
- [ ] Tonal surfaces before shadows; shadows via `--mat-sys-levelN`
- [ ] Spacing and motion custom properties defined once next to the theme
- [ ] Own transitions honour `prefers-reduced-motion`; optional `MATERIAL_ANIMATIONS` switch
