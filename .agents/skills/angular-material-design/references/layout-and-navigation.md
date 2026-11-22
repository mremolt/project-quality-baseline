# Layout and Navigation

MD3 adaptive layout and navigation in Angular. Rules: NG-UI-09 (window size classes, no Tailwind or
layout libraries), NG-UI-10 (navigation by window size, consistent navigation and help), NG-UI-11
(spacing grid), NG-UI-19..29 (responsive), NG-UI-02 (gap components), A11Y-08 / A11Y-11,
A11Y-13..17 (reflow, text spacing, orientation, target size, axe per viewport).

## Window size classes

| Class | Width (CSS px ≈ dp) | Typical device | Columns | Margin | Panes (max) | Pane spacer |
|---|---|---|---|---|---|---|
| Compact | < 600 | Phone portrait | 4 | 16 | 1 | n/a |
| Medium | 600–839 | Tablet portrait, unfolded foldable | 8 | 24 | 1 (2 only by exception) | n/a (24 if two panes) |
| Expanded | 840–1199 | Tablet landscape, small laptop | 12 | 24 | 2 | 24 |
| Large | 1200–1599 | Desktop | 12 | 24 | 3 | 24 |
| Extra-large | ≥ 1600 | Wide desktop | 12 | 24 | 3 | 24 |

Panes and spacers follow the Material 3 adaptive implementation (AndroidX `calculatePaneScaffoldDirective`):
medium is one pane by default, and two panes there "can make your layout look too packed". A fixed
pane (list, supporting pane) is ≈ 360 px up to expanded and ≈ 412 px on large and extra-large. Margins
and columns are from MD3 guidance summaries, not re-checked against m3.material.io; Angular Material has
no column grid, so columns are orientation only.

Design mobile-first: compact styles are the base, larger classes add `min-width` queries.

```scss
// Compact: base styles, no query
@media (min-width: 600px) { /* medium */ }
@media (min-width: 840px) { /* expanded */ }
@media (min-width: 1200px) { /* large */ }
@media (min-width: 1600px) { /* extra-large */ }
```

Sass can't use custom properties in media queries; keep the breakpoints as Sass variables in one partial
(`src/styles/_breakpoints.scss`) and `@use` it.

### CSS first, TypeScript when structure changes

- **CSS media / container queries** for anything that only changes **layout** (columns, gaps, pane
  widths, hiding decorative content).
- **`WindowSize` signal** when the **component tree** changes (rail vs. drawer, one pane vs. two,
  `mat-sidenav` mode, dialog vs. bottom sheet).

The CDK `Breakpoints` presets (`XSmall`, `Small`, `Handset`, …) use 600/960/1280/1920 and orientation;
they **don't** match MD3 classes. Observe your own queries:

```ts
// src/shared/ui/layout/window-size.ts
import { BreakpointObserver } from '@angular/cdk/layout';
import { Injectable, Signal, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

export type WindowSizeClass = 'compact' | 'medium' | 'expanded' | 'large' | 'extra-large';

const QUERIES = {
  medium: '(min-width: 600px)',
  expanded: '(min-width: 840px)',
  large: '(min-width: 1200px)',
  extraLarge: '(min-width: 1600px)',
} as const;

@Injectable({ providedIn: 'root' })
export class BreakpointWindowSize {
  private readonly breakpoints = inject(BreakpointObserver);

  readonly sizeClass: Signal<WindowSizeClass> = toSignal(
    this.breakpoints.observe(Object.values(QUERIES)).pipe(
      map(({ breakpoints: matches }): WindowSizeClass => {
        if (matches[QUERIES.extraLarge]) return 'extra-large';
        if (matches[QUERIES.large]) return 'large';
        if (matches[QUERIES.expanded]) return 'expanded';
        if (matches[QUERIES.medium]) return 'medium';
        return 'compact';
      }),
    ),
    { initialValue: 'compact' },
  );

  readonly atLeastMedium = computed(() => this.sizeClass() !== 'compact');
  readonly atLeastExpanded = computed(() => !['compact', 'medium'].includes(this.sizeClass()));
}

/** The contract components inject (NG-UI-19); tests stub it (NG-TEST-09). */
@Injectable({ providedIn: 'root', useExisting: BreakpointWindowSize })
export abstract class WindowSize {
  abstract readonly sizeClass: Signal<WindowSizeClass>;
  abstract readonly atLeastMedium: Signal<boolean>;
  abstract readonly atLeastExpanded: Signal<boolean>;
}
```

