# Evidence matrix

| Claim | Proof | Status |
|---|---|---|
| Project began inside the challenge window | Public repository history and creation time | verified 2026-09-04 |
| Extension uses minimum permissions | Manifest plus automated test | verified locally and in CI |
| Payer and recipient agents perform A2A 1.0 `SendMessage` | Local integration plus production staging smoke; unsupported version returns a bounded JSON-RPC error | verified in production 2026-09-04 |
| Agent cards, recipient control attestations and receipt credentials use ES256 | Public JWKS, SDK card verification, production staging smoke and local credential-binding tests | public cards and recipient-control credential verified 2026-09-04 |
| WebMCP cannot approve payment | 27 callback tests plus native Chrome discovery of all four tools; external webmcp.com grade B+ | four tools, 2 USD staging, bounded agent contract and clock-skew handling verified in production 2026-09-04; directory indexing underway |
| PayPal amount cannot be changed by client | Provider order is checked before capture; mismatched order/amount/currency tests | automated checks pass; one sandbox success captured, remaining failure paths pending browser evidence |
| PayPal live 2 USD completed | Provider capture and merchant dashboard evidence | pending confirmation |
| Solana devnet transfer matches mandate | Instruction and mocked RPC tests cover amount, recipient, signature, finality, memo, duplicate memo and cross-mandate replay | verified locally; real finalized devnet transaction pending wallet/faucet |
| Public deployment uses TLS | HTTPS responses, CSP, `nosniff`, canonical DNS and production endpoint checks | verified after 2 USD deployment at `92a0787` on 2026-09-04 |
