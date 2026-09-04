# Agent perspective review

Source: an operator-run browser-agent survey on 2026-09-04. The private
transcript is paraphrased here; it is not published verbatim.

## What the agent understood correctly

- The core rule is “agents prepare, humans approve.”
- PayPal and Solana have bounded amounts and distinct environments.
- A staged mandate expires after ten minutes.
- Human identity is deliberately not claimed.
- A valid credential must still be read together with its payment status.

## Where the agent had to guess

The original inspection output did not distinguish a canonical production page
from a localhost preview, describe how an origin claim could be checked, or say
which sensitive fields were excluded. The agent therefore treated server fields
as self-assertions and generalized that agents could access browser history,
cookies and unrelated secrets. Thanks2Go's page tools have none of those
capabilities, but the result contract did not make that boundary easy to see.

The phrase “human approval” was also read as “verified human identity.” That is
not the product claim. Approval means the payment provider or wallet presents a
visible user-controlled approval step; it does not authenticate a legal identity.

## Contract changes prompted by the survey

`inspect_gratitude_profile` now reports the current page origin, canonical-origin
match, TLS/local/insecure transport state, narrow trust statement, JWKS and both
Agent Card URLs, and explicit `paymentInitiated: false` / `secretsReturned: false`.

`stage_gratitude_intent` returns the recipient-control credential and its JWKS
verification URL, but withholds the signed payment mandate token. It lists the
three prohibited actions: approval, PayPal capture and wallet signing.

`open_payment_handoff` reports the exact focus target and the same prohibited
actions. `verify_gratitude_receipt` separates cryptographic validity from
settlement confirmation and says whether the receipt is usable as payment proof.

These fields help an agent remain useful without being asked to “just trust” a
boolean. They do not make the page an identity provider, protect a compromised
browser, or prove that every possible agent will resist prompt injection.

## Acceptance criterion

An agent should be able to answer all five questions without inference:

1. Am I on the canonical origin or a local preview?
2. What exactly is controlled, and what is not verified?
3. Which evidence can I verify independently?
4. Which actions am I unable to perform?
5. Does this receipt prove a confirmed settlement or only a valid signature?
