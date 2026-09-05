# Task: synchronize the PayPal gratitude gesture to 2 USD

## Requested outcome

Change the fixed PayPal gesture from 1.00 USD to 2.00 USD everywhere before operator testing so that provider fees are more likely to leave at least 1 USD, without presenting that net amount as guaranteed.

## Blocking decisions

None. The user authorized 2 USD and confirmed the product remains a gesture, not a payment solution. A live transaction remains human-only and is not part of this code task.

## Ordered work

1. Define one shared fixed amount contract: 200 minor units, `2.00`, `$2.00 USD`, offer `gratitude-usd-2`.
2. Update mandate creation and profile schema/data.
3. Update PayPal order creation, pre-capture inspection and capture verification.
4. Update browser copy and WebMCP staged-intent validation/notice.
5. Update automated fixtures and assertions, including rejection of a 1.00 USD provider response.
6. Update public architecture, deployment, demo, evidence and release documents.
7. Run typecheck, all tests, builds, extension package, production dependency audit and secret scan.
8. Commit and push only after the complete diff and checks are clean; deployment verification follows CI.

## Acceptance criteria

- No active product, API, test or public-document reference describes the PayPal offer as 1 USD.
- A valid PayPal mandate is exactly 200 minor units and the provider order is exactly `2.00 USD`.
- Provider details or capture at any other amount fail closed.
- UI and WebMCP announce 2 USD but never promise a guaranteed net receipt.
- Solana amounts and all human-approval gates are unchanged.
- No live financial action occurs.

## Non-goals

- Variable PayPal amounts, commissions, accounts, marketplace behavior or autonomous payment.
- Changing Solana presets.
- Performing sandbox or live operator transactions.

## Implementation handoff

Implement the ordered work in the current repository using the shared contract as the single source of truth. Preserve the existing architecture and security gates. Verify the entire repository, then report the diff and any remaining manual evidence separately.