`BreakpointWindowSize` is declared first because the decorator of `WindowSize` references it.

With SSR, `initialValue: 'compact'` renders the compact shell on the server; the client corrects it after
hydration. If that flicker matters, render both variants and switch with CSS.

`WindowSize` is UI-adapter state (NG-UI-19): never inject it into use cases, ports or stores, and never
load different data per size class (NG-UI-20).

Test: the class mapping of `BreakpointWindowSize` at the boundary widths with a fake `MediaMatcher`
(NG-TEST-10); components with a stub `WindowSize` whose `sizeClass` is a writable signal, one test per
variant (NG-TEST-09); in Playwright, the viewport projects (TS-TEST-17), not `page.setViewportSize()` loops.

### Container queries for reusable components

A shared component doesn't know where it is placed; it should respond to its container, not the window.

```scss
:host {
  display: block;
  container-type: inline-size;
}

.summary {
  display: grid;
  gap: var(--app-space-3);
}

@container (min-width: 30rem) {
  .summary {
    grid-template-columns: 8rem 1fr;
  }
}
```

## Layout anatomy

- **Window**: the viewport. **Pane**: a layout region (fixed, flexible, floating, semi-permanent).
  **Margin**: window edge to content. **Spacer**: between panes. **Gutter**: between grid columns.
- Readable width: body text lines stay under ~80 characters. On large and extra-large, constrain single
  content columns (≈ 840–1040 px) and use the extra space for more panes, not wider lines.
- Content reflows to a single column at 320 CSS px width (= 1280 px at 400 % zoom) without horizontal
  scrolling (WCAG 1.4.10, A11Y-13). Data tables may scroll horizontally inside their own container.
- Each new screen states its layout for compact, medium and expanded in its spec or story (NG-UI-23).

## Responsive details

**Type stays fixed** (NG-UI-16): no `clamp()` or `vw` font sizes; the type-scale tokens don't change per
size class. Responsiveness comes from layout; text scales with the user's browser settings, so sizes
are `rem`.

**Logical properties** (NG-UI-24): `margin-inline`, `padding-block`, `inset-inline-start`,
`text-align: start`, `border-inline-end`. Physical `left`/`right` breaks right-to-left languages.

**Wide content** (NG-UI-25): a table that can't reflow scrolls in its own focusable region, or becomes a
list of cards on compact.

```html
<div class="table-scroll" role="region" aria-label="Orders" tabindex="0">
  <table mat-table [dataSource]="orders()">…</table>
</div>
```

```scss
.table-scroll {
  overflow-x: auto;

  &:focus-visible {
    outline: 2px solid var(--mat-sys-primary);
  }
}

img,
video {
  max-inline-size: 100%;
  block-size: auto;
}
```

Content images use `NgOptimizedImage` (`<img ngSrc="…" width="…" height="…" sizes="(min-width: 840px)
50vw, 100vw">`), which reserves space and serves the right size.

**Viewport height and safe areas** (NG-UI-26):

```html
<!-- index.html: never user-scalable=no or maximum-scale -->
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```

```scss
.shell {
  min-block-size: 100dvh; // not 100vh: mobile browser bars change the height
}

.nav-bar {
  padding-block-end: env(safe-area-inset-bottom, 0px);
}

.top-bar {
  padding-inline: env(safe-area-inset-left, 0px) env(safe-area-inset-right, 0px);
}
```

**Hover is an enhancement** (NG-UI-27): actions shown on hover (row actions, card menus) are also
reachable by focus and tap; put hover-only styling in `@media (hover: hover)`. `matTooltip` never holds
the only copy of information. Drag (reorder, sliders) has a tap or keyboard alternative (WCAG 2.5.7).

```scss
.row-actions {
  opacity: 1;
}

@media (hover: hover) {
  .row:not(:hover, :focus-within) .row-actions {
    opacity: 0;
  }
}
```

**Forms on compact** (NG-UI-28): `type="email"`, `type="tel"`, `inputmode="numeric"` for codes,
`autocomplete="email"`, `"tel"`, `"postal-code"`, `"one-time-code"`; `mat-form-field` full width
(`inline-size: 100%`) on compact; `touchUi` date picker (see the adaptive table below).

