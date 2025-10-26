import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve } from 'node:path';

const DIST_INDEX = resolve('dist', 'index.html');
const EXPECTED_BASE = './';
const MODULE_SCRIPT_PATTERN = /<script\s+[^>]*type="module"[^>]*src="([^"]+)"/g;
const TYPESCRIPT_REFERENCE_PATTERN = /(src|href)="[^"]+\.(?:ts|tsx)(?:\?[^"']*)?"/i;

async function ensureDistIndexExists() {
  try {
    await access(DIST_INDEX, constants.R_OK);
  } catch (error) {
    console.error(`Expected build output not found at ${DIST_INDEX}. Did you run \`npm run build\`?`);
    throw error;
  }
}

async function verifyBasePaths() {
  await ensureDistIndexExists();
  const contents = await readFile(DIST_INDEX, 'utf8');

  const missing = [];

  const moduleScripts = [...contents.matchAll(MODULE_SCRIPT_PATTERN)].map(([, src]) => src);

  if (moduleScripts.length === 0) {
    missing.push('No module scripts were found in the build output.');
  }

  if (!contents.includes(`src="${EXPECTED_BASE}assets/`)) {
    missing.push('JavaScript bundle is not referenced with the expected base path.');
  }

  if (
    !contents.includes(`href="${EXPECTED_BASE}assets/`) &&
    !contents.includes(`href="${EXPECTED_BASE}vite.svg"`)
  ) {
    missing.push('Static assets are not referenced with the expected base path.');
  }

  if (TYPESCRIPT_REFERENCE_PATTERN.test(contents)) {
    missing.push('TypeScript sources are referenced directly instead of the compiled bundles.');
  }

  for (const scriptSrc of moduleScripts) {
    if (!scriptSrc.endsWith('.js')) {
      missing.push(`Module script ${scriptSrc} does not reference a JavaScript file.`);
    }
  }

  const invalidBundleReference = moduleScripts.find((src) => src.includes('src/main.ts'));
  if (invalidBundleReference) {
    missing.push(`Module script ${invalidBundleReference} references the source entrypoint instead of the compiled bundle.`);
  }

  if (missing.length > 0) {
    console.error('Deployment bundle verification failed:');
    for (const message of missing) {
      console.error(`  • ${message}`);
    }
    console.error('\nEnsure that the Vite build output references the compiled assets.');
    process.exit(1);
  }

  console.log('Deployment bundle verification passed.');
}

verifyBasePaths().catch((error) => {
  if (error instanceof Error) {
    console.error(error.message);
  }
  process.exit(1);
});
