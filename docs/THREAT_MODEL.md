# Threat model

| Threat | Control | Verification |
|---|---|---|
| Malicious page routes to attacker | Exact HTTPS origin and `/p/{slug}` allowlist; conflict fails closed | Contract and extension tests |
| Background browsing surveillance | Explicit popup click; no host permissions, background worker, persistent content script, storage, or telemetry | Manifest test |
| Agent initiates payment | WebMCP exposes no approval/capture/signing operation; PayPal must record payer approval. `humanApproved` is a caller assertion, not proof of a human | Source/API tests; provider approval checks |
| Client changes amount/payee | PayPal value and description are server fixed; signed mandate bounds rail/amount/profile | Contract tests and provider response validation |
| Duplicate PayPal operation | Stable `PayPal-Request-Id` per create/capture mandate | Sandbox retry test |
| Mandate replay | Ten-minute expiry and provider checks; PayPal validates order binding before capture. Solana requires a mandate-hash reference and exact memo | Expiry/tamper, provider mocks and cross-mandate replay tests; real devnet evidence pending |
| Receipt wrapper falsification | Every displayed receipt field, including confirmation time, must match the signed credential subject | Field substitution tests |
| SSRF | No server endpoint fetches a user-controlled URL | Route review |
| Payer PII leaks | API discards payer name/email and returns only a SHA-256 payer reference | Capture contract test |
| False identity claim | UI says origin/destination control only and explicitly denies human identity verification | Content review |

Known beta risk: Commerce Kit 0.1.1 is pinned. Its high-level tip button converts fiat-denominated tips and its transfer helper does not produce the exact native-SOL reference/memo contract required here. Thanks2Go therefore uses Commerce Kit's headless tip request with Gill's native System Program transfer, a read-only mandate-hash reference and one exact memo. The server validates recipient, amount, signature, finality, time window, reference and memo.

Release blocker: the binding and replay controls pass deterministic tests, but a real finalized devnet transaction has not yet been captured because the public faucet rejected the first smoke request. Do not claim live devnet evidence until a wallet completes this exact flow.

A2A status: the payer obtains the signed recipient card, verifies its service key, sends a real SDK `SendMessage` request over HTTP, compares the structured response with current configuration, then signs the mandate. Local integration covers the full chain; production verification awaits deployment of this revision.
