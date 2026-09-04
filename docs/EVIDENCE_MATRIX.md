# Evidence matrix

| Claim | Proof | Status |
|---|---|---|
| Project began inside the challenge window | Public repository history and creation time | verified 2026-09-04 |
| Extension uses minimum permissions | Manifest plus automated test | verified locally and in CI |
| Each A2A endpoint answers v1 `SendMessage` | Integration test plus production `ROLE_AGENT` response | transport verified 2026-09-04; payer-to-recipient workflow remains pending |
| Agent cards and receipt credentials use ES256 | Public JWKS plus SDK verification of both production card signatures | verified 2026-09-04 |
| WebMCP cannot approve payment | Source boundary test | verified locally and in CI |
| PayPal amount cannot be changed by client | Provider order is checked before capture; mismatched order/amount/currency tests | automated checks pass; sandbox evidence pending |
| PayPal live 1 USD completed | Provider capture and merchant dashboard evidence | pending confirmation |
| Solana devnet transfer matches mandate | Finalized transaction and API receipt | pending wallet |
| Public deployment uses TLS | HTTPS responses, CSP, `nosniff`, canonical DNS and production endpoint checks | verified 2026-09-04 |
