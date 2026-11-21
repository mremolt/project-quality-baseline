'use client';
// limitation canary: the directive alone is invisible to dependency-cruiser, so this import is NOT reported
import { ordersServerUseCases } from '../../../orders.composition.server';

export const Widget = (): string => ordersServerUseCases();
