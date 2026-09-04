# Evidence matrix

| Claim | Proof | Status |
|---|---|---|
| Project began inside the challenge window | Public repository history and creation time | verified 2026-09-04 |
| Extension uses minimum permissions | Manifest plus automated test | verified locally and in CI |
| Payer and recipient agents perform A2A 1.0 `SendMessage` | Local integration test uses the official SDK over HTTP; unsupported version and malformed params fail closed | verified locally; production chain pending deployment of this revision |
| Agent cards, recipient control attestations and receipt credentials use ES256 | Public JWKS, SDK card verification and local credential-binding tests | public cards verified 2026-09-04; recipient credential production check pending deployment |
| WebMCP cannot approve payment | 26 callback tests plus native Chrome discovery of all four tools; external webmcp.com baseline grade B- | verified locally; improved revision not rescanned or deployed |
| PayPal amount cannot be changed by client | Provider order is checked before capture; mismatched order/amount/currency tests | automated checks pass; one sandbox success captured, remaining failure paths pending browser evidence |
| PayPal live 1 USD completed | Provider capture and merchant dashboard evidence | pending confirmation |
| Solana devnet transfer matches mandate | Instruction and mocked RPC tests cover amount, recipient, signature, finality, memo, duplicate memo and cross-mandate replay | verified locally; real finalized devnet transaction pending wallet/faucet |
| Public deployment uses TLS | HTTPS responses, CSP, `nosniff`, canonical DNS and production endpoint checks | verified 2026-09-04 |
