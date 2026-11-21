import { combineSlices, configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector } from 'react-redux';

/** Features add their view-state slice by module augmentation and inject it from their composition. */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- filled by declaration merging in each feature slice
export interface LazyLoadedSlices {}

export const rootReducer = combineSlices().withLazyLoadedSlices<LazyLoadedSlices>();

function createStore() {
  return configureStore({ reducer: rootReducer });
}

export type AppStore = ReturnType<typeof createStore>;

export function makeStore(): AppStore {
  return createStore();
}
export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = AppStore['dispatch'];

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
