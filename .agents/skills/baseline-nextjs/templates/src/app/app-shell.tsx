'use client';

import AppBar from '@mui/material/AppBar';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { usePublicConfig } from '@/platform/index.client';

export function AppShell({ children }: { readonly children: ReactNode }): ReactNode {
  const t = useTranslations('app');
  const { environmentLabel } = usePublicConfig();
  return (
    <>
      <AppBar position="static" component="header" variant="outlined">
        <Toolbar>
          <Typography component="p" variant="h6" sx={{ flexGrow: 1 }}>
            {t('title')}
          </Typography>
          {environmentLabel && <Chip label={t('environment', { label: environmentLabel })} color="secondary" />}
        </Toolbar>
      </AppBar>
      <Container component="main" sx={{ py: 3 }}>
        {children}
      </Container>
    </>
  );
}
