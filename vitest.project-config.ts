import { sharedTestOptions } from './vite.config';

export function createProjectTestOptions({ include, coverageInclude, environment }) {
  const test = structuredClone(sharedTestOptions);
  test.include = include;

  if (environment) {
    test.environment = environment;
  }

  if (coverageInclude) {
    test.coverage = { ...test.coverage, include: coverageInclude };
  }

  return test;
}
