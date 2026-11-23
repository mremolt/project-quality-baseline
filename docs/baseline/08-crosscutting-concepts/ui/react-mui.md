# React UI: Material UI and Material Design

Our React apps use **Material UI** (MUI, `@mui/material` 9.5, mui.com) as their component library, styled through one theme with CSS variables, and follow the Material Design guidelines (m3.material.io) for layout, color, typography and interaction as far as MUI implements them. React Aria Components replace MUI only through an ADR (own design system or strictest accessibility needs, REACT-D5 in [04-solution-strategy/react.md](../../04-solution-strategy/react.md)). The official `material-ui-theming` and `material-ui-styling` skills supply the MUI know-how; these rules override them.

Implements: [10-quality-requirements/accessibility.md](../../10-quality-requirements/accessibility.md) for the UI layer and the framework-neutral [ui-patterns.md](ui-patterns.md) (`UI-*`): each REACT-UI rule that implements a UI rule names it and adds only the MUI and React mechanism. Applies to React SPA and Next.js; rules marked "(React SPA)" are replaced for Next.js by its own docs. Verified in the React SPA reference build with MUI 9.5, Emotion 11.14 and `@react-aria/live-announcer` 3.5. MUI options that the build did not exercise were checked against the MUI 9.5 type definitions and its bundled docs; their behaviour is marked "verify before first use".

## Rules

### Components

- **REACT-UI-01: Use an MUI component when one exists for the job.** Don't build a custom button, select, dialog, menu, table, tabs or autocomplete. Prefer native semantics where MUI renders them (`Button`, `TextField`, `Table`).
  *Why:* MUI components come with keyboard support and ARIA; custom widgets have to earn all of that (A11Y-07, A11Y-08).
- **REACT-UI-02: Patterns MUI does not ship are built once as a shared component in `src/shared/ui/`** (navigation rail, search bar, split button, carousel): from MUI building blocks (`ButtonBase`, `List`, `ListItemButton`, `Popper`), styled only with theme tokens, following the matching WAI-ARIA pattern, with a keyboard journey test (TS-TEST-13, A11Y layer L5). No second component library without an ADR (REACT-D5).
- **REACT-UI-03: Styling goes from narrow to wide: `sx` for one element, `styled()` for a reusable wrapper, theme `components` (`defaultProps`, `styleOverrides`) for every instance.** Global CSS (`GlobalStyles`) only for element baselines that `CssBaseline` does not cover. Target MUI parts only through documented slots, `slotProps` and the exported class objects (`buttonClasses.root`, `.Mui-focused`), never through generated Emotion class names or DOM structure. No `!important`.
  *Why:* documented slots and classes are MUI's supported customization API; generated names and structure change between versions.

### Theme and tokens

- **REACT-UI-04: One theme in `src/shared/ui/theme.ts`, created with `createTheme({ cssVariables: true, colorSchemes: { light: {...}, dark: {...} } })` and provided once in the app root with `ThemeProvider` and `CssBaseline`.** With `cssVariables` MUI writes the tokens as `--mui-*` custom properties and switches light and dark by CSS; with the default `colorSchemeSelector` (`media`) the scheme follows `prefers-color-scheme`, needs no script and does not flicker. A manual scheme toggle (`colorSchemeSelector: 'class'` or `'data'`, `useColorScheme()`) needs MUI's `InitColorSchemeScript`, an inline script that must carry the CSP nonce (REACT-SEC-04): verify before first use. Storing the chosen scheme in `localStorage` is fine; it is not personal data.
  *Why:* one theme, both schemes as CSS: dark mode and theme tests work without code in features.
