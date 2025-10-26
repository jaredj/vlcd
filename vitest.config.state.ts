import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

import { createProjectTestOptions } from './vitest.project-config';

const test = createProjectTestOptions({
  include: ['src/__tests__/state.test.tsx'],
  coverageInclude: ['src/lib/state.tsx']
});

export default defineConfig({
  plugins: [react()],
  test
});
