# Thanks2Go

Thanks2Go is a human-approved gratitude rail built for the DEV Weekend Challenge: Generosity Edition. A creator declares one canonical profile. A visitor explicitly chooses either a fixed **1.00 USD PayPal gratitude tip** or a clearly labelled **Solana devnet demonstration**.

Agents may inspect, stage, hand off, and verify. They cannot approve, capture, or sign payment.

## What is in the repository

- React + TypeScript + Vite public profile
- Chrome Manifest V3 extension with only `activeTab` and `scripting`
- Express/Vercel API with signed ten-minute mandates
- PayPal Orders v2 create/capture boundary with fixed server-side amount
- Solana Commerce Kit 0.1.1 in `tip` mode on devnet
- Two real A2A 1.0 agents using `@a2a-js/sdk` 1.1.0
- ES256 `vc+jwt` gratitude receipts and public JWKS
- Experimental `document.modelContext` WebMCP progressive enhancement
- Contract, API, privacy, permission, and authority-boundary tests

## Start locally

Requirements: Node.js 20 or newer and npm 11.

```bash
npm ci
copy .env.example .env.local
npm run dev
```

Open `http://localhost:5173/p/securedme`. Without dedicated environment values, payment rails remain unavailable; contract and UI development still work with local ephemeral signing keys.

## Verify

```bash
npm run check
npm run package:extension
```

Load `apps/extension/dist` from `chrome://extensions` → Developer mode → Load unpacked. The ZIP package is intentionally excluded from Git and is produced locally.

## Voluntary discovery declaration

```html
<link rel="thanks2go" href="https://thanks2go.securedme.ca/p/securedme">
<meta name="thanks2go:profile" content="https://thanks2go.securedme.ca/p/securedme">
```

Conflicting declarations fail closed. The extension never scans a page until the user clicks its action and never opens a profile until a second click.

## Payment and identity boundaries

- The PayPal rail is a voluntary gratitude tip: no good, service, tax receipt, or charitable donation is promised.
- Solana is **devnet only**. Devnet tokens have no monetary value.
- “Verified” means the canonical origin and configured rail destination are controlled. It does not mean a human identity is verified or that a profile is safe.
- No account, social feed, creator directory, leaderboard, telemetry pipeline, or application payment-history database exists.
- AP2 informs the bounded mandate pattern; this project does not claim AP2 conformance.
- WebMCP is experimental and is never a payment authority.

See [architecture](docs/ARCHITECTURE.md), [threat model](docs/THREAT_MODEL.md), [privacy](docs/PRIVACY.md), and [deployment](docs/DEPLOYMENT.md).

## Status

The public deployment has Vercel, TLS, canonical DNS, dedicated PayPal configuration, recipient proof and credential, signed A2A cards, a production payer-to-recipient exchange, mandate-bound Solana instructions, the SecuredMe visual theme, four browser-discovered WebMCP tools and security headers. A finalized real devnet transfer, a separate consenting live PayPal payer, the installed-extension browser pass, the video and DEV publication remain release gates and are not claimed until verified.

MIT © 2026 Jean-Sébastien Beaulieu / SecuredMe
