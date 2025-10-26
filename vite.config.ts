import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export const sharedTestOptions = {
  globals: true,
  environment: 'jsdom',
  setupFiles: './vitest.setup.ts',
  coverage: {
    provider: 'istanbul' as const,
    reporter: ['text', 'lcov', 'json-summary'],
    include: ['src/**/*.{ts,tsx}'],
    exclude: ['src/main.tsx']
  }
};

export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/vlcd/' : '/',
  test: { ...sharedTestOptions }
}));
