import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
});

// Mock global fetch to return empty arrays by default
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: false,
    json: () => Promise.resolve([]),
  })
);
