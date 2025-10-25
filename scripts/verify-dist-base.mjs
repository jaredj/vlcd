import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve } from 'node:path';

const DIST_INDEX = resolve('dist', 'index.html');
const EXPECTED_BASE = '/vlcd/';

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

  if (!contents.includes(`src="${EXPECTED_BASE}assets/`)) {
    missing.push('JavaScript bundle is not referenced with the expected base path.');
  }

  if (!contents.includes(`href="${EXPECTED_BASE}assets/`) && !contents.includes(`href="${EXPECTED_BASE}vite.svg"`)) {
    missing.push('Static assets are not referenced with the expected base path.');
  }

  if (missing.length > 0) {
    console.error('Deployment bundle verification failed:');
    for (const message of missing) {
      console.error(`  • ${message}`);
    }
    console.error('\nEnsure that the Vite base path matches the GitHub Pages deployment path.');
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
