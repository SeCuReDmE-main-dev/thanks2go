# SecuredMe visual continuity

Source: https://securedme.ca/, inspected in Chrome on 2026-09-04.

Thanks2Go adopts the public site's midnight background (#030914), navy panels
(#07111f), gold (#e4a83d / #ffd67a), blue (#68a8ff), and light text (#d7e7ff).
Georgia, Segoe UI and Consolas follow its local font fallbacks without remote
font requests or additional dependencies.

The weekend-sized template uses a compact identity header, a two-column
introduction, recipient and profile-only QR panel, two payment cards, status,
optional signed receipt, and a short human-approval boundary. Cards stack below
640px; no animation, account system, additional navigation framework or page
builder was introduced. AZ Frontend keeps states and payment controls intact.

Validation of this working tree:

- TypeScript check and production web/extension build passed.
- 43 automated tests passed before the visual-only changes.
- Desktop Chrome visual inspection passed for the hero and payment cards.
- Clicking Stage devnet mandate completed the real local A2A exchange and
  showed the staged 0.001 SOL status; no wallet transaction was initiated.
- Mobile Chrome at 390 x 844 showed the complete stacked journey with no clipped
  control. The accessibility tree exposed the heading hierarchy, radio labels,
  status region and all actions; the first keyboard stop was the skip link.
- Public deployment of this revision remains pending.

WCAG contrast calculations for the declared palette passed AA: primary text on
midnight 15.92:1, muted text on navy 9.28:1, gold on midnight 9.47:1, blue on
midnight 8.20:1, and dark button text on gold 8.86:1. These calculations do not
replace a final assistive-technology review of every state.

The floating AI Tools widget visible in the operator's Chrome is an installed
browser extension, not part of Thanks2Go's source or shipped UI.

The MV3 popup uses the same palette and local font fallbacks. A browser preview
verified its empty state, rejection of `https://evil.example/p/securedme`, and
acceptance of the canonical profile while preserving the separate Open action.
Actual installation through `chrome://extensions` remains a release gate.
