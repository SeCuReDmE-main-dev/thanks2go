# Deployment runbook

1. Run `npm ci && npm run check && npm run package:extension`.
2. Create dedicated PayPal Sandbox and Live apps only after immediate operator confirmation. Store `PAYPAL_T2G_*` in the centralized secret surface and Vercel, never in Git.
3. Configure a dedicated Solana devnet recipient and prove wallet control. Set `SOLANA_DEVNET_RECIPIENT`. `SOLANA_RPC_URL` may override server-side verification RPC; the public devnet endpoint remains the fallback.
4. Generate a dedicated P-256 signing key; store the private JWK only in Vercel/Settings and publish the derived key through JWKS.
5. Deploy the repository as one Vercel project and attach `thanks2go.securedme.ca`.
6. Run `vercel domains verify thanks2go.securedme.ca`; copy only its project-specific preferred DNS record into cPanel. On 2026-09-04 the final verified record was `CNAME thanks2go.securedme.ca 499a4277ac70b4ae.vercel-dns-017.com.`. Vercel provisions TLS after verification.
7. Execute sandbox failure/success/idempotency tests, Solana devnet tests, browser/a11y tests, then the separately confirmed 2 USD live transaction.
8. Freeze, tag, capture evidence, record video, and submit. Do not add features after freeze.

Preview deployments use only the exact platform-provided `VERCEL_URL` for internal A2A transport and Origin admission; the signed identity remains the canonical production origin. Do not expose live PayPal credentials to preview. When Vercel Deployment Protection is enabled, verify the agent-card and A2A self-HTTP paths explicitly: the application does not read or forward a protection-bypass secret.
