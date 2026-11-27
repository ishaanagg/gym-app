import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { resetBackNavigationForTests } from '../utils/backNavigation';

// Stub window.scrollTo so jsdom doesn't log unimplemented warnings during navigation tests
window.scrollTo = () => {};

afterEach(() => {
  cleanup();
  resetBackNavigationForTests();
});
