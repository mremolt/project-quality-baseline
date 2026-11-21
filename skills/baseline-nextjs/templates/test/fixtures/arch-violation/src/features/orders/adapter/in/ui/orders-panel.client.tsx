'use client';
// canary: a client file importing a server-only module
import { ordersServerUseCases } from '../../../orders.composition.server';

export const Panel = (): string => ordersServerUseCases();
