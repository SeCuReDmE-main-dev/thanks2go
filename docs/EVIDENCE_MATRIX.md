# Evidence matrix

| Claim | Proof | Status |
|---|---|---|
| Project began inside the challenge window | Public repository history and creation time | verified 2026-09-04 |
| Extension uses minimum permissions | Manifest plus automated test | verified locally and in CI |
| A2A agents communicate using v1 `SendMessage` | Integration test plus production `ROLE_AGENT` response | verified 2026-09-04 |
| Agent cards and receipt credentials use ES256 | Public JWKS plus SDK verification of both production card signatures | verified 2026-09-04 |
| WebMCP cannot approve payment | Source boundary test | verified locally and in CI |
| PayPal amount cannot be changed by client | Server source plus sandbox capture evidence | partial |
| PayPal live 1 USD completed | Provider capture and merchant dashboard evidence | pending confirmation |
| Solana devnet transfer matches mandate | Finalized transaction and API receipt | pending wallet |
| Public deployment uses TLS | HTTPS responses, CSP, `nosniff`, canonical DNS and production endpoint checks | verified 2026-09-04 |
