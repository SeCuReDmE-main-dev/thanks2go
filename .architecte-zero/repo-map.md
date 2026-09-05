# Repository map

Verified: 2026-09-04 EDT at `5f1172f` before the 2 USD synchronization.

## Boundaries

- `apps/web`: React, TypeScript and Vite public interface.
- `apps/extension`: Chrome Manifest V3 click-to-inspect extension and ZIP packaging.
- `packages/contracts`: shared Zod schemas, canonical hashing, mandates and public errors.
- `packages/a2a`: A2A 1.0 cards, executor and client exchange.
- `api`: Express application exported as one Vercel Function.
- `tests`: contract, API, provider adapter, A2A, WebMCP, extension and security tests.
- `docs`: architecture, threat model, evidence and operator runbooks.

## Entrypoints

- Browser: `apps/web/src/main.tsx` -> `apps/web/src/App.tsx`.
- Vercel: `api/index.ts` -> `api/app.ts`.
- Local API: `api/local.ts`.
- Extension: `apps/extension/src/manifest.json` -> `popup.html` -> `popup.js`.
- Shared contracts: `packages/contracts/src/index.ts`; browser-safe PayPal constants: `packages/contracts/src/paypal.ts`.
- A2A: `packages/a2a/src/index.ts`.

## Build and verification

- `npm run check`: typecheck, 71 tests and both production builds.
- `npm run package:extension`: produces `apps/extension/thanks2go-extension-0.1.0.zip`.
- `.github/workflows/ci.yml`: Node 24 verification plus secret-pattern guard.

## Core loop

Canonical profile -> bounded mandate -> visible human approval -> provider confirmation -> signed receipt.