**Print** is out of scope unless the product decided otherwise in an ADR (NG-UI-29).

## Canonical layouts

Start each screen from one of MD3's canonical layouts.

### List-detail

**Use for** browsing items with details: inbox, orders, contacts, settings.

| Class | Behavior |
|---|---|
| Compact | List **or** detail; detail is its own route, back returns to the list |
| Medium | As compact; side by side only by exception, when both panes stay usable |
| Expanded+ | List (≈ 360 px, ≈ 412 px on large+, or 1/3) + detail side by side |

Keep the selected item in the URL (`/orders/:id`) in every size class, so reload, deep links and back
behave the same; only the presentation changes.

```html
<!-- features/orders/adapter/in/ui/order-browser.html -->
<div class="list-detail" [class.list-detail--two-pane]="twoPane()">
  @if (twoPane() || !selectedId()) {
    <section class="list-detail__list" aria-labelledby="orders-heading">
      <h2 id="orders-heading" class="visually-hidden">Orders</h2>
      <app-order-list [selectedId]="selectedId()" />
    </section>
  }
  @if (selectedId(); as id) {
    <section class="list-detail__detail" aria-label="Order details">
      <router-outlet />
    </section>
  } @else if (twoPane()) {
    <p class="list-detail__empty">Select an order to see its details.</p>
  }
</div>
```

```scss
.list-detail--two-pane {
  display: grid;
  grid-template-columns: minmax(18rem, 1fr) 2fr;
  gap: var(--app-space-6);
}
```

`twoPane = computed(() => windowSize.atLeastExpanded())`. When the detail opens in a single pane, move
focus to its heading; when returning, restore focus to the item that opened it (WCAG 2.4.3).

### Supporting pane

**Use for** a main content area with supplementary content: document + properties, video + comments.

| Class | Behavior |
|---|---|
| Compact | Stacked: main first, supporting below, or the supporting pane in a bottom sheet |
| Medium | Stacked or side by side (2/3 + 1/3) |
| Expanded+ | Side by side; supporting pane ≈ 360 px (≈ 412 px on large+) or 1/3 |

Grid: one column on compact; from 840 px `grid-template-columns: 2fr minmax(18rem, 1fr)`.

On wide screens the supporting pane can be a `mat-sidenav position="end" mode="side"`; on compact a
`MatBottomSheet` or `mode="over"`.

### Feed

**Use for** browsable collections: news, products, dashboards.

Grid: `repeat(auto-fill, minmax(min(18rem, 100%), 1fr))` with `gap: var(--app-space-4)` (24 px gap
from large).

Use a list (`<ul role="list">`) for the items; reading and tab order follow the DOM, not the visual grid
(WCAG 1.3.2, 2.4.3). Avoid `grid-auto-flow: dense` and `order` that break that relation.

### Adaptive component behavior

| Component | Compact | Medium | Expanded+ |
|---|---|---|---|
| Navigation | Bottom bar or modal drawer | Rail | Rail or standard drawer |
| Dialog | Full-screen for complex forms | Centered | Centered, max ≈ 560 px |
| Bottom sheet | Modal bottom sheet | Bottom sheet | Side sheet (`mat-sidenav position="end"`) or dialog |
| Search | Full-screen search view | Search bar | Search bar |
| Panes | One | One (two only by exception) | Two (up to three on large+) |
| Date picker | Modal (`touchUi`) | Docked | Docked |

Full-screen dialog on compact:

```ts
this.dialog.open(EditAddress, {
  ...(this.windowSize.atLeastMedium()
    ? { width: '560px', maxWidth: '100vw' }
    : { width: '100vw', height: '100dvh', maxWidth: '100vw', maxHeight: '100dvh' }),
});
```

## Navigation selection (NG-UI-10)

```
How many top-level destinations?
├── 2–5
│   ├── Compact   → navigation bar (bottom), or modal drawer
│   ├── Medium    → navigation rail
│   └── Expanded+ → navigation rail or standard drawer
├── 6+
│   ├── Compact   → modal drawer
│   ├── Medium    → rail with the main 3–7 + modal drawer for the rest, or modal drawer
│   └── Expanded+ → standard drawer
├── Hierarchical sections → drawer with headings (mat-nav-list + mat-subheader / expansion)
└── Related views of one item → tabs (`nav` with router links for routes, UI-22)
```

