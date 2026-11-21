import type { z } from 'zod';

import type { Order } from '../../../domain/order';
import type { ListOrdersResponse } from './generated/zod/orders/orders.zod';

type OrderDto = z.output<typeof ListOrdersResponse>['items'][number];

export function toOrder(dto: OrderDto): Order {
  return {
    id: dto.id,
    number: dto.number,
    status: dto.status,
    total: { amount: dto.total, currency: dto.currency },
    placedAt: new Date(dto.placedAt),
  };
}