- **REACT-UI-05: Own styles use theme tokens only:** palette paths in `sx` (`color: 'text.secondary'`, `bgcolor: 'background.paper'`) or `theme.vars.palette.*` in `styled()`, spacing units (`gap: 2`, `theme.spacing(2)`), typography variants, `theme.shape.borderRadius`, elevation (`boxShadow: 1`), z-index names (`zIndex: 'tooltip'`). No hex values, px font sizes, own shadows or numeric z-indexes in components. Semantic product colours MUI has no palette entry for (chart series, a project palette) are added once as custom palette entries in the theme, typed through module augmentation of `Palette`/`PaletteOptions`, with a value per color scheme (as NG-UI-05's `--app-color-*` family); a fixed-colour panel gets a forced-colors block (REACT-UI-07).
  *Why:* light, dark, forced colors and later brand changes then work everywhere.
- **REACT-UI-06: Palette roles keep their meaning**: `error` only for errors, `primary` for the main action; `contrastText` on its own `main` background. A color never carries meaning alone (WCAG 1.4.1): errors also have text, states also have an icon or label.
- **REACT-UI-07: Both color schemes meet the adopted AAA text contrast (7:1, A11Y-02, A11Y-09); MUI's default light palette does not and is darkened in the theme.** Verified values: light `primary.main: '#0d47a1'` and `text.secondary: 'rgba(0, 0, 0, 0.72)'`; the dark defaults (`primary.main: '#90caf9'`) pass. Every palette change re-runs the theme scans (REACT-UI-35).
  - The roles used for text or icons that carry meaning (`error`, `warning`, `success`, `info`) meet the same ratio on `background.paper`: MUI's default light `warning.main` (`#ed6c02`, about 3:1) and `info.main` fail even 4.5:1 for small text. The theme sets a value for each role the product uses, or the product renders that text in `text.primary` next to an icon, and a theme scan covers a screen that shows each state's text. The values are not verified in the validated project: verify before first use.
  - `prefers-contrast: more` gets the same schemes, because they already meet 7:1 for text. A product whose brand palette cannot reach 7:1 adds overrides under `@media (prefers-contrast: more)` in the theme's `styleOverrides`, or records the deviation in its conformance notes (A11Y-02).
  - Forced colors (A11Y-28): wrap the theme with `enhanceHighContrast(createTheme(...))` (MUI 9.1 or later; adds `@media (forced-colors: active)` overrides with system colors). Own components that show a state only by background, shadow or tint add a `'@media (forced-colors: active)'` block with system colors (`CanvasText`, `Highlight`). The validated project did not run the forced-colors and high-contrast projects: verify before first use.
  ```ts
  export const theme = createTheme({
    cssVariables: true,
    colorSchemes: {
      light: { palette: { primary: { main: '#0d47a1' }, text: { secondary: 'rgba(0, 0, 0, 0.72)' } } },
      dark: { palette: { primary: { main: '#90caf9' } } },
    },
  });
  ```
- **REACT-UI-08: Default density.** `size="small"`, `margin="dense"` and `Table size="small"` only for desktop-focused data-dense views, never where targets drop below 24 × 24 px (WCAG 2.5.8); targets below 44 × 44 px are a documented AAA deviation (A11Y-10). Don't apply dense defaults to the whole theme.
- **REACT-UI-09: Keyboard focus stays visible.** Never remove the focus outline, and never set `disableRipple` without a visible focus style. MUI 9.4 adds `focusVisible: true` on the theme, a two-pixel outline on every `ButtonBase` component on keyboard focus; adopting it is the default for new apps, to verify before first use (it was not used in the validated project).
- **REACT-UI-10: Motion respects `prefers-reduced-motion`** (adopted AAA criterion 2.3.3): set `motion: { reducedMotion: 'system' }` in the theme (MUI 9.1 or later; covers MUI's transitions and animated components). Own transitions use `theme.transitions.create(...)` and add `'@media (prefers-reduced-motion: reduce)': { transition: 'none' }`. Option checked against the MUI 9.5 types; behaviour to verify before first use.
- **REACT-UI-11: Typography uses the theme variants; the heading level comes from document structure** (`<Typography variant="h4" component="h1">`). MUI's variants are in `rem` and scale with the user's browser setting. `responsiveFontSizes()` and `clamp()`/`vw` font sizes are not used: type does not scale with the viewport (UI-09).
- **REACT-UI-12: (React SPA) One Emotion cache, created once in `src/app/emotion-cache.ts` with `createCache({ key: 'mui', prepend: true, nonce })` and provided by `<CacheProvider>` outside the `ThemeProvider`.** The nonce is the per-response CSP nonce, read from the `nonce` **property** of Vite's `<meta property="csp-nonce">` (the attribute reads empty); Emotion puts it on every `<style>` it inserts, so `style-src` needs no `'unsafe-inline'` (REACT-SEC-04, [security/react.md](../security/react.md)). `prepend: true` inserts MUI's styles first, so the app's own styles win at equal specificity. Next.js: [security/nextjs.md](../security/nextjs.md).
- **REACT-UI-13: Fonts and icons are self-hosted.** MUI's default `fontFamily` names Roboto but loads no font: either self-host it with the app (an npm font package or files in `public/`) or set a system font stack. Icons are SVG components (`@mui/icons-material`, imported per icon) or own SVGs, not icon fonts from a CDN. No Google Fonts `<link>`; `font-src` stays `'self'` (TS-SEC-07, [DP-PROC-03](../data-protection/data-protection.md)). The validated project used the fallback stack; the font and icon packages are to verify before first use (licence, size, TS-TOOL-13).

### Layout and navigation

- **REACT-UI-14 (implements UI-01): The theme's breakpoints are the window size classes:** `breakpoints: { values: { xs: 0, sm: 600, md: 840, lg: 1200, xl: 1600 } }`, read as xs = compact, sm = medium, md = expanded, lg = large, xl = extra-large. MUI's default values (600/900/1200/1536) are not used. `theme.breakpoints.up('md')` then gives `@media (min-width:840px)` (checked with MUI 9.5). Layout uses CSS grid and flex through `Box`/`Stack` with `sx`; no Tailwind, no other layout library.
- **REACT-UI-15 (implements UI-02): Navigation by window size:** compact → `BottomNavigation` or a temporary `Drawer`; medium → the navigation rail (REACT-UI-02); expanded and larger → rail or a permanent `Drawer`. The same navigation component serves all pages (WCAG 3.2.3). Not built in the validated project: verify before first use.
- **REACT-UI-16 (implements UI-03): Spacing uses the theme's spacing units on the 4/8 px grid** (`gap: 2`, `paddingBlock: 3`, `theme.spacing(0.5)`); no px values. Default: a rem-based spacing function, `` spacing: (factor: number) => `${0.5 * factor}rem` ``, so `theme.spacing(2)` is `1rem` (checked with MUI 9.5) and spacing follows the user's text size. The validated project used MUI's default (8 px per unit); the rem function is to verify before first use.

### Responsive layout

The responsive rules are framework-neutral ([ui-patterns.md](ui-patterns.md)); these add the MUI and React mechanism.

- **REACT-UI-17 (implements UI-04): The window-size contract is a `WindowSize` context in `src/shared/ui/layout/window-size.ts` with a `useWindowSize()` hook**, built like the announcer (REACT-UI-29): the default value derives the size class from `useMediaQuery(theme.breakpoints.up(...))` with the REACT-UI-14 breakpoints; component tests provide a fixed value. It is never read by slices, selectors, query or mutation hooks or use cases. Not built in the validated project: verify before first use.
- **REACT-UI-18 (implements UI-05): Query keys and use-case arguments never contain the size class.** Every size class renders from the same query hooks (REACT-STATE-10) and runs the same mutations.
- **REACT-UI-19 (implements UI-06): `useWindowSize()` is for structure only** (rail vs drawer, one vs two panes, `Dialog` vs bottom sheet); columns, gaps and widths are CSS through responsive `sx` values (`{ xs: 1, md: 2 }`) or `theme.breakpoints` media queries.
- **REACT-UI-20 (implements UI-07): Reusable `shared/ui` components set `containerType: 'inline-size'` on their root and use `theme.containerQueries.up(...)`** (which gives `@container (min-width:600px)` for `'sm'`, checked with MUI 9.5).
- **REACT-UI-21 (implements UI-08): The layout statement for compact, medium and expanded** sits at the top of the screen's component spec.
- **REACT-UI-22 (implements UI-09): `sx` and `styled()` use logical properties** (`paddingInline`, `marginBlockStart`, `insetInlineStart`). The physical one-sided shorthands `ml`, `mr`, `pl`, `pr`, `left`, `right` are not used; symmetric shorthands (`p`, `px`, `py`, `m`, `mx`, `my`) are fine. Sizes come from the theme (rem typography, REACT-UI-16 spacing).
- **REACT-UI-23 (implements UI-10): A table that can't reflow scrolls in its own region:** `<TableContainer component={Paper} role="region" aria-label={t('table.label')} tabIndex={0}>` with `<Table aria-label=...>`, row headers as `<TableCell component="th" scope="row">`; or the screen switches to a `List` or `Card` form on compact. Images use `maxInlineSize: '100%'` and `aspectRatio` or `width`/`height`.
- **REACT-UI-24 (implements UI-11): `index.html` carries `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`**; fixed `AppBar`s and `BottomNavigation` pad with `env(safe-area-inset-*)`, full-height panes use `minBlockSize: '100dvh'`.
- **REACT-UI-25 (implements UI-12): Row and card actions are always visible or also in a `Menu`;** hover-only styling sits in `'@media (hover: hover)'` inside `sx`. A `Tooltip` never holds the only label or required information (A11Y-31).
- **REACT-UI-26 (implements UI-13): `TextField` always has a visible `label`, and sets `type`, `autoComplete` and, where it helps, `slotProps={{ htmlInput: { inputMode: 'decimal' } }}`;** fields are `fullWidth` on compact. Placeholders are hints, not labels. Validation errors use `error` plus `helperText` with a specific message (WCAG 3.3.1, 3.3.3); MUI links the helper text with `aria-describedby` and sets `aria-invalid` (A11Y-22). With React Hook Form (REACT-ARCH-14), use `Controller` and take the `ref` out of `field` before spreading, so it lands on the input and focus moves to the first invalid field on submit: `render={({ field: { ref, ...field }, fieldState }) => <TextField {...field} inputRef={ref} ... />}`. Spreading the whole `field` puts the ref on the root and breaks focus on error (REACT-TEST-10 asserts it). No `autoFocus` (`jsx-a11y-x/no-autofocus`).
- **REACT-UI-27 (implements UI-14): Print is out of scope** unless an ADR adds it with a print style and its E2E test.
- **REACT-UI-28: Icon-only buttons (`IconButton`) have an `aria-label`;** decorative icons stay hidden (`SvgIcon` sets `aria-hidden` unless `titleAccess` is given).

### Screen readers

- **REACT-UI-29 (implements UI-15): The announcer is `src/shared/ui/a11y/announcer.ts`:** an `Announcer` interface, an `AnnouncerContext` whose default value wraps `announce(message, 'polite')` from `@react-aria/live-announcer`, and a `useAnnouncer()` hook. Components announce after a state change (the command result: "Order A-1001 cancelled."); slices and mutation hooks never announce. Component tests provide `mock<Announcer>()` through `<AnnouncerContext value={...}>`. Never call the library's `clearAnnouncer()`: it assigns `innerHTML` and violates Trusted Types (REACT-SEC-05). Field errors use `helperText` (REACT-UI-26), not the announcer.
- **REACT-UI-30 (implements UI-16): (React SPA) Route title and focus come from one `RouteChangeHandler` in `src/platform/adapter/in/ui/`, rendered once by the shell.**
  - Every route sets `staticData: { titleKey }`; the key type comes from module augmentation of TanStack Router's `StaticDataRouteOption`, so a route without a title does not compile. The handler sets `document.title` to `t('platform.documentTitle', { page: t(titleKey) })` ("Orders | Shop").
  - It subscribes with `router.subscribe('onRendered', ...)` and, when `toLocation.pathname` differs from the previous path, focuses the routed `h1` inside `main` (fallback `main`) with `preventScroll: true`. Query-only changes, the first load, replace navigations and navigations with `state: { keepFocus: true }` keep focus: a page that canonicalises its own URL navigates with `replace: true`, which the handler sees as the history action `REPLACE` (`router.history.subscribe`); an in-page pager of the same route sets `keepFocus` (typed by augmenting `HistoryState` of `@tanstack/history`) and announces the new period (A11Y-21). Page headings carry `tabIndex={-1}`.
  - No additional announcement on route change (A11Y-21): title and focus are enough, and a second message would be spoken twice.
  - `createRouter({ scrollRestoration: true })` restores scroll on back and forward. Navigation links are `createLink(MuiLink)`, which sets `aria-current="page"` on the active link.
  - The shell provides a skip link to `main`, `AppBar component="header"`, a labelled `nav` and `Container component="main" id="main" tabIndex={-1}` (A11Y-23).
  - Next.js: [05-building-block-view/nextjs.md](../../05-building-block-view/nextjs.md).
- **REACT-UI-31 (implements UI-17): Toasts are polite, short and never the only channel for an error or a required action.**
  - `Snackbar` with an action sets `autoHideDuration={null}`. Its content renders with `role="alert"` (assertive) by default; a snackbar is announced politely and once (through the announcer, with the content's role overridden via `slotProps.content`). The exact combination is to verify with a screen reader before first use.
  - `Alert` defaults to `role="alert"`: keep it for errors; success and info alerts set `role="status"`.
  - Every `CircularProgress` and `LinearProgress` has an `aria-label`; every `Table` has an accessible name (REACT-UI-23). Lazily loaded content announces its completion through the loading state's status region (REACT-UI-33).
- **REACT-UI-32 (implements UI-18): Dialogs use MUI `Dialog` with a `DialogTitle` that labels it** (MUI links them; the validated code also sets `aria-labelledby` from `useId()` on the `Dialog` and `id` on the `DialogTitle`, which is fine). MUI moves focus into the dialog and traps it. When the trigger may disappear (row cancelled, opened from a `Menu`), set `disableRestoreFocus` and restore focus in `slotProps={{ transition: { onExited } }}`: to the trigger if it is still connected (`trigger.isConnected`), otherwise to the page heading. The component test asserts the dialog's name and where focus lands after closing.
  ```tsx
  <Dialog open={open} onClose={onDismiss} aria-labelledby={titleId} disableRestoreFocus
          slotProps={{ transition: { onExited: restoreFocus } }} fullWidth>
  ```
- **REACT-UI-33 (implements UI-19): Loading, empty and error states are the shared components in `src/shared/ui/states/`:** `LoadingState` (a `role="status"` box with a labelled `CircularProgress` and the label as `visuallyHidden` text, `visuallyHidden` from `@mui/utils`), `EmptyState` (`Typography role="status"` with the message), `ErrorState` (`Alert severity="error"` with a retry `Button` in `action`). They take translated text as props and contain no feature logic (TS-ARCH-11). The page renders its `h1` outside the state branches, so the heading stays (A11Y-23); query state drives them (REACT-STATE-17).

### Tests

- **REACT-UI-34: Component tests interact with MUI widgets through roles and accessible names** (`getByRole('dialog', { name })`, `getByRole('textbox', { name: 'Reason' })`, `combobox`/`option` for `Select` and `Autocomplete`) with `user-event`; MUI has no test harnesses, and tests never query by MUI class names. Wait for dialog transitions with `waitFor`/`findBy`, not timers. `renderWithProviders` renders with the real theme ([testing/react.md](../testing/react.md)).
- **REACT-UI-35: Every theme variant is scanned:** light and dark (`colorScheme: 'dark'` project, verified), high contrast and forced colors on the shell through the theme projects of [TS-TEST-28](../testing/typescript-e2e.md#matrix) (A11Y-09, A11Y-28); axe fails on AA and on the adopted AAA `color-contrast-enhanced`. Scans per viewport: A11Y-17. Responsive structure is tested per [TS-TEST-17..21](../testing/typescript-e2e.md).

- **REACT-UI-36 (implements UI-21): A control that cannot be changed stays focusable and explained.** A grid cell or field the user may not edit now is `readOnly` (`slotProps.htmlInput.readOnly`) with `aria-describedby` pointing at a short reason, not `disabled`; `Dialog` forms with entered data guard `onClose` (`reason === 'backdropClick'` or `'escapeKeyDown'` with `formState.isDirty`) with a confirmation. A component test types into the form, presses Escape and asserts that the dialog stays.

## Skill overrides

| Skill | Says | Our rule |
|---|---|---|
| `material-ui-theming` | `InitColorSchemeScript` and Emotion `<style>` injection without a nonce | Default `media` selector needs no script; any inline script or style carries the CSP nonce through the Emotion cache (REACT-UI-04, REACT-UI-12, REACT-SEC-04) |
| `material-ui-theming` | Free palette choice, MUI default palette | AAA text contrast in both schemes, darkened light palette, all theme variants scanned (REACT-UI-07, REACT-UI-35, A11Y-09) |
| `material-ui-theming` / MUI docs | Roboto from Google Fonts | Fonts self-hosted or a system stack (REACT-UI-13, TS-SEC-07) |
| `material-ui-theming` | Color-scheme preference in `localStorage` | Allowed; never extended to tokens or personal data (REACT-UI-04, TS-SEC-01) |
| `material-ui-theming` | Theme defined or extended in feature code | One app theme in `src/shared/ui/theme.ts`; features use tokens (REACT-UI-04/05, TS-ARCH-11) |
| `material-ui-theming` | `responsiveFontSizes()` | Not used: type doesn't scale with the viewport (REACT-UI-11, UI-09) |
| `material-ui-styling` | Ad-hoc colors and px sizes in `sx`/`styled` | Theme tokens only, rem-based sizes (REACT-UI-05, REACT-UI-16) |
| `material-ui-styling` | Overriding focus and state styles | Visible focus and target size stay (REACT-UI-08/09, A11Y-10) |
| `material-ui-styling` | `GlobalStyles` or global CSS for component tweaks | Theme `components` overrides; global CSS only for element baselines (REACT-UI-03) |
| `material-ui-styling` | `ml`/`pr` shorthands and physical `left`/`right` | Logical properties (REACT-UI-22) |
| `material-ui-styling` (cross-links) | Tailwind interop | Tailwind is not used (REACT-UI-14) |
| Generic habit, shadcn/ui | Tailwind and shadcn/ui components | MUI (REACT-D5); a second component library needs an ADR (REACT-UI-02) |
| `accessibility` | Hand-rolled live region; Lighthouse as the automated check | `@react-aria/live-announcer` behind the `Announcer` context (REACT-UI-29); axe fixture (TS-TEST-12) |
| MUI docs | MUI default breakpoints (600/900/1200/1536) | Size-class breakpoints (REACT-UI-14) |
| Generic habit | Announce the new page on route change | Title and focus only (REACT-UI-30, A11Y-21) |

*Agent checklist in [checklists/react.md](../../checklists/react.md) and sources in [sources.md](../../sources.md), section "React UI: Material UI and Material Design".*