| Component | Destinations | Window | Angular |
|---|---|---|---|
| Navigation bar (bottom) | 3–5 | Compact | Gap component (below) |
| Navigation rail | 3–7 | Medium (also expanded+) | Gap component (below) |
| Standard drawer | Any | Expanded+ | `mat-sidenav mode="side" opened` |
| Modal drawer | Any | Compact, medium | `mat-sidenav mode="over"` |
| Tabs | 2+ related views | Any | `nav` + router links (routes, UI-22) / `mat-tab-group` (same URL) |

Consistency (WCAG 3.2.3, 3.2.6): the same destinations in the same relative order in every mode; the help
entry (contact, FAQ) in the same place on every page, e.g. the last drawer item and the app bar.

Every navigation element gets a `<nav>` landmark with an `aria-label` when there is more than one, and
the active destination has `aria-current="page"` (`ariaCurrentWhenActive="page"` on `routerLinkActive`).
Provide a skip link to `<main>` (WCAG 2.4.1).

## mat-sidenav (drawers)

```html
<mat-sidenav-container>
  <mat-sidenav [mode]="mode()" [opened]="opened()" (closedStart)="onClosed()">…</mat-sidenav>
  <mat-sidenav-content>…</mat-sidenav-content>
</mat-sidenav-container>
```

| `mode` | Behavior | MD3 equivalent |
|---|---|---|
| `side` | Beside content, content shrinks | Standard drawer |
| `over` | Floats over content with backdrop; focus trapped, Escape closes | Modal drawer |
| `push` | Pushes content aside | Rarely used in MD3; prefer `side` or `over` |

- `position="end"` for side sheets; `fixedInViewport` with `fixedTopGap` when the toolbar is outside the
  container.
- In `over` mode Material traps focus and restores it on close; close the drawer after navigation
  (`(click)="drawer.close()"` on items) so focus returns to the menu button.
- Drawer styling via `mat.sidenav-overrides(...)`, e.g. `container-shape` and
  `container-background-color`. MD3: standard drawer on
  `surface-container`, modal drawer level 1, active item on `secondary-container`, end corners large.
- `mat-nav-list` items: `<a mat-list-item routerLink routerLinkActive #rla="routerLinkActive"
  [activated]="rla.isActive" ariaCurrentWhenActive="page">`.

## Top app bar: mat-toolbar

```html
<mat-toolbar class="top-bar" [class.top-bar--scrolled]="scrolled()">
  <button matIconButton aria-label="Open navigation" (click)="drawer.open()">
    <mat-icon>menu</mat-icon>
  </button>
  <h1 class="top-bar__title">Orders</h1>
  <span class="top-bar__spacer"></span>
  <button matIconButton aria-label="Search orders"><mat-icon>search</mat-icon></button>
  <button matIconButton aria-label="More actions" [matMenuTriggerFor]="more"><mat-icon>more_vert</mat-icon></button>
</mat-toolbar>
```

Title styling: `font: var(--mat-sys-title-large)`, `margin: 0`; a flex spacer pushes actions to the end.
The scrolled state switches the toolbar container to `surface-container` with
`mat.toolbar-overrides((container-background-color: var(--mat-sys-surface-container)))` on a modifier
class.

MD3 variants: small / center-aligned (64 px, flat, `surface-container` when scrolled), medium (112 px) and
large (152 px) that collapse on scroll. `mat-toolbar` covers small and center-aligned directly; medium and
large are a `mat-toolbar` with two `mat-toolbar-row`s (the title row hidden when scrolled). Max 3 action
icons; the rest go into an overflow `mat-menu`. The page `h1` may live in the toolbar or the content, but
there's exactly one per page.

## Tabs

- **Route tabs** (each tab a URL): a plain `nav` with router links and `ariaCurrentWhenActive="page"`,
  styled like tabs (UI-22). Not `mat-tab-nav-bar`: it gives its links `role="tab"` and the bar
  `role="tablist"`, which announces navigation as an in-page tab widget and conflicts with UI-22
  (links with `aria-current="page"`).
