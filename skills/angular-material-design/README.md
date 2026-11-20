# angular-material-design

Our agent skill for building Angular UIs with Angular Material that follow Material Design 3 and the
baseline rules in `docs/baseline/08-crosscutting-concepts/ui/angular-material.md` (NG-UI-*) and `docs/baseline/10-quality-requirements/accessibility.md` (A11Y-*).

## Origin

Adapted from the `material-3` skill by CWTI Ltd (MIT):
[hamen/material-3-skill](https://github.com/hamen/material-3-skill), path `skills/material-3`, commit
`14385f2bf3804d8779f8b4db2604211f1e70b4c1`. License: [LICENSE.upstream](LICENSE.upstream).

## What changed

- **Kept** the platform-neutral MD3 content: color roles and pairing, tonal palettes, contrast levels,
  type scale, shape, elevation, motion values, window size classes, canonical layouts, navigation
  selection by window size, anti-patterns, the compliance-audit procedure, component usage guidance.
- **Replaced** `@material/web` (`<md-*>`, `--md-sys-*`) with Angular Material (`mat*` components,
  `mat.theme`, `--mat-sys-*`, `mat.<component>-overrides`, harnesses), with Angular code in our style
  (standalone, signals, built-in control flow, suffixless names, no Tailwind).
- **Dropped** Jetpack Compose, Flutter, Android Views, watch/XR and foldable-posture content; M3 Expressive
  reduced to a note on what Angular Material supports.
- **Added** our rules on top: rule-id citations, gap components in `src/shared/ui/` (NG-UI-02), high
  contrast via the theme-color schematic, WCAG 2.2 AA + adopted AAA checks in the audit, reduced motion,
  keyboard journey tests, and `references/screen-readers.md` (code for the announcer, route focus, form errors,
  screen reader tests; our own, no upstream counterpart).
- **Restructured** references: `color-and-theming.md`, `typography-shape-motion.md`,
  `layout-and-navigation.md`, `component-catalog.md` (upstream had six files, ~4000 lines).

## Checking upstream

```bash
npm run skills:upstream-diff angular-material-design
```

Shows what changed upstream since the recorded commit (full diff in `.skills-upstream/`). Merge useful
design-guidance changes by hand (translate any Compose / web code to Angular Material), then bump
`upstream-commit` in the SKILL.md frontmatter.

## API facts

Angular Material API names (theming mixins, `--mat-sys-*` tokens, override mixins, component inputs,
harness classes, `MATERIAL_ANIMATIONS`, CDK `Breakpoints`) were checked on **2026-11-20** against the
angular/components sources (main, 22.4.0-next) and the theming guides published on material.angular.dev
(`guides/theming.md`, `guides/theming-your-components.md`, theme-color schematic README). Re-check
them after each Angular Material major version.
