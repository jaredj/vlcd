/* eslint-env node */
/* vitest-environment node */

import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import process from 'node:process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, test } from 'vitest';

const BUILD_TIMEOUT_MS = 120_000;

test(
  'production build references compiled JavaScript bundles',
  async () => {
    const outDir = await mkdtemp(path.join(tmpdir(), 'vlcd-build-'));
    try {
      const projectRoot = process.cwd();
      const configFile = path.resolve(projectRoot, 'vite.config.ts');
      const viteBin = path.resolve(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js');
      execFileSync(
        'node',
        [viteBin, 'build', '--config', configFile, '--mode', 'production', '--outDir', outDir],
        {
          stdio: 'ignore',
        },
      );

      const indexHtml = await readFile(path.join(outDir, 'index.html'), 'utf8');

      expect(indexHtml).not.toMatch(/\.(ts|tsx)["']/i);
      expect(indexHtml).toMatch(/assets\/.+\.js["']/);
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  },
  BUILD_TIMEOUT_MS,
);
