import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import { visuallyHidden } from '@mui/utils';
import type { ReactNode } from 'react';

/** UI-19: labelled progress indicator inside a status region. */
export function LoadingState({ label }: { readonly label: string }): ReactNode {
  return (
    <Box role="status" sx={{ display: 'flex', justifyContent: 'center', paddingBlock: 4 }}>
      <CircularProgress aria-label={label} />
      <Box component="span" sx={visuallyHidden}>
        {label}
      </Box>
    </Box>
  );
}
