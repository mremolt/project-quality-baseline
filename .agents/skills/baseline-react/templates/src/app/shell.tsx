import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import MuiLink from '@mui/material/Link';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { createLink, Outlet } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useTranslations } from 'use-intl';

import { RouteChangeHandler } from '../platform';

const NavLink = createLink(MuiLink);

/** App shell: banner, main navigation, main landmark with the routed page (A11Y-23). */
export function Shell(): ReactNode {
  const t = useTranslations('app');
  return (
    <>
      <MuiLink
        href="#main"
        sx={{
          position: 'absolute',
          insetInlineStart: (theme) => theme.spacing(1),
          insetBlockStart: (theme) => theme.spacing(-6),
          padding: 1,
          backgroundColor: 'background.paper',
          zIndex: 'tooltip',
          '&:focus': { insetBlockStart: (theme) => theme.spacing(1) },
        }}
      >
        {t('skipToContent')}
      </MuiLink>
      <AppBar position="static" component="header">
        <Toolbar sx={{ gap: 3 }}>
          <Typography component="p" variant="h6">
            {t('name')}
          </Typography>
          <Box component="nav" aria-label={t('nav.label')} sx={{ display: 'flex', gap: 2 }}>
            <NavLink to="/" color="inherit" activeOptions={{ exact: true }}>
              {t('nav.home')}
            </NavLink>
            <NavLink to="/orders" color="inherit">
              {t('nav.orders')}
            </NavLink>
          </Box>
        </Toolbar>
      </AppBar>
      <Container component="main" id="main" tabIndex={-1} sx={{ paddingBlock: 3 }}>
        <Outlet />
      </Container>
      <RouteChangeHandler />
    </>
  );
}
