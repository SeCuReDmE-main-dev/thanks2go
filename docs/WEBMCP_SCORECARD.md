# Official WebMCP directory scorecard

Scan date: 2026-09-04. URL submitted: https://thanks2go.securedme.ca/p/securedme.

[Official report](https://webmcp.com/report/5698993a-b390-4bfe-9b00-5646d16e78af)
shows **B-**, four tools detected and one page scanned. This is the external
surface grade, not four independently awarded per-tool grades. The UI says
listing is underway; request acceptance is not proof of completed indexing.

The [official methodology](https://webmcp.com/methodology) weights usability
60%, coverage 20%, quality 20%. We use that report, not a home-grown grade.

Scanner findings and one bounded local refinement:

| Finding | Response |
|---|---|
| Missing output schemas | Added descriptive output schemas and structured results to all four tools. Native browsers may ignore this optional metadata. |
| Unconstrained receipt object | Strict receipt fields, sizes, enums and runtime validation; changed signed fields rejected by the API. |
| Thin single-page coverage | Retained deliberately: this product has one canonical profile and a short human-approved journey. No filler pages. |
| Good safety-scoped descriptions | Preserved; no capture, payment approval or wallet signing tool added. |

The small reliability pass also handles HTTP/network errors, sanitizes returned
data, reports missing handoff panels honestly, makes agent staging visible,
and cleans up partially registered tools on cancellation or registration failure.

Validation: 71 tests passed, including 26 WebMCP callback tests; strict TypeScript
and web/extension production builds passed. Callback tests use a controlled
ModelContext and mocked HTTP: they are not an external regrade or native-agent
certification. The official B- above belongs to the deployed baseline.

User instruction after seeing B-: keep refinement small, no push. These changes
remain local; no new grade is claimed and no rescan of undeployed changes requested.
