import { createSlice, type PayloadAction, type WithSlice } from '@reduxjs/toolkit';

import type { RootState } from '@/platform/index.client';

/**
 * View state that the panel and the cancel form share (REACT-STATE-04): the selected order, and the order just
 * cancelled, for the panel's status message. Orders live in the TanStack Query cache; the command's status and error
 * live in its mutation (REACT-STATE-03).
 */
export interface OrdersViewState {
  readonly selectedOrderId: string | null;
  readonly cancelledOrderId: string | null;
}

const initialState: OrdersViewState = { selectedOrderId: null, cancelledOrderId: null };

export const ordersViewSlice = createSlice({
  name: 'ordersView',
  initialState,
  reducers: {
    orderSelected(state, action: PayloadAction<string>) {
      state.selectedOrderId = action.payload;
      state.cancelledOrderId = null;
    },
    selectionCleared(state) {
      state.selectedOrderId = null;
    },
    orderCancelled(state, action: PayloadAction<string>) {
      state.selectedOrderId = null;
      state.cancelledOrderId = action.payload;
    },
  },
});

declare module '@/platform/index.client' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- declaration merging adds the slice to the root state
  export interface LazyLoadedSlices extends WithSlice<typeof ordersViewSlice> {}
}

export const { orderSelected, selectionCleared, orderCancelled } = ordersViewSlice.actions;

/** Works before the slice is injected or has seen its first action. */
export const selectOrdersView = (state: RootState): OrdersViewState => state.ordersView ?? initialState;
