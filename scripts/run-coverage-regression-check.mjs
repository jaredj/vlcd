#!/usr/bin/env node

import { appendFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execSync, spawnSync } from 'node:child_process';

const metrics = ['lines', 'statements', 'branches', 'functions'];
const epsilon = 1e-6;
const repoRoot = process.cwd();
const baseRef = process.env.COVERAGE_BASE_REF || 'origin/main';
const skipBase = process.env.COVERAGE_SKIP_BASE === '1';
const headSummaryEnv = process.env.COVERAGE_HEAD_SUMMARY;
const reportPath = process.env.COVERAGE_REPORT_PATH;
const stepSummaryPath = process.env.GITHUB_STEP_SUMMARY;

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    env: { ...process.env, ...options.env },
    cwd: options.cwd ?? repoRoot,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(' ')}`);
  }
}

function ensureCoverageSummary(cwd) {
  const coverageDir = path.join(cwd, 'coverage');
  rmSync(coverageDir, { recursive: true, force: true });

  run(
    'npx',
    [
      'vitest',
      'run',
      '--coverage',
      '--coverage.reporter=text',
      '--coverage.reporter=lcov',
      '--coverage.reporter=json-summary',
    ],
    { cwd }
  );

  const summaryPath = path.join(coverageDir, 'coverage-summary.json');
  if (!existsSync(summaryPath)) {
    throw new Error(`Coverage summary not found at ${summaryPath}`);
  }

  return readCoverageSummary(summaryPath, cwd);
}

function readCoverageSummary(summaryPath, rootDir) {
  const raw = JSON.parse(readFileSync(summaryPath, 'utf8'));
  const files = {};

  for (const [filePath, data] of Object.entries(raw)) {
    if (filePath === 'total') continue;
    const relative = path.relative(rootDir, filePath);
    if (relative.startsWith('..')) continue;
    files[relative] = data;
  }

  return { total: raw.total, files };
}

function ensureBaseRefAvailable(ref) {
  try {
    execSync(`git rev-parse --verify ${ref}`, { stdio: 'ignore' });
    return ref;
  } catch (resolveError) {
    const remote = 'origin';
    const refName = ref.startsWith(`${remote}/`) ? ref.slice(remote.length + 1) : ref;
    try {
      execSync(`git fetch --no-tags --depth=1 ${remote} ${refName}`, { stdio: 'inherit' });
      execSync(`git rev-parse --verify ${ref}`, { stdio: 'ignore' });
      return ref;
    } catch (fetchError) {
      const fallbackRef = process.env.COVERAGE_FALLBACK_REF || 'HEAD^';
      try {
        execSync(`git rev-parse --verify ${fallbackRef}`, { stdio: 'ignore' });
        console.warn(
          `Unable to resolve ${ref}. Falling back to ${fallbackRef} for coverage comparison.`
        );
        return fallbackRef;
      } catch (fallbackError) {
        throw new Error(
          `Unable to resolve coverage base ref ${ref} and fallback ${fallbackRef}. ` +
            'Set COVERAGE_BASE_REF to a reachable ref or COVERAGE_SKIP_BASE=1 to proceed.'
        );
      }
    }
  }
}

function compareCoverage(base, head) {
  const regressions = [];
  const allFiles = new Set([...Object.keys(base.files), ...Object.keys(head.files)]);

  for (const file of allFiles) {
    const baseMetrics = base.files[file];
    const headMetrics = head.files[file];

    if (!headMetrics) {
      continue;
    }

    for (const metric of metrics) {
      const basePct = baseMetrics?.[metric]?.pct ?? 0;
      const headPct = headMetrics?.[metric]?.pct ?? 0;
      if (headPct + epsilon < basePct) {
        regressions.push({ file, metric, base: basePct, head: headPct });
      }
    }
  }

  for (const metric of metrics) {
    const basePct = base.total?.[metric]?.pct ?? 0;
    const headPct = head.total?.[metric]?.pct ?? 0;
    if (headPct + epsilon < basePct) {
      regressions.push({ file: 'TOTAL', metric, base: basePct, head: headPct });
    }
  }

  return regressions;
}

function formatRegression({ file, metric, base, head }) {
  const toPct = (value) => `${value.toFixed(2)}%`;
  return `${file} ${metric} coverage regressed from ${toPct(base)} to ${toPct(head)}`;
}

function formatDelta(base, head) {
  const delta = head - base;
  if (Math.abs(delta) < epsilon) {
    return '0.00%';
  }

  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta.toFixed(2)}%`;
}

function buildCoverageSummary(base, head, regressions) {
  const capitalise = (value) => value.charAt(0).toUpperCase() + value.slice(1);
  const toPct = (value) => `${value.toFixed(2)}%`;
  const lines = ['## Coverage Comparison', '', '| Metric | Base | PR | Δ |', '| --- | ---: | ---: | ---: |'];

  for (const metric of metrics) {
    const basePct = base.total?.[metric]?.pct ?? 0;
    const headPct = head.total?.[metric]?.pct ?? 0;
    lines.push(
      `| ${capitalise(metric)} | ${toPct(basePct)} | ${toPct(headPct)} | ${formatDelta(basePct, headPct)} |`
    );
  }

  lines.push('');

  if (regressions.length === 0) {
    lines.push('✅ No coverage regressions detected.');
  } else {
    lines.push('⚠️ Coverage regressions detected:', '');
    for (const regression of regressions) {
      lines.push(`- ${formatRegression(regression)}`);
    }
  }

  return lines.join('\n');
}

let baseSummary;
let baseWorktree;

if (!skipBase) {
  const effectiveBaseRef = ensureBaseRefAvailable(baseRef);
  baseWorktree = mkdtempSync(path.join(tmpdir(), 'coverage-base-'));
  try {
    execSync(`git worktree add --force ${baseWorktree} ${effectiveBaseRef}`, { stdio: 'inherit' });
    run('npm', ['ci'], { cwd: baseWorktree });
    baseSummary = ensureCoverageSummary(baseWorktree);
  } finally {
    try {
      execSync(`git worktree remove --force ${baseWorktree}`, { stdio: 'inherit' });
    } catch (error) {
      console.warn('Failed to remove git worktree cleanly:', error.message);
    }
    rmSync(baseWorktree, { recursive: true, force: true });
  }
} else {
  console.warn('COVERAGE_SKIP_BASE=1 set, skipping regression comparison.');
}

let headSummary;

if (headSummaryEnv) {
  const resolvedPath = path.isAbsolute(headSummaryEnv)
    ? headSummaryEnv
    : path.join(repoRoot, headSummaryEnv);

  if (!existsSync(resolvedPath)) {
    throw new Error(`Head coverage summary not found at ${resolvedPath}`);
  }

  headSummary = readCoverageSummary(resolvedPath, repoRoot);
} else {
  headSummary = ensureCoverageSummary(repoRoot);
}

if (!baseSummary) {
  console.log('Base coverage not generated; skipping regression check.');
  process.exit(0);
}

const regressions = compareCoverage(baseSummary, headSummary);
const summary = buildCoverageSummary(baseSummary, headSummary, regressions);

console.log(`\n${summary}\n`);

if (reportPath) {
  writeFileSync(reportPath, `${summary}\n`, 'utf8');
}

if (stepSummaryPath) {
  appendFileSync(stepSummaryPath, `${summary}\n`, 'utf8');
}

if (regressions.length > 0) {
  process.exit(1);
}

console.log('Coverage check passed. No regressions detected.');
