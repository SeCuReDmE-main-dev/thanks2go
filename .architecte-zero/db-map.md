# Data and persistence map

There is no application database and no durable task store.

- Mandates are signed, autonomous and expire after ten minutes.
- `InMemoryTaskStore` is an SDK transport helper only; it is process-local and not a product history.
- PayPal and Solana remain the provider sources of truth.
- Browser session storage temporarily holds the PayPal mandate token until return or cancellation.
- A downloaded receipt is created only after the user requests it.
- No account, social feed, global transaction history, analytics warehouse or payer PII store exists.

Unknown: provider-side retention is governed by each provider and is outside this repository.