- **Content tabs** (same URL): `mat-tab-group` + `mat-tab`; lazy content with `<ng-template matTabContent>`.
- Primary tabs for top-level views of the screen, secondary tabs inside content. Don't nest tab groups of
  the same type; don't use tabs as main app navigation.

```html
<nav class="route-tabs" [attr.aria-label]="'orders.detail.sections' | transloco">
  @for (tab of tabs; track tab.path) {
    <a [routerLink]="tab.path" routerLinkActive="route-tabs__link--active" ariaCurrentWhenActive="page">
      {{ tab.labelKey | transloco }}
    </a>
  }
</nav>
<router-outlet />
```

## Gap component: navigation rail (NG-UI-02)

Angular Material has no rail. Build it in `src/shared/ui/nav-rail/`. It's a list of links in a navigation
landmark; native links already give keyboard access (Tab / Enter), so no composite-widget pattern or
roving tabindex is needed (A11Y-07).

MD3 anatomy: 80 px wide (MD3 Expressive allows 96 px), optional menu button and FAB at the top,
destinations top-aligned, each with an icon and a **visible label**, active item with a pill indicator
(`secondary-container`), container on `surface` at level 0.

```ts
// src/shared/ui/nav-rail/nav-rail.ts
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

export interface NavDestination {
  readonly path: string;
  readonly label: string;
  readonly icon: string;
}

@Component({
  selector: 'app-nav-rail',
  imports: [RouterLink, RouterLinkActive, MatIconModule],
  templateUrl: './nav-rail.html',
  styleUrl: './nav-rail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavRail {
  readonly destinations = input.required<readonly NavDestination[]>();
  readonly label = input('Main'); // read as "Main navigation"
}
```

```html
<!-- src/shared/ui/nav-rail/nav-rail.html -->
<nav class="rail" [attr.aria-label]="label()">
  <ng-content select="[railHeader]" />
  <ul class="rail__items" role="list">
    @for (item of destinations(); track item.path) {
      <li>
        <a class="rail__item" [routerLink]="item.path" routerLinkActive="rail__item--active" ariaCurrentWhenActive="page">
          <span class="rail__indicator"><mat-icon>{{ item.icon }}</mat-icon></span>
          <span class="rail__label">{{ item.label }}</span>
        </a>
      </li>
    }
  </ul>
</nav>
```

```scss
// src/shared/ui/nav-rail/nav-rail.scss (excerpt)
.rail {
  width: 5rem;
  padding-block: var(--app-space-3);
  background: var(--mat-sys-surface);
}

.rail__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--app-space-1);
  min-height: 3.5rem; // >= 44px target (A11Y-10)
  color: var(--mat-sys-on-surface-variant);
  font: var(--mat-sys-label-medium);
  letter-spacing: var(--mat-sys-label-medium-tracking);
  text-decoration: none;

  &:focus-visible {
    outline: 2px solid var(--mat-sys-secondary); // WCAG 2.4.13: >= 2px, 3:1
    outline-offset: 2px;
  }
}

.rail__indicator {
  display: grid;
  place-items: center;
  width: 3.5rem;
  height: 2rem;
  border-radius: var(--mat-sys-corner-full);
}

.rail__item:hover .rail__indicator {
  background: color-mix(in srgb, var(--mat-sys-on-surface) 8%, transparent); // hover state layer
}

.rail__item--active {
  color: var(--mat-sys-on-surface);
  font-weight: var(--mat-sys-label-medium-weight-prominent);

  .rail__indicator {
    background: var(--mat-sys-secondary-container);
    color: var(--mat-sys-on-secondary-container);
  }
}
```

The active state is shown by indicator, weight **and** `aria-current`, not color alone (WCAG 1.4.1). In
forced-colors mode the indicator background disappears; add `@media (forced-colors: active)
{ .rail__item--active .rail__indicator { outline: 2px solid CanvasText; } }`.

## Gap component: navigation bar (bottom)

Same component idea, horizontal, fixed at the bottom on compact. MD3: 3–5 destinations, always with
labels, `surface-container` background, level 2 (or tonal only), height ≈ 80 px (64 px in the Expressive
flexible variant).

Build it like the rail (`src/shared/ui/nav-bar/`): `position: fixed; inset-inline: 0; bottom: 0`,
`padding-bottom: env(safe-area-inset-bottom)`, items in a `grid-auto-flow: column; grid-auto-columns: 1fr`
list, background `--mat-sys-surface-container`.

