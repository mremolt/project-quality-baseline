import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import { useTranslations } from 'use-intl';

export function HomePage(): ReactNode {
  const t = useTranslations('app.home');
  return (
    <>
      <Typography variant="h4" component="h1" tabIndex={-1}>
        {t('title')}
      </Typography>
      <Typography sx={{ marginBlockStart: 2 }}>{t('intro')}</Typography>
    </>
  );
}

export function NotFoundPage(): ReactNode {
  const t = useTranslations('app.notFound');
  return (
    <>
      <Typography variant="h4" component="h1" tabIndex={-1}>
        {t('title')}
      </Typography>
      <Typography sx={{ marginBlockStart: 2 }}>{t('message')}</Typography>
    </>
  );
}
