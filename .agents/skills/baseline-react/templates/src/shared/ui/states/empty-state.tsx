import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';

/** UI-19: an empty result says so. */
export function EmptyState({ message }: { readonly message: string }): ReactNode {
  return (
    <Typography role="status" sx={{ paddingBlock: 4 }}>
      {message}
    </Typography>
  );
}
