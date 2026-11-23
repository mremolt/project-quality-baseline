import { useRouter, useRouterState } from '@tanstack/react-router';
import { useEffect } from 'react';
import { type MessageKeys, type Messages, type NestedKeyOf, useTranslations } from 'use-intl';

export type TitleKey = MessageKeys<Messages, NestedKeyOf<Messages>>;

declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    /** Every route names its title (UI-16, A11Y-21). */
    readonly titleKey: TitleKey;
  }
}

declare module '@tanstack/history' {
  interface HistoryState {
    /** Set by an in-page control of the same route (a prev/next pager): focus stays on it (UI-16, A11Y-21). */
    readonly keepFocus?: boolean;
  }
}

function focusMainHeading(): void {
  const main = document.querySelector<HTMLElement>('main');
  const target = main?.querySelector<HTMLElement>('h1') ?? main;
  target?.focus({ preventScroll: true });
}

/**
 * UI-16: sets "Page | App" as document title and, after each completed navigation that changed the
 * path, moves focus to the routed h1 (fallback `main`). Query-only changes, the first load, replace navigations
 * (the page canonicalising its own URL) and navigations with `state: { keepFocus: true }` (a same-route pager) keep focus.
 */
export function RouteChangeHandler(): null {
  const router = useRouter();
  const t = useTranslations();
  const titleKey = useRouterState({ select: (state) => state.matches.at(-1)?.staticData.titleKey });

  useEffect(() => {
    if (titleKey !== undefined) document.title = t('platform.documentTitle', { page: t(titleKey) });
  }, [t, titleKey]);

  useEffect(() => {
    let previousPath = router.state.location.pathname;
    let lastAction: string | undefined;
    const stopHistory = router.history.subscribe(({ action }: { readonly action: { readonly type: string } }) => {
      lastAction = action.type;
    });
    const stopRendered = router.subscribe('onRendered', ({ toLocation }) => {
      const keepFocus = lastAction === 'REPLACE' || toLocation.state.keepFocus === true;
      if (toLocation.pathname !== previousPath && !keepFocus) focusMainHeading();
      previousPath = toLocation.pathname;
    });
    return () => {
      stopHistory();
      stopRendered();
    };
  }, [router]);

  return null;
}
