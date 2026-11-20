// Deliberate type-only violation (TS-ARCH-13): a DTO in the domain
import type { OrderDto } from '../adapter/out/http/generated/model';

export type Order = OrderDto;
