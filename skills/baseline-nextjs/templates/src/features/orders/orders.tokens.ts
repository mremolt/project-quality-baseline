import { createContext, use } from 'react';

import type { CancelOrderUseCase } from './ports/in/cancel-order.use-case';
import type { ListOrdersUseCase } from './ports/in/list-orders.use-case';

/** The feature's browser use cases, typed by their `ports/in` contracts; one object in one context (REACT-ARCH-09). */
export interface OrdersUseCases {
  readonly listOrders: ListOrdersUseCase;
  readonly cancelOrder: CancelOrderUseCase;
}

export const OrdersContext = createContext<OrdersUseCases | null>(null);

export function useOrdersUseCases(): OrdersUseCases {
  const useCases = use(OrdersContext);
  if (useCases === null) throw new Error('OrdersUseCases are not provided; render OrdersApiProvider above');
  return useCases;
}

/** Selector hooks: what client components and query hooks call (REACT-ARCH-09). */
export function useListOrders(): ListOrdersUseCase {
  return useOrdersUseCases().listOrders;
}

export function useCancelOrder(): CancelOrderUseCase {
  return useOrdersUseCases().cancelOrder;
}
