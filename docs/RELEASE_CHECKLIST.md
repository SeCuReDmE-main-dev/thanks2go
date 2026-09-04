# Release checklist

## Automated

- [x] TypeScript strict typecheck
- [x] Contract, expiry, tamper, API, extension, and WebMCP tests
- [x] Real SDK A2A 1.0 `SendMessage` integration test
- [x] Signed Agent Cards in configured-key mode
- [x] Production web build and MV3 package build
- [x] Production dependency audit reports zero known vulnerabilities
- [ ] GitHub Actions green on the public repository

## Provider evidence

- [ ] Dedicated devnet receiving wallet configured and control challenge signed
- [ ] Commerce Kit accept, reject, cancel, wrong-amount, wrong-recipient, reuse, and finality cases captured
- [ ] Dedicated `Thanks2Go Sandbox` PayPal app created after confirmation
- [ ] Sandbox success, cancellation, refusal, double-click, and idempotent retry captured
- [ ] Dedicated `Thanks2Go Live` PayPal app created after confirmation
- [ ] Separate consenting payer completes exactly 1.00 USD after confirmation
- [ ] Capture is `COMPLETED`, merchant receipt is visible, API receipt contains no payer name/email

## Browser and deployment

- [ ] Keyboard-only pass
- [ ] Contrast and screen-reader pass
- [ ] Mobile viewport pass
- [ ] Chrome extension clean-profile pass
- [ ] Vercel production deployment
- [ ] Exact cPanel CNAME configured
- [ ] TLS and public profile URL verified
- [ ] CSP and Origin behavior verified in production

## Submission

- [ ] Functional freeze tag at 2026-09-06 22:00 America/Toronto
- [ ] Demo video
- [ ] English DEV article with `#weekendchallenge`
- [ ] French securedme.ca companion
- [ ] Evidence archive and submission URL
