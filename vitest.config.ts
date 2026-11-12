import { defineConfig } from 'vitest/config';

// Kept separate from vite.config.ts so the CRX plugin isn't loaded during tests.
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
    restoreMocks: true,
  },
});

