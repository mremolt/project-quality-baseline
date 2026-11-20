import { createContext, use } from 'react';

import type { ReportErrorUseCase } from './ports/in/report-error.use-case';
import type { RuntimeConfig } from './ports/out/runtime-config.port';

export const RuntimeConfigContext = createContext<Readonly<RuntimeConfig> | null>(null);
export const ReportErrorContext = createContext<ReportErrorUseCase | null>(null);

function provided<T>(value: T | null, hook: string): T {
  if (value === null) throw new Error(`${hook} used outside PlatformProvider`);
  return value;
}

export function useRuntimeConfig(): Readonly<RuntimeConfig> {
  return provided(use(RuntimeConfigContext), 'useRuntimeConfig');
}

export function useReportError(): ReportErrorUseCase {
  return provided(use(ReportErrorContext), 'useReportError');
}
