import { createContext, use } from 'react';

import type { CancelOrderUseCase } from './ports/in/cancel-order.use-case';
import type { LoadOrdersUseCase } from './ports/in/load-orders.use-case';

export const LoadOrdersContext = createContext<LoadOrdersUseCase | null>(null);
export const CancelOrderContext = createContext<CancelOrderUseCase | null>(null);

function provided<T>(useCase: T | null, hook: string): T {
  if (useCase === null) throw new Error(`${hook} used outside OrdersProvider or OrdersApiProvider`);
  return useCase;
}

export function useLoadOrdersUseCase(): LoadOrdersUseCase {
  return provided(use(LoadOrdersContext), 'useLoadOrdersUseCase');
}

export function useCancelOrderUseCase(): CancelOrderUseCase {
  return provided(use(CancelOrderContext), 'useCancelOrderUseCase');
}
