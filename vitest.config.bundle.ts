import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

import { createProjectTestOptions } from './vitest.project-config';

const test = createProjectTestOptions({
  include: ['src/__tests__/build-output.test.ts'],
  environment: 'node'
});

test.coverage = { ...test.coverage, enabled: false };

export default defineConfig({
  plugins: [react()],
  test
});
