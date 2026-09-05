# Three-minute demo runbook

Status: rehearsal-ready. Record only after the provider and extension gates in
`RELEASE_CHECKLIST.md` are complete.

## 0:00-0:25 — the human problem

Open the public SecuredMe-themed profile at `/p/securedme`. Say: “Thanks2Go
makes a small thank-you easy to discover while keeping the spending decision in
the visible provider or wallet surface.” Show the recipient claims and the
profile-only QR.

## 0:25-0:55 — explicit discovery

In a clean Chrome profile, click the unpacked MV3 extension on a page containing
the voluntary `<link rel="thanks2go">` declaration. Show that the extension has
only `activeTab` and `scripting`, reads after the click, and opens the profile
instead of a payment.

## 0:55-1:25 — bounded agents

Open the browser's AI Tools panel and show all four WebMCP tools. Run
`inspect_gratitude_profile`. Point to the canonical-origin match, TLS transport,
JWKS and signed Agent Card URLs, `paymentInitiated: false`,
`secretsReturned: false`, and the explicit prohibited actions. Briefly show the
official B+ WebMCP scorecard.

## 1:25-1:55 — A2A and verifiable control

Stage one Solana devnet mandate. Explain that the payer agent calls the recipient
agent over A2A 1.0, verifies the signed card and recipient-control credential,
and produces an exact ten-minute mandate. Keep the mandate token and private
keys out of the recording.

## 1:55-2:25 — two rails, two meanings

Show the fixed 2 USD PayPal rail and the bounded 0.001/0.005/0.01 SOL devnet
presets. Use pre-recorded provider evidence or a sanitized receipt from the
release evidence pack. Never display a payer name, email, access token, wallet
secret, private environment file, or financial-card URL.

## 2:25-2:50 — settlement is a separate fact

Verify a sanitized receipt. Show the separate fields for cryptographic validity,
settlement confirmation and usability as payment proof. State that a signature
alone does not prove provider settlement.

## 2:50-3:00 — close

End on: “Agents prepare. You approve. Gratitude can travel quickly, while the
decision remains human.” Display the public profile, GitHub repository and DEV
article links.

## Recording gate

- Public deployment and TLS verified.
- GitHub Actions green at the recorded commit.
- WebMCP report link captured.
- Clean-profile extension pass recorded.
- PayPal evidence sanitized.
- Solana explorer evidence uses devnet and matches the mandate.
- Browser tabs, notifications and desktop areas containing personal information
  are closed or cropped before recording.
