'use client';

import { createContext, type ReactNode, use } from 'react';

import type { PublicConfig } from '../../../config/public-config';

const PublicConfigContext = createContext<PublicConfig | null>(null);

/** Runtime configuration for client components, passed in by the root layout (CFG-11); never `NEXT_PUBLIC_*`. */
export function PublicConfigProvider({
  value,
  children,
}: {
  readonly value: PublicConfig;
  readonly children: ReactNode;
}): ReactNode {
  return <PublicConfigContext value={value}>{children}</PublicConfigContext>;
}

export function usePublicConfig(): PublicConfig {
  const config = use(PublicConfigContext);
  if (!config) throw new Error('PublicConfigProvider missing');
  return config;
}
