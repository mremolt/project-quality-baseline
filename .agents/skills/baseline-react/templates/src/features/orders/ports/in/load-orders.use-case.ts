import type { OrderPage } from '../../domain/order';

export interface LoadOrdersQuery {
  readonly page: number;
  readonly size: number;
}

export interface LoadOrdersUseCase {
  load(query: LoadOrdersQuery, signal?: AbortSignal): Promise<OrderPage>;
}
