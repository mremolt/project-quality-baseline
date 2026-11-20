// Vitest runs without globals: register jest-dom and clean up by hand (REACT-TEST-03).
import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

beforeEach(() => {
  // The router's scroll restoration calls window.scrollTo, which jsdom does not implement (REACT-TEST-14).
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
