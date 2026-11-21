import { createContext, use } from 'react';

import type { CancelOrderUseCase } from './ports/in/cancel-order.use-case';
import type { LoadOrdersUseCase } from './ports/in/load-orders.use-case';

/** The feature's use cases, typed by their `ports/in` contracts; one object in one context (REACT-ARCH-09). */
export interface OrdersUseCases {
  readonly loadOrders: LoadOrdersUseCase;
  readonly cancelOrder: CancelOrderUseCase;
}

export const OrdersContext = createContext<OrdersUseCases | null>(null);

export function useOrdersUseCases(): OrdersUseCases {
  const useCases = use(OrdersContext);
  if (useCases === null) throw new Error('useOrdersUseCases used outside OrdersApiProvider');
  return useCases;
}

/** Selector hooks: what components and query hooks call (REACT-ARCH-09). */
export function useLoadOrders(): LoadOrdersUseCase {
  return useOrdersUseCases().loadOrders;
}

export function useCancelOrder(): CancelOrderUseCase {
  return useOrdersUseCases().cancelOrder;
}
