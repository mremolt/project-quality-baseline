import { announce } from '@react-aria/live-announcer';
import { createContext, use } from 'react';

/** UI-15: the one way to announce a status message that has no visible status region. */
export interface Announcer {
  announce(message: string): void;
}

const liveRegionAnnouncer: Announcer = {
  announce: (message) => {
    announce(message, 'polite');
  },
};

/** Defaults to the live-region implementation; component tests provide a mock. */
export const AnnouncerContext = createContext<Announcer>(liveRegionAnnouncer);

export function useAnnouncer(): Announcer {
  return use(AnnouncerContext);
}
