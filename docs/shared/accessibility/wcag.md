# Accessibility: WCAG 2.2

Every user interface we build is usable by everyone, including people using keyboards, screen readers, magnification, voice control or reduced motion. Conformance is **asserted by tests**, not claimed. This doc applies to every UI stack; tech docs implement the test layers ([typescript/testing.md](../../typescript/testing.md), [angular/testing.md](../../angular/testing.md)).

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
- **A11Y-03: Conformance is asserted by automated tests in CI. An AA violation fails the build.** Violations of adopted AAA criteria fail the build too, unless they are listed in the conformance notes.
- **A11Y-04: Accessibility tests and rules MUST NOT be disabled or weakened to make a build pass.** A known issue gets a ticket and a narrowly scoped exclusion (one rule, one selector) with a reference to the ticket. Same spirit as ARCH-ENF and the non-negotiables.

### Test layers

- **A11Y-05: Every UI project has all of these layers:**

| # | Layer | What it catches | Tooling (examples) |
|---|---|---|---|
| L1 | Static lint of templates/markup | Missing alt text, labels, invalid ARIA, click without key handler | eslint template a11y rules |
| L2 | Component tests query by role and accessible name | Elements without a name/role can't even be found, so the test fails | Testing Library `getByRole` |
| L3 | Rule engine on rendered components | Structure, ARIA, names (no layout, so no contrast) | axe-core in the unit test DOM |
| L4 | Rule engine on every main screen **and state** in a real browser (dialog open, error shown, menu expanded, dark theme) | Everything L3 does plus contrast, target size | axe with tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`; plus `wcag2aaa`, `wcag21aaa` for the AAA set |
| L5 | Keyboard journeys in a real browser: complete each main path keyboard-only | Focus order, traps, focus visible / not obscured, skip links, Escape closes dialogs | E2E tests using only the keyboard |
| L6 | Manual checklist per release | What machines can't judge: meaningful alt text, sensible reading order, screen-reader announcements, zoom/reflow | Screen reader (NVDA or VoiceOver), 400 % zoom, text spacing, reduced motion |

- **A11Y-06: A green automated run is not conformance.** Rule engines find only part of the barriers (roughly a third to a half). L5 and L6 are required, not optional.

### Building it right

- **A11Y-07: Native semantics first.** Use the HTML element that has the semantics (`button`, `a`, `label`, `fieldset`, headings, landmarks). ARIA only when no native element exists.
- **A11Y-08: Design-system components before custom widgets.** A custom widget follows the matching WAI-ARIA Authoring Practices pattern and gets an L5 keyboard test.
- **A11Y-09: Design tokens meet contrast in every theme** (light, dark, high contrast): AA 4.5:1 text, 3:1 large text and non-text UI; 7:1 text for the AAA set. Theme contrast is tested (L4 runs per theme).
- **A11Y-10: Pointer targets are at least 24 × 24 CSS px (AA 2.5.8); 44 × 44 is the default (AAA 2.5.5).** Density settings in the design system must not push targets below that.
- **A11Y-11: The WCAG 2.2 additions are checked explicitly**, since older tools and habits miss them: 2.4.11 Focus Not Obscured, 2.5.7 Dragging Movements (single-pointer alternative), 2.5.8 Target Size, 3.2.6 Consistent Help, 3.3.7 Redundant Entry, 3.3.8 Accessible Authentication.
- **A11Y-12: Every accessibility bug gets a regression test** at the lowest layer that can catch it (TEST-ARCH-11).

## Anti-patterns

- `div`/`span` with a click handler instead of a `button`.
- `outline: none` without an equivalent focus style.
- Placeholder text as the only label.
- Color as the only signal (error = red border only).
- Disabling an axe rule globally because one component violates it.
- "Lighthouse says 100" as the accessibility sign-off.
- Testing only the initial page state, never the opened dialog or error state.

## Agent checklist

- [ ] New UI element reachable and operable by keyboard, with visible focus?
- [ ] Accessible name and role (component test finds it with `getByRole`)?
- [ ] Main screen/state covered by an axe scan with the WCAG 2.2 AA tags?
- [ ] Keyboard journey test updated for changed main paths?
- [ ] Contrast and target size hold in all themes and densities?
- [ ] No a11y rule disabled or loosened?

## Sources

W3C, *Web Content Accessibility Guidelines (WCAG) 2.2*, W3C Recommendation, and *WCAG 2.2 Quick Reference* (w3.org/WAI/WCAG22/quickref). W3C *WAI-ARIA Authoring Practices Guide*. Deque axe-core rule tags (github.com/dequelabs/axe-core). Content cross-checked with the `accessibility` skill by Addy Osmani (github.com/addyosmani/web-quality-skills, MIT).
