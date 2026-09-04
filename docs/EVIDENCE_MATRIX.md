# Evidence matrix

| Claim | Proof | Status |
|---|---|---|
| Project began inside the challenge window | Initial Git commit timestamp and public repository creation time | pending public push |
| Extension uses minimum permissions | Manifest plus automated test | ready locally |
| A2A agents communicate using v1 `SendMessage` | Integration test output | ready locally |
| Agent cards and receipt credentials use ES256 | Signed-card test, JWKS, JWT verification | ready locally |
| WebMCP cannot approve payment | Source boundary test | ready locally |
| PayPal amount cannot be changed by client | Server source plus sandbox capture evidence | partial |
| PayPal live 1 USD completed | Provider capture and merchant dashboard evidence | pending confirmation |
| Solana devnet transfer matches mandate | Finalized transaction and API receipt | pending wallet |
| Public deployment uses TLS | HTTPS capture and headers | pending deploy |
