# UI Patterns: Responsive Layout, Screen Readers and Screen States

Framework-neutral rules for the UI layer of every frontend: layout across window sizes, status messages, route changes, dialogs and the loading, empty and error states. They follow the Material Design 3 layout guidance (m3.material.io) and implement [10-quality-requirements/accessibility.md](../../10-quality-requirements/accessibility.md) for the UI layer. Each frontend stack adds the mechanism (components, services, library APIs) and cites the rule here.

## Rules

### Layout and navigation

- **UI-01: Layouts adapt to the Material Design window size classes:** compact < 600 px, medium 600–839, expanded 840–1199, large 1200–1599, extra-large ≥ 1600. Layout uses CSS grid and flex, CSS container queries, or media queries with exactly these breakpoints; breakpoint presets of libraries that use other values are not used.
  *Why:* one set of classes for design, code and the E2E viewport projects (TS-TEST-17).
- **UI-02: Navigation follows the window size:** compact → navigation bar (bottom) or modal drawer; medium → navigation rail; expanded and larger → rail or standard drawer. Navigation is consistent across pages (WCAG 3.2.3) and so is the help location (WCAG 3.2.6).
- **UI-03: Spacing follows the 4/8 px grid**, through a small set of spacing custom properties defined once next to the theme.

### Responsive layout

- **UI-04: Window size is UI-adapter state.** One window-size contract in `src/shared/ui/layout` derives the size class from the UI-01 queries; components get it through the stack's injection mechanism, so component tests can stub it. It is never imported by `domain`, `application` or `ports`, never passed into a use case or command, and view-state stores don't read it.
  *Why:* layout is presentation; the dependency rule keeps it out of the inner rings ([04-solution-strategy/hexagonal-architecture.md](../../04-solution-strategy/hexagonal-architecture.md)).
- **UI-05: Data loading doesn't depend on the size class.** Every size class calls the same use cases and gets the same data; layout hides or restructures, it doesn't fetch less or more.
  *Why:* no refetch on resize and no hidden extra requests (API-N1-01); state survives a resize.
- **UI-06: CSS first, code when the component tree changes.** Columns, gaps, pane widths and hiding decorative content use media or container queries. The window-size contract is for structure only: rail vs drawer, one vs two panes, dialog vs bottom sheet.
  *Why:* least code, no flicker, nothing to keep in sync.
- **UI-07: Shells and pages respond to the window; reusable `shared/ui` components respond to their container** (`container-type: inline-size`, `@container` queries).
  *Why:* a reusable component doesn't know where it is placed.
- **UI-08: Every new screen states its layout for compact, medium and expanded** (canonical layout, navigation form, what moves where) in its spec or story; large and extra-large only when they differ.
  *Why:* makes the responsive decision explicit and reviewable.
- **UI-09: Layout CSS uses logical properties** (`margin-inline`, `padding-block`, `inset-inline`, `text-align: start`) and `rem`, not physical left/right or px font sizes. Type doesn't scale with the viewport (no `clamp()` or `vw` font sizes); text scales through the user's browser settings.
  *Why:* right-to-left languages and the user's text-size settings (WCAG 1.4.4) work without extra code.
- **UI-10: Wide content never forces page-level horizontal scrolling.** Tables and code blocks scroll inside their own region (`role="region"`, `aria-label`, `tabindex="0"` so keyboard users can scroll it), or switch to a list or card form on compact. Images and media use `max-inline-size: 100%` and an `aspect-ratio` or `width`/`height`; content images declare `sizes` for responsive sources.
  *Why:* reflow (A11Y-13) and no layout shift.
- **UI-11: Full-height and fixed elements use dynamic viewport units and safe areas**: `dvh`, not `100vh`; `viewport-fit=cover` with `env(safe-area-inset-*)` padding for fixed bars. The viewport meta tag never disables zoom (no `user-scalable=no`, no `maximum-scale`).
  *Why:* mobile browser chrome, notches and rounded corners; zoom is required by WCAG 1.4.4.
- **UI-12: Hover is an enhancement.** No function or content is reachable by hover only; hover-only styling sits in `@media (hover: hover)`; pointer gestures have a single-tap alternative (WCAG 2.5.1, 2.5.7).
  *Why:* touch devices have no hover.
