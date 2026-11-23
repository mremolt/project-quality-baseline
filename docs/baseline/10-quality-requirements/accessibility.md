# Accessibility: WCAG 2.2

Every user interface we build is usable by everyone, including people using keyboards, screen readers, magnification, voice control or reduced motion. Conformance is **asserted by tests**, not claimed. This doc states the requirements for every UI stack; the TypeScript docs and each stack's testing doc implement the test layers ([testing/typescript.md](../08-crosscutting-concepts/testing/typescript.md), [testing/typescript-e2e.md](../08-crosscutting-concepts/testing/typescript-e2e.md)), and the framework-neutral UI rules ([ui/ui-patterns.md](../08-crosscutting-concepts/ui/ui-patterns.md)) plus each stack's UI doc implement the mechanisms.

## Target (default D10)

- **WCAG 2.2 Level AA: mandatory** for every UI.
- **Level AAA: where possible.** The baseline adopts this AAA set by default:

| Criterion | Meaning |
|---|---|
| 1.4.6 Contrast (Enhanced) | 7:1 for normal text, 4.5:1 for large text |
| 2.1.3 Keyboard (No Exception) | Everything works by keyboard, no exceptions |
| 2.3.3 Animation from Interactions | Motion triggered by interaction can be turned off (`prefers-reduced-motion`) |
| 2.4.12 Focus Not Obscured (Enhanced) | No part of the focused element is hidden |
| 2.4.13 Focus Appearance | Focus indicator at least 2 CSS px thick, 3:1 contrast against its unfocused state |
| 2.5.5 Target Size (Enhanced) | 44 × 44 CSS px for pointer targets |
| 3.3.9 Accessible Authentication (Enhanced) | No cognitive function test in login, not even object recognition |

## Rules

### Conformance

- **A11Y-01: Every UI MUST conform to WCAG 2.2 Level AA.**
- **A11Y-02: Every UI SHOULD meet the adopted AAA set above.** A project that can't meet one of them records which, where, and why in its accessibility conformance notes (`docs/accessibility.md` in the project). Other AAA criteria are welcome but not tracked.
- **A11Y-03: Conformance is asserted by automated tests in CI. An AA violation fails the build.** Violations of adopted AAA criteria fail the build too, unless they are listed in the conformance notes. Findings for AAA criteria the baseline does not adopt are reported, never failing.
- **A11Y-04: Accessibility tests and rules MUST NOT be disabled or weakened to make a build pass** (SEC-REV-02). A known issue gets a ticket and a narrowly scoped exclusion (one rule, one selector) that names the ticket and an expiry date; an expired exclusion fails the build until it is fixed or renewed in a reviewed change.
- **A11Y-26: Each product records whether accessibility law applies to it**, decided together with legal and stated in its `docs/accessibility.md`: the European Accessibility Act (national law, in Germany the BFSG) for products and services it covers, or public-sector accessibility rules (Web Accessibility Directive, in Germany BITV 2.0). If any applies:
  - an accessibility statement is published and kept current with the conformance notes (A11Y-02) and the latest release checklist results (A11Y-24);
  - users have a feedback channel for barriers, with a stated response time;
  - the L4 fixture also runs the axe tag `EN-301-549`, the harmonised European standard (TS-TEST-12).
  *Why:* the legal obligation depends on the product, its users and its operator, so the baseline cannot decide it. Scope, exemptions and the required content of the statement are confirmed by legal for each product, not by this rule.
- **A11Y-27: Each product keeps a journey and screen inventory** in its `docs/accessibility.md`: per main journey its routes, its states (dialog open, error shown, empty result, loading) and an owner. "Main screen", "main path" and "main state" in these docs mean an entry of this inventory; each entry has a tagged E2E spec (TS-TEST-18), and a new screen or journey updates the inventory in the same change.
  *Why:* about fifteen rules depend on "main"; without a list, coverage can't be reviewed.

### Test layers

- **A11Y-05: Every UI project has all of these layers:**

