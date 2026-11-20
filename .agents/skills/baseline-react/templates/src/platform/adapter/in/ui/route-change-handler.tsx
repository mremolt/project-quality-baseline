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

function focusMainHeading(): void {
  const main = document.querySelector<HTMLElement>('main');
  const target = main?.querySelector<HTMLElement>('h1') ?? main;
  target?.focus({ preventScroll: true });
}

/**
 * UI-16: sets "Page | App" as document title and, after each completed navigation that changed the
 * path, moves focus to the routed h1 (fallback `main`). Query-only changes and the first load keep focus.
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
    return router.subscribe('onRendered', ({ toLocation }) => {
      if (toLocation.pathname !== previousPath) focusMainHeading();
      previousPath = toLocation.pathname;
    });
  }, [router]);

  return null;
}
