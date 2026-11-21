import { createAsyncThunk, createSlice, type PayloadAction, type WithSlice } from '@reduxjs/toolkit';

import type { RootState } from '@/platform/index.client';

import type { CancelOrderCommand, CancelOrderUseCase } from '../../../ports/in/cancel-order.use-case';
import { type OrdersErrorKey, ordersErrorKey } from './orders-error-keys';

export type CommandStatus = 'idle' | 'pending' | 'succeeded' | 'failed';

/** UI view state only: selection and command status. Orders themselves live in the TanStack Query cache. */
export interface OrdersViewState {
  readonly selectedOrderId: string | null;
  readonly cancelStatus: CommandStatus;
  readonly errorKey: OrdersErrorKey | null;
}

const initialState: OrdersViewState = { selectedOrderId: null, cancelStatus: 'idle', errorKey: null };

/** The use case comes from the component (which got it from the context hook); thunks import no adapters. */
export const cancelOrder = createAsyncThunk<
  undefined,
  { useCase: CancelOrderUseCase; command: CancelOrderCommand },
  { rejectValue: OrdersErrorKey }
>('ordersView/cancelOrder', async ({ useCase, command }, { rejectWithValue }) => {
  try {
    await useCase.cancelOrder(command);
    return undefined;
  } catch (error) {
    return rejectWithValue(ordersErrorKey(error));
  }
});

export const ordersViewSlice = createSlice({
  name: 'ordersView',
  initialState,
  reducers: {
    orderSelected(state, action: PayloadAction<string>) {
      state.selectedOrderId = action.payload;
      state.cancelStatus = 'idle';
      state.errorKey = null;
    },
    selectionCleared(state) {
      state.selectedOrderId = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(cancelOrder.pending, (state) => {
        state.cancelStatus = 'pending';
        state.errorKey = null;
      })
      .addCase(cancelOrder.fulfilled, (state) => {
        state.cancelStatus = 'succeeded';
        state.selectedOrderId = null;
      })
      .addCase(cancelOrder.rejected, (state, action) => {
        state.cancelStatus = 'failed';
        state.errorKey = action.payload ?? 'errors.technical';
      });
  },
});

declare module '@/platform/index.client' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- declaration merging adds the slice to the root state
  export interface LazyLoadedSlices extends WithSlice<typeof ordersViewSlice> {}
}

export const { orderSelected, selectionCleared } = ordersViewSlice.actions;

/** Works before the slice is injected or has seen its first action. */
export const selectOrdersView = (state: RootState): OrdersViewState => state.ordersView ?? initialState;
