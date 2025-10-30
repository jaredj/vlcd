import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve } from 'node:path';

const ROOT_INDEX = resolve('index.html');
const DIST_INDEX = resolve('dist', 'index.html');
const EXPECTED_BASE = './';
const DEV_ENTRYPOINT = '/src/main.tsx';
const INVALID_RELATIVE_ENTRYPOINT = './src/main.tsx';

async function ensureDistIndexExists() {
  try {
    await access(DIST_INDEX, constants.R_OK);
  } catch (error) {
    console.error(`Expected build output not found at ${DIST_INDEX}. Did you run \`npm run build\`?`);
    throw error;
  }
}

async function verifyBasePaths() {
  const rootIndexContents = await readFile(ROOT_INDEX, 'utf8');

  if (!rootIndexContents.includes(`src="${DEV_ENTRYPOINT}"`)) {
    console.error('Deployment bundle verification failed:');
    console.error(`  • Root index.html must reference the dev entrypoint as \`${DEV_ENTRYPOINT}\`.`);
    console.error('\nEnsure that the Vite dev entrypoint uses an absolute path so Vite can intercept it.');
    process.exit(1);
  }

  if (rootIndexContents.includes(`src="${INVALID_RELATIVE_ENTRYPOINT}"`)) {
    console.error('Deployment bundle verification failed:');
    console.error('  • Root index.html references the TypeScript entrypoint via a relative path.');
    console.error('\nEnsure that the Vite dev entrypoint uses an absolute path so Vite can intercept it.');
    process.exit(1);
  }

  await ensureDistIndexExists();
  const contents = await readFile(DIST_INDEX, 'utf8');

  const missing = [];
  const typeScriptReferencePattern = /=("|')(?<path>[^"']+\.(?:ts|tsx))(\1)/gi;

  if (!contents.includes(`src="${EXPECTED_BASE}assets/`)) {
    missing.push('JavaScript bundle is not referenced with the expected base path.');
  }

  if (
    !contents.includes(`href="${EXPECTED_BASE}assets/`) &&
    !contents.includes(`href="${EXPECTED_BASE}vite.svg"`)
  ) {
    missing.push('Static assets are not referenced with the expected base path.');
  }

  const typeScriptReferences = Array.from(contents.matchAll(typeScriptReferencePattern), ({ groups }) => groups?.path).filter(
    Boolean,
  );

  if (typeScriptReferences.length > 0) {
    missing.push(
      `Found TypeScript asset references in build output: ${typeScriptReferences
        .map((path) => `"${path}"`)
        .join(', ')}.`,
    );
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
