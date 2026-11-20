import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import { type ReactNode, useId } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslations } from 'use-intl';

import type { Order } from '../../../domain/order';
import { CancelOrderCommand, CancelOrderSchema } from '../../../ports/in/cancel-order.use-case';
import type { OrdersErrorKey } from './orders-error-keys';

interface CancelOrderFormProps {
  readonly order: Order;
  readonly pending: boolean;
  readonly errorKey: OrdersErrorKey | null;
  readonly onSubmit: (command: CancelOrderCommand) => void;
  readonly onDismiss: () => void;
  readonly titleId: string;
}

function CancelOrderForm({ order, pending, errorKey, onSubmit, onDismiss, titleId }: CancelOrderFormProps) {
  const t = useTranslations('orders');
  const { control, handleSubmit } = useForm({
    resolver: standardSchemaResolver(CancelOrderSchema),
    defaultValues: { orderId: order.id, reason: '' },
  });
  const submit = handleSubmit((values) => {
    onSubmit(CancelOrderCommand.of(values));
  });

  return (
    <form noValidate onSubmit={(event) => void submit(event)}>
      <DialogTitle id={titleId}>{t('cancel.title', { number: order.number })}</DialogTitle>
      <DialogContent>
        {errorKey && (
          <Alert severity="error" sx={{ marginBlockEnd: 2 }}>
            {t(`errors.${errorKey}`)}
          </Alert>
        )}
        <Controller
          name="reason"
          control={control}
          render={({ field: { ref, ...field }, fieldState }) => (
            <TextField
              {...field}
              inputRef={ref} // on the input, so focus moves to the first invalid field on submit (REACT-ARCH-14)
              label={t('cancel.reason')}
              helperText={fieldState.error ? t('cancel.reasonInvalid') : t('cancel.reasonHelp')}
              error={fieldState.error !== undefined}
              required
              fullWidth
              autoComplete="off"
            />
          )}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onDismiss}>{t('cancel.dismiss')}</Button>
        <Button type="submit" variant="contained" loading={pending}>
          {t('cancel.submit')}
        </Button>
      </DialogActions>
    </form>
  );
}

interface CancelOrderDialogProps extends Omit<CancelOrderFormProps, 'order' | 'titleId'> {
  readonly order: Order | null;
  readonly open: boolean;
  readonly onExited: () => void;
}

/** UI-18: labelled by its title; focus is restored by the page in `onExited`, because the trigger may be gone. */
export function CancelOrderDialog({ order, open, onExited, onDismiss, ...form }: CancelOrderDialogProps): ReactNode {
  const titleId = useId();
  return (
    <Dialog
      open={open && order !== null}
      onClose={onDismiss}
      aria-labelledby={titleId}
      disableRestoreFocus
      slotProps={{ transition: { onExited } }}
      fullWidth
    >
      {order && <CancelOrderForm key={order.id} order={order} titleId={titleId} onDismiss={onDismiss} {...form} />}
    </Dialog>
  );
}
