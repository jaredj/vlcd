# Very-Low-Calorie Diet Progress Lab

A single-page application for planning and tracking a very-low-calorie diet (VLCD), including metabolic modelling that forecasts
both fasted and refed scale weights. Profiles are stored locally so the experience resumes where you left off.

## Key capabilities

- **Guided profile setup** with defaults tailored to an aspiring alpinist: 265 lb starting weight, 5′10.5″ height, age 44, and
  the alpinist goal selected by default.
- **Dynamic goal setting** that calculates BMI, recommends a goal-specific target, and highlights progress toward it.
- **Physiology-aware modelling** that blends Mifflin–St Jeor BMR calculations, adaptive thermogenesis, VLCD water shifts, and
  day-by-day activity adjustments.
- **Dual weight forecasts** showing the expected fasted scale reading versus the refed scale weight after returning to
  maintenance calories.
- **Daily overrides** for calories and activity that immediately recalculate the entire trajectory.
- **Weigh-in tracking** for fasted and non-fasted measurements, updating all forward-looking projections.
- **Interactive charts and summaries** built with Recharts for visualising past results and upcoming milestones.
- **Fully documented methodology** with expandable explanations of the metabolic assumptions.

## Getting started

### Prerequisites

- Node.js 20+
- npm 10+

### Installation

```bash
npm install
```

### Local development

```bash
npm run dev
```

The dev server runs with Vite and supports hot module replacement.

### Linting & formatting

```bash
npm run lint
npm run format
```

### Testing

```bash
npm run test
```

Vitest with React Testing Library covers the profile workflow, modelling engine, and daily plan overrides. Coverage reports are
emitted in `lcov` format for CI.

When iterating locally you can focus on specific files or test patterns without running the full suite:

```bash
# Skip the base comparison to speed up local feedback
npm run test -- --head-only

# Generate coverage for a single test file
npm run test -- --head-only src/path/to/file.test.ts

# Forward arbitrary flags directly to Vitest
npm run test -- --run "chart" --reporter=dot
```

All arguments passed after `--` are forwarded to `vitest run`, so any CLI filter supported by Vitest (file globs, test name
patterns, reporters, and so on) can be used while still receiving a coverage report.

### Production build

```bash
npm run build
```

The output is generated in `dist/` and is ready for static hosting, including GitHub Pages.

## Continuous integration & deployment

GitHub Actions workflows run linting, tests (with coverage), and build verification on every push and pull request. A dedicated
Pages workflow rebuilds and publishes the static site whenever new commits land on the default branch, keeping the GitHub Pages
deployment up to date.
