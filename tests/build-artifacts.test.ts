/* @vitest-environment node */

import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { build } from 'vite';
import { describe, expect, test } from 'vitest';

const repoRoot = resolve('.');

async function createTempOutDir() {
  return mkdtemp(join(tmpdir(), 'vlcd-build-'));
}

describe('production bundle', () => {
  test('serves compiled JavaScript modules instead of TypeScript sources', async () => {
    const outDir = await createTempOutDir();

    try {
      await build({
        configFile: resolve(repoRoot, 'vite.config.ts'),
        build: { outDir },
        logLevel: 'silent',
      });

      const indexHtml = await readFile(join(outDir, 'index.html'), 'utf8');
      expect(indexHtml.includes('main.tsx')).toBe(false);
      expect(indexHtml).not.toMatch(/(src|href)="[^"]+\.(ts|tsx)(\?[^"']*)?"/i);

      const moduleSources = Array.from(
        indexHtml.matchAll(/<script\s+[^>]*type="module"[^>]*src="([^"]+)"/g),
        (match) => match[1]
      );

      expect(moduleSources.length).toBeGreaterThan(0);

      for (const src of moduleSources) {
        expect(src.endsWith('.js')).toBe(true);
        const normalized = src.replace(/^\.\//, '').replace(/^\//, '');
        const assetPath = join(outDir, normalized);
        await expect(access(assetPath)).resolves.toBeUndefined();
      }
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  }, 60_000);
});
