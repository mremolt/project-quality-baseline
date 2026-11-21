import { createSlice, type PayloadAction, type WithSlice } from '@reduxjs/toolkit';

import type { RootState } from '../../../../../platform';

/**
 * Cross-component view state only (REACT-STATE-04): which order the cancel dialog is for, set by the table's button
 * and read by the page and the dialog. Orders live in the TanStack Query cache; the cancel command's status and error
 * live in its mutation (REACT-STATE-03).
 */
export interface OrdersViewState {
  readonly cancelOrderId: string | null;
}

const initialState: OrdersViewState = { cancelOrderId: null };

export const ordersSlice = createSlice({
  name: 'orders',
  initialState,
  reducers: {
    cancelRequested(state, action: PayloadAction<string>) {
      state.cancelOrderId = action.payload;
    },
    cancelClosed(state) {
      state.cancelOrderId = null;
    },
  },
});

export const { cancelRequested, cancelClosed } = ordersSlice.actions;

// Typed through the platform's public API (REACT-STATE-02): `src/platform/index.ts` re-exports `LazyLoadedSlices`.
declare module '../../../../../platform' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- RTK lazy-slice typing by declaration merging
  interface LazyLoadedSlices extends WithSlice<typeof ordersSlice> {}
}

/** The composition injects the slice when the route chunk loads; until the first action the key is absent. */
export function selectOrdersView(state: RootState): OrdersViewState {
  return state.orders ?? initialState;
}