- Give the main content `padding-bottom` equal to the bar height and set `scroll-padding-bottom`, so the
  bar never covers the focused element (WCAG 2.4.11 / 2.4.12).
- Hide-on-scroll is optional in MD3; if you do it, show the bar again when focus enters it.
- Labels stay visible: icon-only bottom bars fail recognition for many users.

## Keyboard test for gap components (A11Y-05 L5)

```ts
// e2e/navigation.keyboard.spec.ts — runs in the viewport projects (TS-TEST-17)
import { expect, test } from './fixtures';

test.skip(({ viewport }) => !viewport || viewport.width < 600 || viewport.width >= 840, 'rail is the medium navigation');

test('rail navigation works by keyboard @responsive', async ({ page }) => {
  await page.goto('/orders');

  const rail = page.getByRole('navigation', { name: 'Main' });
  await page.keyboard.press('Tab'); // skip link
  await page.keyboard.press('Tab');
  await expect(rail.getByRole('link', { name: 'Orders' })).toBeFocused();
  await expect(rail.getByRole('link', { name: 'Orders' })).toHaveAttribute('aria-current', 'page');

  await page.keyboard.press('Tab');
  await expect(rail.getByRole('link', { name: 'Customers' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/customers$/);
  await expect(rail.getByRole('link', { name: 'Customers' })).toHaveAttribute('aria-current', 'page');
});
```

Write one journey per navigation form (compact bar / modal drawer, medium rail, expanded drawer), each
skipped outside its size class. The axe scan runs in every viewport project (A11Y-17) and in the theme
projects (NG-UI-18, TS-TEST-28).

## Responsive testing

The rules and the full fixtures live in the docs; this is the map.

| What | Where | Rule |
|---|---|---|
| Size-class mapping at 599/600, 839/840, 1199/1200, 1599/1600 | Unit test, fake `MediaMatcher` | NG-TEST-10 |
| Which structure renders per size class | Component test, stub `WindowSize` | NG-TEST-09 |
| Layout, container queries, spacing | Not in jsdom; E2E viewport projects | NG-TEST-11 |
| Viewports `compact`, `medium`, `expanded`, `reflow`, … | Playwright projects, specs tagged `@responsive` | TS-TEST-17/18 |
| Reflow at 320 px, text spacing | `expectNoHorizontalOverflow`, `expectTextSpacingTolerant` | TS-TEST-19, A11Y-13/14 |
| Route, selection, form values and focus survive a resize | Resize-transition test | TS-TEST-20 |
| Target size on compact | axe `target-size` (prove it ran) + `boundingBox()` | TS-TEST-21, A11Y-16 |
| Portrait and landscape | `compact-landscape` project (nightly) | A11Y-15 |
| Real 400 % zoom and text-only zoom | L6 release checklist, before release | A11Y-18 |

```ts
// e2e/order-browser.spec.ts
import { expectNoHorizontalOverflow, expectTextSpacingTolerant, test } from './fixtures';

test('order browser is accessible and reflows @responsive', async ({ page, expectAccessible }) => {
  await page.goto('/orders/o-1');
  await expectAccessible('order browser');
  await expectNoHorizontalOverflow(page);
  await expectTextSpacingTolerant(page);
});
```

## Checklist

- [ ] Breakpoints 600 / 840 / 1200 / 1600; mobile-first; no CDK `Breakpoints` presets as size classes
- [ ] Each screen starts from list-detail, supporting pane or feed
- [ ] Readable max width on large windows; reflow at 320 px
- [ ] Navigation component per size class; same destinations and order everywhere; consistent help
- [ ] `<nav aria-label>`, `aria-current="page"`, skip link, focus handling on pane changes
- [ ] Gap components in `src/shared/ui/` with tokens only and a keyboard journey test
- [ ] `WindowSize` only in the UI adapter; same data in every size class; CSS for layout, signal for structure
- [ ] Logical properties, `rem`, no fluid type; `dvh` and safe areas; zoom not blocked
- [ ] Tables in a focusable scroll region or cards on compact; images capped at 100 %
- [ ] No hover-only function; forms with `type`, `autocomplete`, `inputmode`
- [ ] Main screens tagged `@responsive` with reflow and text-spacing checks; resize-transition test
