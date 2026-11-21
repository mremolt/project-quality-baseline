import { useMutation, type UseMutationResult, useQueryClient } from '@tanstack/react-query';

import { useReportError } from '@/platform/index.client';

import { useCancelOrder } from '../../../orders.tokens';
import type { CancelOrderCommand } from '../../../ports/in/cancel-order.use-case';
import { isUnexpected } from './orders-error-keys';

/** Query keys of the feature; invalidate `all` after a command. */
export const ordersQueryKeys = {
  all: ['orders'] as const,
  list: () => [...ordersQueryKeys.all, 'list'] as const,
};

/**
 * The cancel command (REACT-STATE-03): `mutationFn` calls the use case, a success invalidates the orders queries, the
 * component maps `error` with `ordersErrorKey`. Only an unexpected error is reported here (REACT-STATE-07).
 */
export function useCancelOrderMutation(): UseMutationResult<void, Error, CancelOrderCommand> {
  const cancelOrder = useCancelOrder();
  const queryClient = useQueryClient();
  const reportError = useReportError();
  return useMutation({
    mutationFn: (command: CancelOrderCommand) => cancelOrder.cancelOrder(command),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ordersQueryKeys.all }),
    onError: (error) => {
      if (isUnexpected(error)) reportError.report(error);
    },
  });
}
