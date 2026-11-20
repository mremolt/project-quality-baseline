import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Button from '@mui/material/Button';
import type { ReactNode } from 'react';
import { useTranslations } from 'use-intl';

interface ErrorMessageProps {
  readonly onRetry?: () => void;
}

/** The generic message for unexpected errors; never shows error details (REACT-SEC-08). */
export function ErrorMessage({ onRetry }: ErrorMessageProps): ReactNode {
  const t = useTranslations('platform.error');
  return (
    <Alert
      severity="error"
      action={
        <Button
          color="inherit"
          onClick={
            onRetry ??
            (() => {
              window.location.reload();
            })
          }
        >
          {onRetry ? t('retry') : t('reload')}
        </Button>
      }
    >
      <AlertTitle>{t('title')}</AlertTitle>
      {t('message')}
    </Alert>
  );
}
