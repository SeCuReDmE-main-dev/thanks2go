# API map

All routes are assembled in `api/app.ts`. Production origin is `https://thanks2go.securedme.ca`.

| Method | Route | Purpose | Authority boundary |
|---|---|---|---|
| GET | `/api/health` | Stateless health | No sensitive state |
| GET | `/api/profiles/:slug` | Canonical public profile | Only `securedme` exists |
| POST | `/api/intents/stage` | A2A recipient verification and signed mandate | No payment; exact rail and amount |
| POST | `/api/paypal/orders` | Create PayPal order | Signed active mandate plus `humanApproved: true` |
| POST | `/api/paypal/orders/:id/capture` | Capture approved order | Provider order is rebound to mandate |
| POST | `/api/solana/verify` | Verify finalized devnet transaction | Server checks recipient, amount, memo and reference |
| POST | `/api/receipts/verify` | Verify signed receipt | VC/JWT fields are validated |
| GET | `/.well-known/jwks.json` | Publish ES256 public key | Private JWK remains environment-only |
| GET | `/agents/{payer|recipient}/.well-known/agent-card.json` | Signed A2A card | Canonical signer and interface |
| POST | `/api/a2a/{payer|recipient}` | A2A 1.0 JSON-RPC | Requires `A2A-Version: 1.0` |

Global controls: 32 KB JSON limit, strict production origin allowlist, Helmet, compression, normalized public errors, no caller-controlled outbound URL.

