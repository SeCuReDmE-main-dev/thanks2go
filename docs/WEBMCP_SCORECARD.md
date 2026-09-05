# Official WebMCP directory scorecard

Scan date: 2026-09-04. URL submitted: https://thanks2go.securedme.ca/p/securedme.

[Official report](https://webmcp.com/report/c8d5dbfc-dc2a-4330-8944-030646086bcb)
shows **B+**, four tools detected and one page scanned. This is the external
surface grade, not four independently awarded per-tool grades. The UI says
listing is underway; request acceptance is not proof of completed indexing.

The [official methodology](https://webmcp.com/methodology) weights usability
60%, coverage 20%, quality 20%. We use that report, not a home-grown grade.

Scanner findings and one bounded local refinement:

| Finding | Response |
|---|---|
| Missing output schemas | Added descriptive output schemas and structured results to all four tools. The rescan recognizes the resulting schemas as rigorous and strictly constrained. |
| Unconstrained receipt object | Strict receipt fields, sizes, enums and runtime validation; changed signed fields rejected by the API. |
| Thin single-page coverage | Retained deliberately: this product has one canonical profile and a short human-approved journey. No filler pages. |
| Good safety-scoped descriptions | Preserved; no capture, payment approval or wallet signing tool added. |

The small reliability pass also handles HTTP/network errors, sanitizes returned
data, reports missing handoff panels honestly, makes agent staging visible,
and cleans up partially registered tools on cancellation or registration failure.
The rescan's remaining observations are the intentionally narrow single-page
surface and free-form error-code strings. Neither weakens the payment boundary.

Validation: 72 tests passed, including 27 WebMCP callback tests; strict TypeScript
and web/extension production builds passed. Callback tests use a controlled
ModelContext and mocked HTTP: they are not a native-agent certification. The
official B+ above was produced against deployed commit `d6508fa` after the
bounded agent-contract refinement. Production staging was then revalidated at
2 USD after the bounded clock-skew correction in `92a0787`; no payment was
initiated by that test.

Directory status at the time of this report remains **listing underway**. The
public lookup API must return `supported: true` before indexing is claimed as
complete.
