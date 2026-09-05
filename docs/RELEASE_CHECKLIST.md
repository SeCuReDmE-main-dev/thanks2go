# Release checklist

## Automated

- [x] TypeScript strict typecheck
- [x] Contract, expiry, clock-skew, tamper, API, extension, and WebMCP tests
- [x] Real SDK A2A 1.0 `SendMessage` integration test
- [x] Signed Agent Cards in configured-key mode
- [x] Payer agent obtains and validates a recipient-agent response before staging (local and production)
- [x] Solana reference cryptographically bound to one mandate; cross-mandate replay rejected (automated)
- [x] Production web build and MV3 package build
- [x] Production dependency audit reports zero known vulnerabilities
- [x] GitHub Actions green on the public repository

## Provider evidence

- [x] Dedicated devnet receiving wallet configured and control challenge signed
- [ ] Commerce Kit accept, reject, cancel, wrong-amount, wrong-recipient, reuse, and finality cases captured
- [x] Dedicated `Thanks2Go Sandbox` PayPal app created after confirmation
- [ ] Sandbox success, cancellation, refusal, double-click, and idempotent retry captured
- [x] Dedicated `Thanks2Go Live` PayPal app created after confirmation
- [ ] Separate consenting payer completes exactly 2.00 USD after confirmation
- [ ] Capture is `COMPLETED`, merchant receipt is visible, API receipt contains no payer name/email

## Browser and deployment

- [x] Keyboard skip link and critical rail controls pass locally
- [x] Semantic heading/label accessibility-tree pass locally
- [x] Updated SecuredMe theme mobile viewport pass at 390 x 844 after 2 USD deployment
- [ ] Chrome extension clean-profile pass
- [x] Vercel production deployment
- [x] Exact cPanel CNAME configured
- [x] TLS and public profile URL verified
- [x] CSP and Origin behavior verified in production
- [x] Four WebMCP tools discovered by the public browser surface

## Submission

- [ ] Functional freeze tag at 2026-09-06 22:00 America/Toronto
- [ ] Demo video
- [ ] English DEV article with `#weekendchallenge`
- [ ] French securedme.ca companion
- [ ] Evidence archive and submission URL
