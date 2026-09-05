# Component map

## Web

- `App.tsx`: profile loading, rail selection, visible approval, provider handoff, receipt display and download.
- `solana-payment.ts`: on-demand wallet discovery, Commerce Kit instructions and devnet send.
- `webmcp.ts`: four progressive WebMCP tools; none can approve or capture a payment.
- `styles.css`: SecuredMe-derived visual system, responsive layout and focus states.

## Extension

- `popup.js`: user-triggered declaration inspection and canonical-profile validation.
- `popup.html` / `popup.css`: minimal popup surface.
- `manifest.json`: only `activeTab` and `scripting`; no host permissions or persistent content script.

## Server modules

- `app.ts`: routes, A2A orchestration, human-approval gates and error boundary.
- `crypto.ts`: ES256 mandates, recipient credentials, receipt credentials and payer-reference hashing.
- `paypal.ts`: OAuth, Orders v2 creation and capture validation.
- `solana.ts`: finalized devnet transaction verification and replay protection.
- `recipient.ts`: configured devnet destination control proof.

