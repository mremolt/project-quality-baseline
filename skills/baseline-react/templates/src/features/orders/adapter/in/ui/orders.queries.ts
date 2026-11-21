import {
  keepPreviousData,
  queryOptions,
  useMutation,
  type UseMutationResult,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';

import { useReportError } from '../../../../../platform';
import type { Order, OrderPage } from '../../../domain/order';
import { useCancelOrder, useLoadOrders } from '../../../orders.tokens';
import type { CancelOrderCommand } from '../../../ports/in/cancel-order.use-case';
import { isUnexpected } from './orders-error-keys';

export const ORDERS_PAGE_SIZE = 20;

/** Query keys of the feature; commands invalidate `ordersKeys.all`. */
export const ordersKeys = {
  all: ['orders'] as const,
  page: (page: number) => ['orders', 'page', { page, size: ORDERS_PAGE_SIZE }] as const,
};

/** Server state through the use case; the cache holds domain types only. */
export function useOrdersPage(page: number): UseQueryResult<OrderPage> {
  const loadOrders = useLoadOrders();
  return useQuery(
    queryOptions({
      queryKey: ordersKeys.page(page),
      queryFn: ({ signal }) => loadOrders.load({ page, size: ORDERS_PAGE_SIZE }, signal),
      placeholderData: keepPreviousData,
    }),
  );
}

/**
 * The cancel command (REACT-STATE-03): `mutationFn` calls the use case, a success invalidates the feature's queries,
 * the component maps `error` with `toErrorKey`. An error that is neither a domain error nor a `TechnicalError` is a bug
 * and is reported here (REACT-STATE-07); a `TechnicalError` was reported where it was created (TS-ARCH-18).
 */
export function useCancelOrderMutation(): UseMutationResult<Order, Error, CancelOrderCommand> {
  const cancelOrder = useCancelOrder();
  const queryClient = useQueryClient();
  const reportError = useReportError();
  return useMutation({
    mutationFn: (command: CancelOrderCommand) => cancelOrder.cancel(command),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ordersKeys.all }),
    onError: (error) => {
      if (isUnexpected(error)) reportError.report(error);
    },
  });
}
