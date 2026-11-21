'use client';

import { createContext, type ReactNode, use } from 'react';

import type { ReportErrorUseCase } from '../../../ports/in/report-error.use-case';

const ReportErrorContext = createContext<ReportErrorUseCase | null>(null);

/** The browser's report-error use case for client components and feature API providers (REACT-OBS-02). */
export function ReportErrorProvider({
  value,
  children,
}: {
  readonly value: ReportErrorUseCase;
  readonly children: ReactNode;
}): ReactNode {
  return <ReportErrorContext value={value}>{children}</ReportErrorContext>;
}

export function useReportError(): ReportErrorUseCase {
  const reportError = use(ReportErrorContext);
  if (!reportError) throw new Error('ReportErrorProvider missing');
  return reportError;
}