| # | Layer | What it catches | Tooling (examples) |
|---|---|---|---|
| L1 | Static lint of templates/markup | Missing alt text, labels, invalid ARIA, click without key handler | eslint template a11y rules |
| L2 | Component tests query by role and accessible name | Elements without a name/role can't even be found, so the test fails | Testing Library `getByRole` |
| L3 | Rule engine on rendered components | Structure, ARIA, names (no layout, so no contrast) | axe-core in the unit test DOM |
| L4 | Rule engine on every main screen **and state** (A11Y-27) in a real browser, per viewport and per theme | Everything L3 does plus contrast, target size | axe with tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa` (fail); plus `wcag2aaa`, of which only the rules for the adopted AAA set fail and the rest are reported; plus `EN-301-549` where A11Y-26 applies |
| L5 | Keyboard journeys in a real browser: complete each main path keyboard-only | Focus order, traps, focus visible / not obscured, skip links, Escape closes dialogs | E2E tests using only the keyboard |
| L6 | Manual checklist per release | What machines can't judge: meaningful alt text, sensible reading order, screen-reader announcements, zoom | The [L6 release checklist](#l6-release-checklist) |

- **A11Y-06: A green automated run is not conformance.** Rule engines find only part of the barriers: Deque measured 57 % of issues by volume, but issues in only about a third (16 of 50) of the WCAG 2.1 AA success criteria. None of them hears the page. L5 and L6 are required, not optional.

### Building it right

- **A11Y-07: Native semantics first.** Use the HTML element that has the semantics (`button`, `a`, `label`, `fieldset`, headings, landmarks). ARIA only when no native element exists.
- **A11Y-08: Design-system components before custom widgets.** A custom widget follows the matching WAI-ARIA Authoring Practices pattern and gets an L5 keyboard test.
- **A11Y-09: Design tokens meet contrast in every theme** (light, dark, high contrast): AA 4.5:1 text, 3:1 large text and non-text UI; 7:1 text for the AAA set. Each theme is scanned at L4 (TS-TEST-28).
- **A11Y-10: Pointer targets are at least 24 × 24 CSS px (AA 2.5.8); 44 × 44 is the default (AAA 2.5.5).** Density settings in the design system must not push targets below that. Asserted at L4 (A11Y-16).
- **A11Y-11: The WCAG 2.2 additions are checked explicitly**, since older tools and habits miss them: 2.4.11 Focus Not Obscured (L5), 2.5.8 Target Size (L4, A11Y-16), and 2.5.7 Dragging Movements, 3.2.6 Consistent Help, 3.3.7 Redundant Entry, 3.3.8 Accessible Authentication as steps of the [L6 release checklist](#l6-release-checklist).
- **A11Y-12: Every accessibility bug gets a regression test** at the lowest layer that can catch it (TEST-ARCH-11).
- **A11Y-28: The UI stays usable in forced-colors mode** (Windows contrast themes): focus indicators, the current and selected states, icons, borders of controls and the separation of panes stay visible. Use system colors (`CanvasText`, `Highlight`) in `@media (forced-colors: active)` where a state is drawn only by background color. Asserted on the app shell (TS-TEST-28). A panel that sets both a fixed foreground and background colour (a dark hero, a coloured banner) has a `@media (forced-colors: active)` variant that uses system colours (`CanvasText`, `Canvas`) for both, because the browser replaces the background but may keep the text colour.
  *Why:* forced colors drop backgrounds and shadows, so states drawn only that way disappear; axe on the normal theme does not see it.
- **A11Y-29: Time limits can be turned off, adjusted or extended (WCAG 2.2.1).** A session that expires warns the user at least 20 seconds before, and the user can extend it with a single action; unsaved input survives a re-login where the product can keep it. The warning counts from what the server counts: the BFF's idle timer (SPRING-SEC-32, NODE-BFF-07) is renewed only by requests, so the SPA bases the warning on the time of the last backend answer, never on mouse or keyboard activity, and reads the idle timeout from its runtime configuration (CFG-11). "Extend" is a request to a cheap authenticated endpoint, which renews the server session; it does not reload app-wide state in a way that tears down the open page (UI-18). The time of the last backend answer is shared between the tabs of the app (`BroadcastChannel` or a `storage` event), and before redirecting to login the SPA asks the server for the remaining idle time, so an idle tab does not log out a session another tab keeps alive. A page meant to stay open for hours (a running timer, a dispatch board) keeps its work state on the server, so an expiry loses nothing; the idle timeout is not raised for it.
  *Why:* users of assistive technology need more time; a silent logout loses their work. A warning driven by input events promises a session the server has already ended.
- **A11Y-30: Submissions with legal or financial effect, or that change or delete user data, are reversible, checked, or confirmed (WCAG 3.3.4):** the user can review and correct the data before the final submit, or confirm it, or undo it.
- **A11Y-31: Content shown on hover or focus is dismissible, hoverable and persistent (WCAG 1.4.13):** Escape hides it without moving focus, the pointer can move onto it, and it stays until dismissed or no longer relevant.
- **A11Y-32: Every page states its language in `<html lang>` (WCAG 3.1.1)**, also in a single-language product, and passages in another language carry their own `lang` (3.1.2). Multilingual products update `lang` on a language switch ([i18n.md](../08-crosscutting-concepts/i18n/i18n.md)).
- **A11Y-33: Every chart has an accessible name and an equivalent in text with the same figures (WCAG 1.1.1, 1.3.1).** The graphic is `role="img"` with a name that states what it shows; the figures are in a table next to it or behind a disclosure, or, for a single figure (a ring, a progress gauge), in a summary sentence. Colour is never the only carrier (A11Y-09): series also differ by label, pattern or position.
- **A11Y-34: A read-only value within a known range (usage, quota, rating) is `role="meter"`; progress towards completion is `progressbar`.** Both have a name, `aria-valuemin`/`max`/`now` and an `aria-valuetext` that reads like the visible label ("42 of 80 hours"); a status that the colour signals (warning, exceeded) is also visible as text next to it, and the bar has a forced-colors border (A11Y-28).

### Responsive, zoom and touch

- **A11Y-13: Content reflows at 320 CSS px width without two-dimensional scrolling (WCAG 1.4.10).** Exceptions are limited to regions that need two dimensions (data tables, maps, diagrams), and only that region scrolls. Asserted at L4 on every main screen; a 320 px viewport stands in for 400 % zoom on a 1280 px screen, as W3C describes.
  *Why:* low-vision users zoom to 400 %.
- **A11Y-14: Text-spacing overrides cause no clipped or overlapping text (WCAG 1.4.12):** line height 1.5, paragraph spacing 2, letter spacing 0.12 and word spacing 0.16 × font size. Asserted at L4 on main screens.
  *Why:* users with dyslexia or low vision apply their own spacing.
- **A11Y-15: No orientation lock (WCAG 1.3.4).** Main journeys work in portrait and landscape on compact screens.
  *Why:* some users have their device mounted in one orientation.
- **A11Y-16: Target size (A11Y-10) is asserted on compact screens at L4, not only in the design system.** A target below 44 × 44 px passes only when listed in the conformance notes (A11Y-02).
  *Why:* target size needs real layout; jsdom (L3) can't measure it.
- **A11Y-17: L4 runs in every viewport project, not only at desktop size.**
  *Why:* compact layouts hide, move and overlay controls, so violations differ per viewport.
- **A11Y-18: The L6 checklist includes real 400 % browser zoom and text-only zoom** ([L6 release checklist](#l6-release-checklist)).
  *Why:* the 320 px viewport (A11Y-13) emulates zoom; real zoom also scales fixed elements and the browser's own UI.

### Screen readers

- **A11Y-19: Each project states its screen reader support matrix** in its `docs/accessibility.md`. Default: **NVDA + Chrome** on Windows. A product whose users are mostly on JAWS or VoiceOver widens the matrix and records that in an ADR. Whether and how a product tests mobile assistive technology (VoiceOver on iOS, TalkBack) and real devices is decided per product and recorded in the same place.
  *Why:* "a screen reader" is not testable. WebAIM Screen Reader User Survey #11 (2026): JAWS is the primary desktop reader for 55.0 %, NVDA for 32.9 %, VoiceOver for 6.5 %; JAWS + Chrome (31.2 %) and NVDA + Chrome (17.3 %) are the two largest pairs. NVDA + Chrome is the largest pair that is free to test. Known gap of the default: JAWS stays untested.
- **A11Y-20: Every status message is exposed without moving focus (WCAG 4.1.3):** results of an action, loading, progress, errors and empty results are in a visible status or alert region, or are announced by the app announcer. Asserted at L2 (the stack's component tests) and L4 (TS-TEST-24); mechanism: UI-15.
  *Why:* the largest gap between "axe is green" and "a screen reader user knows what happened".
- **A11Y-21: Every route has a unique, descriptive title (2.4.2), and focus moves to the new page's main heading when the path changes:** the routed `h1`, falling back to `main`, without scrolling and without an additional announcement (double speech). This includes back and forward navigation. Not on the initial load, not when only query parameters or the fragment change (filters, paging, sorting), not on a navigation that only rewrites the current URL (`replaceUrl`, for example a canonical date filled in after load), and not when an in-page control of the same route changes a path parameter (a prev/next pager over `/week/:date`): there focus stays on that control and the new period is announced as a status message (A11Y-20). Asserted by the stack's component tests and TS-TEST-26; mechanism: UI-16. Back/forward behaviour: see [chapter 11](../11-risks-and-technical-debt/README.md#verify-before-first-use).
  *Why:* a single-page app otherwise leaves screen reader users on a stale element or on `body`; after back/forward the previously focused element no longer exists. WCAG does not require moving focus; 2.4.3 Focus Order only requires a meaningful order. The focus move is our design choice for a predictable focus order after navigation.
- **A11Y-22: Input errors are identified in text and linked to the field programmatically** (`aria-invalid` plus the error as the field's accessible description, WCAG 3.3.1, 4.1.2); a failed submit moves focus to the first invalid field or to an error summary. Asserted at L2 (the stack's component tests).
  *Why:* errors that are only visible are not heard. The focus move is our design choice; WCAG lists it only as an advisory technique (G139).
- **A11Y-23: Each main screen has a landmark and heading contract:** banner, a named main navigation (current page marked with `aria-current`), main, and contentinfo if the app has a footer; one `h1`; no skipped heading levels. Asserted by a scoped ARIA snapshot of the shell and of each main screen at L4 (TS-TEST-25).
  *Why:* 67.8 % of screen reader users navigate long pages by headings first (WebAIM survey #11, 2026).
- **A11Y-36: A control never changes the context while the user operates it (WCAG 3.2.2).** Changing the value of a select, date, time or text input, or moving through its segments with the keyboard, never navigates, submits a form, reloads the page or moves focus elsewhere. A control that leads to another view (a date picker that opens that day, a select that switches the project) commits on an explicit action: Enter, leaving the field with a complete valid value, or a button next to it. Filters that update a list in place on change are fine when focus stays in the control and the result count is announced (A11Y-20). Asserted by a component test that changes the value with the keyboard and checks that the route did not change.
  *Why:* a native date input fires `change` on each segment a keyboard user edits, so navigating on `change` jumps to year 0002 and takes the control away mid-entry.
- **A11Y-35: A wrapper never repeats the accessible name of the group, region or landmark it contains.** Two nested groups or landmarks with the same name are noise for a screen reader and break strict role queries in tests; name the outer one by its own purpose or drop its role, and give a scroll region inside a named section its own name (axe `landmark-unique`).
- **A11Y-24: The screen reader protocol of the [L6 release checklist](#l6-release-checklist) runs once per release** for every pair in the A11Y-19 matrix (tier T3, TS-TEST-18). The team runs it (a developer or tester trained on the script; rotate). Results go into the project's `docs/accessibility.md` as a summary table: date, tester, app version, screen reader and version, browser and version, OS, journey, pass/fail per step, ticket ids. A failure that blocks the task is an AA failure and blocks the release; shipping anyway needs an ADR with an owner and a fix date. Every other failure gets a ticket and a regression test at the lowest layer (A11Y-12).
  *Why:* turns the one-line L6 cell into evidence. Expert or user testing with people with disabilities is welcome before a major release or go-live, but not required by the baseline.
- **A11Y-25: Real screen reader automation is optional and supplementary:** nightly, never a pull-request gate, never a substitute for A11Y-24 (TS-TEST-27). A flaky test is fixed, or skipped with a ticket reference, not deleted (A11Y-04).
  *Why:* no JAWS, TalkBack or iOS VoiceOver coverage; pre-1.0 tooling that runs headed and serially.

## L6 release checklist

Run once per release, before the release is approved (tier T3, TS-TEST-18), on the main journeys of the inventory (A11Y-27). Record the results in the project's `docs/accessibility.md` (A11Y-24).

**Zoom, spacing and motion** (A11Y-18, A11Y-14, 2.3.3):

1. Browser zoom 400 % on a 1280 px window: every main journey can be completed, nothing is cut off, fixed bars don't cover the focused element.
2. Text-only zoom 200 %: no clipped or overlapping text.
3. A text-spacing bookmarklet on two main screens: nothing clipped.
4. `prefers-reduced-motion` on: no motion triggered by interaction.

**WCAG 2.2 additions** (A11Y-11):

5. Dragging (2.5.7): every drag action (sort, slider, map, split pane) has a single-pointer alternative.
6. Consistent help (3.2.6): help, contact or chat sits in the same relative place on every screen that offers it.
7. Redundant entry (3.3.7): no journey asks again for data the user already entered in the same process, unless it is re-entered for security or the earlier value is offered.
8. Accessible authentication (3.3.8, 3.3.9): login works with a password manager and paste, without a cognitive test.

**Screen reader protocol** (A11Y-24), per main journey and per pair of the matrix (A11Y-19):

9. Load the start route: is the title read, is the language right?
10. Read the headings list and the landmarks list: one `h1`, logical outline, banner / navigation / main (/ contentinfo).
11. Complete the journey with the screen reader running, keyboard only: every control is announced with name, role and state; state changes (expanded, selected) are announced.
12. Trigger each status (loading, success, empty result, server error): announced once, without moving focus, no stale message?
13. Submit a form with errors: is the error announced, can the field and its error be found and read again?
14. Open and close each dialog and menu: focus inside, title read, focus returns, background unreachable?
15. Navigate to another route: focus on the new `h1`, title updated. Go back and forward: focus on the `h1`, scroll position kept? Change a filter: focus stays where it was?
16. Spot-check images and icons (meaningful vs decorative) and the reading order of complex layouts.

## Anti-patterns

- `div`/`span` with a click handler instead of a `button`.
- `outline: none` without an equivalent focus style.
- Placeholder text as the only label.
- Color as the only signal (error = red border only).
- Disabling an axe rule globally because one component violates it; an exclusion without ticket and expiry date.
- "Lighthouse says 100" as the accessibility sign-off.
- Status messages (saved, deleted, error) that appear on screen but are not in a live region.
- Route changes that leave focus on `body` or on the clicked link of the previous page; moving focus when only a filter changed.
- Hand-rolled `aria-live` elements per component, or `role="alert"` nested inside another live region.
- `user-scalable=no` or `maximum-scale` in the viewport meta tag.
- Testing accessibility only at desktop size or only in the light theme.
- Testing only the initial page state, never the opened dialog or error state.
- A silent session timeout that discards the user's input.

*Agent checklist in [checklists/shared.md](../checklists/shared.md) and sources in [sources.md](../sources.md), section "Accessibility: WCAG 2.2".*