- **UI-13: Form inputs set `type`, `autocomplete` and `inputmode`**, and fields are full width on compact.
  *Why:* the right on-screen keyboard and autofill (WCAG 1.3.5).
- **UI-14: Print is out of scope by default.** A product that needs printable views records that in an ADR and adds a print stylesheet with an E2E test using `page.emulateMedia({ media: 'print' })`.
  *Why:* most apps don't need it; when one does, it is a requirement with a test, not an accident.

### Screen readers

- **UI-15: Status messages (A11Y-20) use a visible `role="status"` region or the form field's error element where possible; otherwise the app announcer.** The announcer is one contract in `src/shared/ui/a11y` whose implementation wraps a tested live-region utility. No hand-rolled `aria-live` elements per component, no nested live regions, no `ariaNotify()` for now. Only UI adapters use it: stores expose state, the component announces on change, so the wording stays in the UI adapter.
  *Why:* one consistent mechanism that tests can mock; tested announcers work around repeated-message bugs in screen readers.
- **UI-16: Route title and focus (A11Y-21):** every route defines a title, and the app formats all titles the same way ("Page | App"). One app-wide route-focus handler in `src/platform/adapter/in/ui`, started once by the shell, runs after each completed navigation: when the URL path (without query and fragment) differs from the previous one, it focuses the routed `h1` (`tabindex="-1"`), falling back to `main`, with `preventScroll: true`; it does nothing on the first navigation. It treats back/forward like any other navigation, so the router's scroll restoration keeps the position. It waits for the heading to render through the framework's render hook, not with timers. The link of the current page has `aria-current="page"`.
  *Why:* client-side routers manage neither focus nor announcements.
- **UI-17: Snackbars and toasts are polite, short, and never the only place for an error or a required action;** one with an action does not time out. Lazily loaded content announces its completion; every progress indicator and data table has an accessible label.
  *Why:* the content may be gone before a screen-reader user reaches it (WCAG 2.2.1).
- **UI-18: Dialogs are labelled by their visible title**, focus moves into the dialog and returns to the trigger on close; when the trigger may disappear (opened from a menu, row deleted), focus is restored explicitly to a sensible element.
  *Why:* dialog libraries restore focus only if the trigger element still exists.
- **UI-19: Loading, empty and error states use shared components from `src/shared/ui`:** loading is a labelled progress indicator ("Loading orders"); an empty result says so and offers the next action ("No orders yet. Create order"); a load error says what failed in plain words and offers a retry button. Each state is a status message (UI-15, A11Y-20), keeps the page heading, and is a main state in the inventory (A11Y-27).
  *Why:* the same three states appear on every screen; built once, they are accessible and tested once.

## Tests

Responsive structure and layout are tested with the viewport projects and checks of [TS-TEST-17..21](../testing/typescript-e2e.md); status messages, route focus and dialogs with the screen-reader assertions of [TS-TEST-23..27](../testing/typescript-e2e.md).

## Agent checklist

- [ ] Layout stated for compact, medium and expanded (UI-08); breakpoints are the size classes (UI-01)?
- [ ] CSS for layout, the window-size contract only for structure; same data in every size class (UI-04..06)?
- [ ] Logical properties, `rem`, `dvh`, safe areas, no hover-only function, zoom not blocked (UI-09..12)?
- [ ] Inputs with `type`, `autocomplete`, `inputmode` (UI-13)?
- [ ] Status via visible region or the announcer; route title; route focus only on path changes (UI-15, UI-16)?
- [ ] Snackbars never the only error channel; progress and tables labelled; dialog focus restored when the trigger can vanish (UI-17, UI-18)?
- [ ] Loading, empty and error states from the shared components (UI-19)?

## Sources

Material Design 3 layout (window size classes, canonical layouts, navigation) (m3.material.io), WCAG 2.2 (1.3.5, 1.4.4, 1.4.10, 2.2.1, 2.5.1, 2.5.7, 3.2.3, 3.2.6, 4.1.3), WAI-ARIA Authoring Practices (dialog pattern).

Per stack: Angular ([stacks/angular.md](../../stacks/angular.md)), React ([stacks/react.md](../../stacks/react.md)), Next.js ([stacks/nextjs.md](../../stacks/nextjs.md)).
