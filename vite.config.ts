import * as os from 'node:os';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const availableCpus = typeof os.availableParallelism === 'function' ? os.availableParallelism() : os.cpus().length;
const maxThreads = Math.max(1, availableCpus * 4);

export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/vlcd/' : '/',
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './vitest.setup.ts',
    pool: 'threads',
    poolOptions: {
      threads: {
        minThreads: 1,
        maxThreads,
      },
    },
    coverage: {
      provider: 'istanbul',
      reporter: ['text', 'lcov', 'json-summary'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/main.tsx'],
      thresholds: {
        lines: 0.8,
        statements: 0.8,
        branches: 0.7,
        functions: 0.8
      }
    }
  }
}));
