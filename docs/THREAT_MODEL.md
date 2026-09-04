# Threat model

| Threat | Control | Verification |
|---|---|---|
| Malicious page routes to attacker | Exact HTTPS origin and `/p/{slug}` allowlist; conflict fails closed | Contract and extension tests |
| Background browsing surveillance | Explicit popup click; no host permissions, background worker, persistent content script, storage, or telemetry | Manifest test |
| Agent initiates payment | WebMCP exposes no approval/capture/signing operation; API requires visible `humanApproved` value and provider UI | Source test and API test |
| Client changes amount/payee | PayPal value and description are server fixed; signed mandate bounds rail/amount/profile | Contract tests and provider response validation |
| Duplicate PayPal operation | Stable `PayPal-Request-Id` per create/capture mandate | Sandbox retry test |
| Mandate replay | Ten-minute expiry, signature verification, exact provider checks | Expiry/tamper tests |
| SSRF | No server endpoint fetches a user-controlled URL | Route review |
| Payer PII leaks | API discards payer name/email and returns only a SHA-256 payer reference | Capture contract test |
| False identity claim | UI says origin/destination control only and explicitly denies human identity verification | Content review |

Known beta risk: Commerce Kit 0.1.1 is pinned. The server, not the client callback, decides whether a transaction matches recipient, amount, reference, and finality.
