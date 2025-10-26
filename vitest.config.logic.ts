import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

import { createProjectTestOptions } from './vitest.project-config';

const test = createProjectTestOptions({
  include: ['src/__tests__/modeling.test.ts', 'src/__tests__/storage.test.ts'],
  coverageInclude: ['src/lib/modeling.ts', 'src/lib/storage.ts']
});

export default defineConfig({
  plugins: [react()],
  test
});
