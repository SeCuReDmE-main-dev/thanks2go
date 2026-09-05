# Test map

Current baseline: 9 files, 72 tests, all passing. Production QA exposed a client/server clock-skew bug in WebMCP intent validation; a regression test was added for exact ten-minute signed lifetimes and rejection beyond ten minutes.

| File | Coverage focus |
|---|---|
| `contracts.test.ts` | canonical URL, amounts, TTL, hashing and schema rejection |
| `crypto.test.ts` | mandate, recipient credential, receipt binding and tamper rejection |
| `api.test.ts` | routes, origin, A2A exchange and approval boundary |
| `paypal.test.ts` | order shape, provider rebinding, failure and idempotency adapter behavior |
| `solana.test.ts` | amount, recipient, memo/reference, finality and replay rejection |
| `webmcp.test.ts` | four tools, schemas, lifecycle and inability to approve |
| `extension.test.ts` | minimum permissions and declaration behavior |
| `security.test.ts` | secret patterns and public security controls |
| `recipient.test.ts` | configured recipient control proof |

Manual evidence still required: clean-profile Chrome extension, full PayPal sandbox scenarios, finalized Solana devnet transaction, distinct-payer live PayPal capture, keyboard/screen-reader/mobile browser pass, demo video and submission.
