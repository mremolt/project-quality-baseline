import type { ReportErrorUseCase } from '../../../ports/in/report-error.use-case';

/** Forwards errors that escape React and the router to the one reporting path (REACT-OBS-01). */
export function listenForGlobalErrors(reportError: ReportErrorUseCase): () => void {
  const onError = (event: ErrorEvent) => {
    reportError.report(event.error ?? event.message);
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    reportError.report(event.reason);
  };
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  return () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
  };
}
