# Threat model

| Threat | Control | Verification |
|---|---|---|
| Malicious page routes to attacker | Exact HTTPS origin and `/p/{slug}` allowlist; conflict fails closed | Contract and extension tests |
| Background browsing surveillance | Explicit popup click; no host permissions, background worker, persistent content script, storage, or telemetry | Manifest test |
| Agent initiates payment | WebMCP exposes no approval/capture/signing operation; PayPal must record payer approval. `humanApproved` is a caller assertion, not proof of a human | Source/API tests; provider approval checks |
| Client changes amount/payee | PayPal value and description are server fixed; signed mandate bounds rail/amount/profile | Contract tests and provider response validation |
| Duplicate PayPal operation | Stable `PayPal-Request-Id` per create/capture mandate | Sandbox retry test |
| Mandate replay | Ten-minute expiry and provider checks; PayPal validates order binding before capture. Solana cross-mandate replay remains an open release blocker without a mandate-derived on-chain reference | Expiry/tamper and mocked provider tests; devnet replay evidence pending |
| Receipt wrapper falsification | Every displayed receipt field, including confirmation time, must match the signed credential subject | Field substitution tests |
| SSRF | No server endpoint fetches a user-controlled URL | Route review |
| Payer PII leaks | API discards payer name/email and returns only a SHA-256 payer reference | Capture contract test |
| False identity claim | UI says origin/destination control only and explicitly denies human identity verification | Content review |

Known beta risk: Commerce Kit 0.1.1 is pinned. Its public callback exposes the transaction signature but not its internally generated Solana Pay reference. The server therefore binds the signed mandate to recipient, exact amount, finality, block time, and the unique transaction signature used as the receipt provider reference. It does not claim a mandate-derived on-chain reference.

Release blocker: two same-amount mandates with overlapping windows can currently cite the same Solana transaction. The signature alone is not a cross-mandate replay defense. Do not mark the Solana replay gate complete until the transaction includes a mandate-bound reference that the verifier checks.

A2A status: the two SDK endpoints and their card signatures work. The recipient response now derives claims from runtime configuration and a verified Ed25519 control proof. Payer-to-recipient request orchestration and structured intent processing are still release gates; a static `ROLE_AGENT` response is not evidence that those capabilities work.
