import { createTheme, enhanceHighContrast } from '@mui/material/styles';

/**
 * The one app theme (REACT-UI-04): light and dark color schemes as CSS variables; the scheme follows
 * `prefers-color-scheme`. Darker primary and secondary text than the MUI defaults, so text meets the adopted AAA
 * contrast in both schemes (REACT-UI-07; checked by axe in the light and dark E2E projects).
 *
 * Verify before first use: the options marked below compile and render, but their effect was not asserted in the
 * validation project (no forced-colors, high-contrast, text-size or reduced-motion test ran against them).
 */
export const theme = enhanceHighContrast(
  // verify before first use: forced-colors overrides from enhanceHighContrast (A11Y-28, stubbed-forced-colors)
  createTheme({
    cssVariables: true,
    colorSchemes: {
      light: { palette: { primary: { main: '#0d47a1' }, text: { secondary: 'rgba(0, 0, 0, 0.72)' } } },
      dark: { palette: { primary: { main: '#90caf9' } } },
    },
    breakpoints: { values: { xs: 0, sm: 600, md: 840, lg: 1200, xl: 1600 } }, // window size classes (REACT-UI-14)
    // verify before first use: rem spacing follows the user's text size (REACT-UI-16); no 200 % text-size test yet
    spacing: (factor: number) => `${String(0.5 * factor)}rem`,
    // verify before first use: transitions off under prefers-reduced-motion (REACT-UI-10); E2E sets reducedMotion only
    motion: { reducedMotion: 'system' },
    // verify before first use: visible keyboard focus ring on every ButtonBase (REACT-UI-09); no focus-indicator assertion yet
    focusVisible: true,
  }),
);
