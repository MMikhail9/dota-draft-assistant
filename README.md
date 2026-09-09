# Dota Draft Assistant

MVP web app that recommends Dota 2 heroes during draft with explainable, statistically honest breakdowns.

## Tech
- Vite + React + TypeScript
- Tailwind CSS (fast UI iteration)
- Vitest for unit tests

## Getting started
```bash
npm install
npm run dev
```

## Scripts
- `npm run dev` — start dev server
- `npm run build` — build production bundle
- `npm run test` — run unit tests
- `npm run lint` — lint
- `npm run format` — format

## MVP scope
- Draft input: allies/enemies + role (1–5)
- Recommendations with explanation + sample size + confidence
- Data provider abstraction (mock provider first)
