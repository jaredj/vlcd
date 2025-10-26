// @vitest-environment node

import { beforeAll, describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfigFromFile } from 'vite';
import type { UserConfig } from 'vite';

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testDir, '..', '..');

function resolveFromRoot(path: string): string {
  return resolve(repoRoot, path);
}

describe('production bundle configuration', () => {
  let config: UserConfig;
  let indexHtml = '';

  beforeAll(async () => {
    const loaded = await loadConfigFromFile({ command: 'build', mode: 'production' }, resolveFromRoot('vite.config.ts'));
    config = loaded?.config ?? {};
    indexHtml = readFileSync(resolveFromRoot('index.html'), 'utf8');
  });

  it('configures the GitHub Pages base path', () => {
    expect(config.base).toBe('/vlcd/');
  });

  it('only references static assets that exist in the repository', () => {
    const assetMatches = [...indexHtml.matchAll(/(?:src|href)="([^"]+)"/g)];
    const assetPaths = assetMatches
      .map((match) => match[1])
      .filter((value) => value.startsWith('.') || value.startsWith('/'));

    for (const asset of assetPaths) {
      const relative = asset.startsWith('./') ? asset.slice(2) : asset.replace(/^\//, '');
      const candidates = [resolveFromRoot(relative), resolveFromRoot(join('public', relative))];
      const found = candidates.some((candidate) => existsSync(candidate));
      expect(found).toBe(true);
    }
  });
});
