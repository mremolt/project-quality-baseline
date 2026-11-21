'use client';

import { type ReactNode, useState } from 'react';
import { Provider } from 'react-redux';

import { makeStore } from './store';

/**
 * One store per browser session (created once per mount of the root layout). On the server, every request
 * renders the providers anew, so each request gets its own store and no state leaks between users.
 */
export function StoreProvider({ children }: { readonly children: ReactNode }): ReactNode {
  const [store] = useState(makeStore);
  return <Provider store={store}>{children}</Provider>;
}
