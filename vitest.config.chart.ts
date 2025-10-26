import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

import { createProjectTestOptions } from './vitest.project-config';

const test = createProjectTestOptions({
  include: ['src/__tests__/projectionChart.test.tsx'],
  coverageInclude: ['src/components/ProjectionChart.tsx']
});

export default defineConfig({
  plugins: [react()],
  test
});
