import { createTheme, enhanceHighContrast } from '@mui/material/styles';

/**
 * The one app theme (REACT-UI-04): light and dark color schemes as CSS variables; the scheme follows
 * `prefers-color-scheme`. Darker primary and secondary text than the MUI defaults, so text meets the adopted AAA
 * contrast in both schemes (REACT-UI-07); forced-colors overrides from `enhanceHighContrast` (A11Y-28).
 */
export const theme = enhanceHighContrast(
  createTheme({
    cssVariables: true,
    colorSchemes: {
      light: { palette: { primary: { main: '#0d47a1' }, text: { secondary: 'rgba(0, 0, 0, 0.72)' } } },
      dark: { palette: { primary: { main: '#90caf9' } } },
    },
    breakpoints: { values: { xs: 0, sm: 600, md: 840, lg: 1200, xl: 1600 } }, // window size classes (REACT-UI-14)
    spacing: (factor: number) => `${String(0.5 * factor)}rem`, // follows the user's text size (REACT-UI-16)
    motion: { reducedMotion: 'system' }, // REACT-UI-10
    focusVisible: true, // visible keyboard focus ring on every ButtonBase (REACT-UI-09)
  }),
);
