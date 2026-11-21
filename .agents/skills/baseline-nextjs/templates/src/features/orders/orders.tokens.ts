import { createContext, use } from 'react';

import type { CancelOrderUseCase } from './ports/in/cancel-order.use-case';
import type { ListOrdersUseCase } from './ports/in/list-orders.use-case';

export const ListOrdersContext = createContext<ListOrdersUseCase | null>(null);
export const CancelOrderContext = createContext<CancelOrderUseCase | null>(null);

function required<T>(value: T | null, name: string): T {
  if (value === null) throw new Error(`${name} is not provided; render the orders composition above this component`);
  return value;
}

export function useListOrders(): ListOrdersUseCase {
  return required(use(ListOrdersContext), 'ListOrdersUseCase');
}

export function useCancelOrder(): CancelOrderUseCase {
  return required(use(CancelOrderContext), 'CancelOrderUseCase');
}
