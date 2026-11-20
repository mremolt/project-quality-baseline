import { combineSlices, configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector } from 'react-redux';

/**
 * Feature slices register here when their route chunk loads:
 * `declare module '…/platform/adapter/in/ui/app-store' { interface LazyLoadedSlices extends WithSlice<typeof slice> {} }`
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- filled by declaration merging from each feature slice
export interface LazyLoadedSlices {}

/** One app store; feature slices are injected lazily with `rootReducer.inject(slice)` from the feature composition. */
export const rootReducer = combineSlices().withLazyLoadedSlices<LazyLoadedSlices>();

function makeStore() {
  return configureStore({ reducer: rootReducer });
}

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = AppStore['dispatch'];

export function createAppStore(): AppStore {
  return makeStore();
}

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
