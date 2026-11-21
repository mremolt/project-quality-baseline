'use client';

import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { useAppDispatch, useAppSelector } from '@/platform/index.client';

import type { Order } from '../../../domain/order';
import { useCancelOrder } from '../../../orders.tokens';
import {
  CancelOrderCommand,
  CancelOrderCommandSchema,
  type CancelOrderInput,
} from '../../../ports/in/cancel-order.use-case';
import { ordersQueryKeys } from './orders-queries';
import { cancelOrder, selectionCleared, selectOrdersView } from './orders-view.slice';

export function CancelOrderForm({ order }: { readonly order: Order }): ReactNode {
  const t = useTranslations('orders.cancel');
  const tErrors = useTranslations('orders');
  const useCase = useCancelOrder();
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const { cancelStatus, errorKey } = useAppSelector(selectOrdersView);
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CancelOrderInput>({
    resolver: standardSchemaResolver(CancelOrderCommandSchema),
    defaultValues: { orderId: order.id, reason: '' },
  });

  const submit = handleSubmit(async (input) => {
    const result = await dispatch(cancelOrder({ useCase, command: CancelOrderCommand.of(input) }));
    if (cancelOrder.fulfilled.match(result)) await queryClient.invalidateQueries({ queryKey: ordersQueryKeys.all });
  });

  return (
    <Dialog open onClose={() => dispatch(selectionCleared())} aria-labelledby="cancel-order-title">
      <form noValidate onSubmit={(event) => void submit(event)}>
        <DialogTitle id="cancel-order-title">{t('heading', { number: order.number })}</DialogTitle>
        <DialogContent>
          {errorKey && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {tErrors(errorKey)}
            </Alert>
          )}
          <Controller
            name="reason"
            control={control}
            render={({ field: { ref, ...field } }) => (
              <TextField
                {...field}
                inputRef={ref} // on the input, so focus moves to the first invalid field on submit (REACT-ARCH-14)
                label={t('reason')}
                required
                fullWidth
                margin="dense"
                multiline
                minRows={2}
                error={Boolean(errors.reason)}
                helperText={errors.reason ? t('reasonInvalid') : t('reasonHint')}
              />
            )}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => dispatch(selectionCleared())}>{t('close')}</Button>
          <Button type="submit" variant="contained" loading={cancelStatus === 'pending'}>
            {t('submit')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
