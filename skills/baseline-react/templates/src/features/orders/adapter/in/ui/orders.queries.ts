import { keepPreviousData, queryOptions, useQuery, type UseQueryResult } from '@tanstack/react-query';

import type { OrderPage } from '../../../domain/order';
import { useLoadOrdersUseCase } from '../../../orders.tokens';

export const ORDERS_PAGE_SIZE = 20;

/** Query keys of the feature; commands invalidate `ordersKeys.all`. */
export const ordersKeys = {
  all: ['orders'] as const,
  page: (page: number) => ['orders', 'page', { page, size: ORDERS_PAGE_SIZE }] as const,
};

/** Server state through the use case; the cache holds domain types only. */
export function useOrdersPage(page: number): UseQueryResult<OrderPage> {
  const loadOrders = useLoadOrdersUseCase();
  return useQuery(
    queryOptions({
      queryKey: ordersKeys.page(page),
      queryFn: ({ signal }) => loadOrders.load({ page, size: ORDERS_PAGE_SIZE }, signal),
      placeholderData: keepPreviousData,
    }),
  );
}
