// @vitest-environment node

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { build } from 'vite';

describe('production bundle', () => {
  const basePath = '/vlcd/';
  let outDir: string;

  beforeAll(async () => {
    outDir = mkdtempSync(join(tmpdir(), 'vlcd-build-test-'));
    await build({
      configFile: resolve('vite.config.ts'),
      build: {
        outDir,
        emptyOutDir: true,
      },
      logLevel: 'silent',
    });
  }, 60000);

  afterAll(() => {
    if (outDir) {
      rmSync(outDir, { recursive: true, force: true });
    }
  });

  function readDistIndex(): string {
    return readFileSync(join(outDir, 'index.html'), 'utf8');
  }

  it('references JavaScript bundles using the GitHub Pages base path', () => {
    const html = readDistIndex();
    expect(html).toContain(`src="${basePath}assets/`);
  });

  it('only references static assets that exist in the bundle', () => {
    const html = readDistIndex();
    const assetMatches = [...html.matchAll(/(?:src|href)="([^"]+)"/g)];
    const assetPaths = assetMatches
      .map((match) => match[1])
      .filter((value) => value.startsWith(basePath) || value.startsWith('./'));

    for (const asset of assetPaths) {
      const relative = asset.startsWith(basePath) ? asset.slice(basePath.length) : asset.replace(/^\.\//, '');
      const assetFile = join(outDir, relative);
      expect(existsSync(assetFile)).toBe(true);
    }
  });
});
