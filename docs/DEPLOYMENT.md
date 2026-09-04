# Deployment runbook

1. Run `npm ci && npm run check && npm run package:extension`.
2. Create dedicated PayPal Sandbox and Live apps only after immediate operator confirmation. Store `PAYPAL_T2G_*` in the centralized secret surface and Vercel, never in Git.
3. Configure a dedicated Solana devnet recipient and prove wallet control. Set `SOLANA_DEVNET_RECIPIENT`.
4. Generate a dedicated P-256 signing key; store the private JWK only in Vercel/Settings and publish the derived key through JWKS.
5. Deploy the repository as one Vercel project and attach `thanks2go.securedme.ca`.
6. Run `vercel domains inspect thanks2go.securedme.ca`; copy only the exact returned DNS record into cPanel. Vercel provisions TLS.
7. Execute sandbox failure/success/idempotency tests, Solana devnet tests, browser/a11y tests, then the separately confirmed 1 USD live transaction.
8. Freeze, tag, capture evidence, record video, and submit. Do not add features after freeze.
