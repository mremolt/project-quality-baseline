import { combineSlices, configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector } from 'react-redux';

/**
 * Feature slices add themselves by declaration merging through the platform's public entry, which re-exports this
 * type (REACT-STATE-02): `declare module '…/platform' { interface LazyLoadedSlices extends WithSlice<typeof slice> {} }`
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
