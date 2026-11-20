import { createAsyncThunk, createSlice, type PayloadAction, type WithSlice } from '@reduxjs/toolkit';

import type { RootState } from '../../../../../platform';
import type { CancelOrderCommand, CancelOrderUseCase } from '../../../ports/in/cancel-order.use-case';
import { type OrdersErrorKey, toErrorKey } from './orders-error-keys';

/** View state only: which order the dialog is for, command status, mapped error key. Orders live in TanStack Query. */
export interface OrdersViewState {
  readonly cancelOrderId: string | null;
  readonly cancelStatus: 'idle' | 'pending' | 'succeeded' | 'failed';
  readonly cancelError: OrdersErrorKey | null;
}

const initialState: OrdersViewState = { cancelOrderId: null, cancelStatus: 'idle', cancelError: null };

/** The component passes the use case it got from the context hook; the thunk never imports adapters or composition. */
export const cancelOrder = createAsyncThunk<
  undefined,
  { readonly useCase: CancelOrderUseCase; readonly command: CancelOrderCommand },
  { rejectValue: OrdersErrorKey }
>('orders/cancelOrder', async ({ useCase, command }, { rejectWithValue, signal }) => {
  try {
    await useCase.cancel(command, signal);
    return undefined;
  } catch (error) {
    return rejectWithValue(toErrorKey(error));
  }
});

export const ordersSlice = createSlice({
  name: 'orders',
  initialState,
  reducers: {
    cancelRequested(state, action: PayloadAction<string>) {
      state.cancelOrderId = action.payload;
      state.cancelStatus = 'idle';
      state.cancelError = null;
    },
    cancelDismissed(state) {
      state.cancelOrderId = null;
      state.cancelStatus = 'idle';
      state.cancelError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(cancelOrder.pending, (state) => {
        state.cancelStatus = 'pending';
        state.cancelError = null;
      })
      .addCase(cancelOrder.fulfilled, (state) => {
        state.cancelOrderId = null;
        state.cancelStatus = 'succeeded';
      })
      .addCase(cancelOrder.rejected, (state, action) => {
        state.cancelStatus = 'failed';
        state.cancelError = action.payload ?? 'technical';
      });
  },
});

export const { cancelRequested, cancelDismissed } = ordersSlice.actions;

declare module '../../../../../platform/adapter/in/ui/app-store' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- RTK lazy-slice typing by declaration merging
  interface LazyLoadedSlices extends WithSlice<typeof ordersSlice> {}
}

/** The composition injects the slice when the route chunk loads; until the first action the key is absent. */
export function selectOrdersView(state: RootState): OrdersViewState {
  return state.orders ?? initialState;
}
