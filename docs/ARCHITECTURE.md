# Architecture and authority map

```text
explicit page declaration → click-scoped MV3 inspection → visible profile
                                                   ├─ PayPal 2 USD live rail
                                                   └─ Solana devnet Commerce Kit

WebMCP/A2A → inspect or stage → visible human approval → provider → verified receipt VC
```

The hosted React application and Express/Vercel API share one origin. Mandates are signed, self-contained, and expire after ten minutes. No application database or global payment history exists. PayPal and Solana remain settlement sources of truth.

The Payer Intent Agent can describe and stage intent. The Recipient Trust Agent can attest control of the canonical origin and configured rail destination. Neither agent identifies a human, authorizes a transfer, captures an order, or signs a wallet transaction.

AP2 informs the intent → mandate → approval → provider → receipt decomposition. Thanks2Go does not claim AP2 conformance.
