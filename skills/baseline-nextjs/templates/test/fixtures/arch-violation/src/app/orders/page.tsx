// canary: a route file with a deep import instead of the feature's pages file
import type { OrderDto } from '../../features/orders/adapter/out/http/generated/model';

export default function Page(): OrderDto {
  return { id: 'o-1' };
}
