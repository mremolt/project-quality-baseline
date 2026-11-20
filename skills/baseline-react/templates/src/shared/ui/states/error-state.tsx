import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import type { ReactNode } from 'react';

interface ErrorStateProps {
  readonly message: string;
  readonly retryLabel: string;
  readonly onRetry: () => void;
}

/** UI-19: a load error in plain words with a retry button. */
export function ErrorState({ message, retryLabel, onRetry }: ErrorStateProps): ReactNode {
  return (
    <Alert
      severity="error"
      action={
        <Button color="inherit" onClick={onRetry}>
          {retryLabel}
        </Button>
      }
    >
      {message}
    </Alert>
  );
}
