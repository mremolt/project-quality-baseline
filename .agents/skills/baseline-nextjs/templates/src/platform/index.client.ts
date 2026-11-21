// Public API of the platform for client code (React context, Redux, browser HTTP); never imported by server components.
export { listenForGlobalErrors } from './adapter/in/ui/global-error-listeners';
export { PublicConfigProvider, usePublicConfig } from './adapter/in/ui/public-config.client';
export { ReportErrorProvider, useReportError } from './adapter/in/ui/report-error.client';
export type { AppDispatch, AppStore, LazyLoadedSlices, RootState } from './adapter/in/ui/store';
export { makeStore, rootReducer, useAppDispatch, useAppSelector } from './adapter/in/ui/store';
export { StoreProvider } from './adapter/in/ui/store-provider.client';
export { configureHttp, type HttpSettings } from './adapter/out/http/browser-fetch';
export { HttpErrorReporting } from './adapter/out/http/http-error-reporting';
export { ReportErrorService } from './application/report-error.service';
export type { HttpFailureDetails, ReportErrorUseCase } from './ports/in/report-error.use-case';
