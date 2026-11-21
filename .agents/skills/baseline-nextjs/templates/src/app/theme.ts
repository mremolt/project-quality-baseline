'use client';

import { createTheme, type ThemeOptions } from '@mui/material/styles';

/**
 * One theme; light and dark via colorSchemes and CSS variables, following the OS preference.
 * The light palette is darker than MUI's default so text meets the adopted AAA contrast of 7:1 (A11Y-02).
 * Papers rendered on the server are `outlined`: an elevated Paper writes its shadow as an inline `style`
 * attribute, which the nonce-only `style-src` blocks.
 */
const options: ThemeOptions = {
  cssVariables: { colorSchemeSelector: 'media' },
  colorSchemes: {
    light: {
      palette: {
        primary: { main: '#0d47a1' },
        secondary: { main: '#6a1b9a' },
        text: { secondary: 'rgba(0, 0, 0, 0.7)' },
      },
    },
    dark: true,
  },
};

export const theme = createTheme(options);

/** For `prefers-reduced-motion: reduce` (WCAG 2.3.3): no CSS transitions, so dialogs and menus appear at once. */
export const reducedMotionTheme = createTheme({ ...options, transitions: { create: () => 'none' } });
