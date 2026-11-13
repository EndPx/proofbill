# ProofBill design system

## 0. Research log

The user's NEAR Activity screenshot and approved `design/proofbill-ui-v2` images are the visual contract. Use the selected logo assets. The UI/UX search returned an enterprise gateway rather than this operational purchase dashboard; its palette/layout recommendation is rejected. The frontend layout reference supplies bounded scrolling and narrow-screen behavior. Further brand exploration, image generation and repeated performance audits are deferred by the user's request to prioritize the complete flow.

## 1. Atmosphere and identity

A calm purchasing workspace: charcoal chassis/sidebar enclosing one rounded white content sheet. Black actions, restrained mint and amber statuses, receipt-shaped exact-payment summary. No gradients, glows, charts or fictional balances.

## 2. Color

Tokens: shell #252525; shell-card #303030; shell-border #414141; surface #ffffff; subtle #f5f5f5; ink #171717; muted #666666; line #e7e7e7; mint #51e79c; success-ink #08623c; success-surface #e2f9ec; warning-ink #704500; warning-surface #fff0cc; error-ink #a62424; error-surface #fff0f0. Focus uses a visible dark outline on white and mint on charcoal. State text/icons accompany colors.

## 3. Typography

Inter or system sans; weights 400/500/600/700. Page title 32–36px, section 21px, body 15px, compact metadata 13px. Financial amounts use tabular numerals and explicit testnet NEAR units. Long account IDs wrap; no clipped critical payment information.

## 4. Spacing and layout

8px outer rim, 264px desktop sidebar, 24px white-sheet radius, 40–48px desktop content inset. The white sheet clips its contents and keeps a 6px inset around one keyboard-accessible `.content-scroll` region. That region owns vertical scrolling inside the bounded 100dvh shell; the sidebar, rounded sheet and outer rim stay stationary. Use a thin neutral scrollbar, contain overscroll, and keep the header, page content and footer in the same scroll flow. The landing page retains normal document scrolling. Below 900px sidebar becomes compact navigation; below 640px content is one column, 20px inset. Main children use min-width:0; no horizontal page overflow.

## 5. Primitives and states

Button: black primary, outlined secondary, disabled, pending, focus, destructive. Field: persistent label, hint, inline error. Status: Available/In use/Completed/Refund pending/Refunded, evidence Pass/Fail/Unavailable/Not checked. Card: quiet border, receipt variant for payment summary. Table: collapses to labelled cards on mobile. Empty state: clear next action, never sample success. Primitive harness lives at /visual-qa.

## 6. Motion

Only 120ms color/border/opacity feedback. Pending uses text and a small indicator. Reduced motion disables transitions. No autonomous hero motion or timed transaction success.

## 7. Content

Use Purchase Passes, New Purchase Pass, Run agent, Approve payment, Request refund. Distinguish wallet connected from authenticated. Show owner, recipient, amount and network before signing. Show chain-confirmed status and unavailable service configuration honestly.

All `/app` routes first show a wallet entry screen using the existing charcoal frame, rounded white sheet, primary button and bordered panel. Restore an existing connection before deciding which screen to mount; do not flash the workspace while disconnected. Keep the requested route so connection resumes at the intended pass or receipt. Disconnect returns to the entry screen. Connection grants workspace access; a separate signed message still authorizes private reads. Loading, connection failure and wallet cancellation must leave a usable entry screen with a retry or return-home action.

## 8. Verification

One desktop/mobile visual pass, keyboard focus and actual financial pending/error states. Match the approved shell; no redesign loop before the purchase journey works. Check production excludes development instrumentation.

## 9. Public landing page: permission before payment

The user's Assay screenshots and live frontend replace the earlier near.com-inspired marketing direction. The workspace and wallet gate keep their own existing design. Only marketing uses the new dark material system.

Idea: one permission becomes a private delivery and then a payment record. Metaphor: a physical authorization pass and a paper receipt, not a general AI dashboard. Signature: an original mint point-cloud pass morphs into a private-result cube and a receipt; a tactile HTML pass stays in view beside scroll chapters and responds to pointer tilt. Hero: Agents order. You approve.

Research: inspected Assay's live WebGL hero and sticky receipt, plus its MIT source at revision 6c84d9b8c45d627754c17a3a040b0b43fcb129ef. Adapt only the point-morph shaders, with full attribution in THIRD_PARTY_NOTICES.md. ProofBill supplies its own geometry, lifecycle, mint palette, copy and actual testnet references. Do not carry over Assay's identities, model claims, branding or chain data. Archivo is independently self-hosted through Fontsource under its font license.

Marketing palette: ground #101613, ink #eceee7, muted #a4b2a9, line #303d35, mint #51e79c, secondary ice #80cad4, paper #e9e8dc. Archivo Variable headlines at 49–96px/0.98 with negative tracking; existing Inter body at 15–17px/1.65. Mono labels describe states and artifacts. Main content max 1280px; 34px desktop and 20px mobile gutters. Controls use 6–8px corners; physical pass uses 19px; paper receipt has perforated edges. No invented adoption metrics or simulated payment presented as fresh chain evidence.

Generate mint security-foil and receipt-paper material assets with ChatGPT Image. Use them on the interactive HTML purchase object and closing surface, not as a screenshot substitute. Hero point-cloud is real WebGL; generated pass artwork is its readable static fallback. Keep lifecycle illustration and recorded testnet example labels visible.

Composition: restrained header -> oversized statement and interactive 3D object -> tilted actual app snapshot -> sticky three-chapter purchase object -> private/public boundary -> interactive unused-pass handover -> FAQ -> mint material finale. Mobile removes sticky story layout and large perspective transforms; selecting a chapter takes the viewer directly to its detail.

GSAP owns the animation clock. Lenis and WebGL render through its ticker, with scoped cleanup on route exit. WebGL stops drawing when offscreen, tab-hidden or paused. Expose pause and manual shape controls; no automatic financial-looking status transitions. ScrollTrigger changes only the illustrated chapter. Reduced motion uses complete static artwork, no WebGL loop or sticky perspective story, with all controls and essential text usable. No JavaScript still delivers the headline, first illustrative pass, FAQ and app links.

QA must cover real start/mid/reverse scroll, pointer response, shape controls, pause, viewport resize, reduced motion changes, context failure and navigation teardown. Keep screenshots and critic notes local. Preserve wallet gating and financial authority in the contract.

Purchase-stage changes keep the physical card in place. Its base color, foil/paper texture opacity, border and shadow blend over 450ms. Only the printed content fades out for 140ms, replaces at zero opacity, then fades in for 240ms. Scroll pose and pointer tilt retain their existing transform owners. Interruptions cancel superseded text callbacks; the latest selected stage wins. Reduced-motion changes settle the requested content and materials immediately.

The closing CTA is an inset charcoal panel aligned with the content grid, replacing the full-width mint texture. White/mint copy and the primary action occupy the left; a small decorative purchase pass carries a restrained 24% foil texture on the right. Its footer summarizes permission, private result and approval. Mobile stacks those elements; all copy stays readable and the live-app action retains the wallet gate.

The handover illustration uses two named holders and a physical pass that travels between their positions over 650ms. Active-holder styling, a route line, and a compact use/refund + agent-assignment readout explain what changes. Keep Preview/Reset reversible and the illustrative/no-wallet labels visible. Under reduced motion, the same ownership states update immediately. The component owns its scoped stylesheet; the adjacent copy presents the two transferred-rights facts as a short list.

## 10. Interactive landing workspace preview

Replace the static product screenshot with a client-side sandbox that follows the real app's charcoal sidebar and rounded white panel. Purchases, Purchase Passes and Receipts are working local views; order Result/Request/Evidence tabs are keyboard accessible. Include local pass creation, approval simulation, search and reset so controls demonstrate a coherent journey. Use explicit demo-prefixed IDs and synthetic content. Persistent labels say Interactive demo / Sample data; no wallet, API, storage or transaction calls belong to this component. The live-app link remains a real navigation through the wallet gate.

The white preview content owns its bounded internal scroll, with overscroll contained and Lenis excluded from that region. Desktop keeps the side menu; mobile moves the same named menus into a compact top row. Use the existing app's Inter, white panels, charcoal controls and mint statuses inside the marketing frame. Keep all primary controls reachable at 320px. Demo state resets on reload or Reset demo and is never presented as a new onchain outcome.

## 11. Agent and payment authorization

Reuse the workspace Field/select, bordered info panel and black/outlined Button primitives for ProofBill assistant versus My own agent. Custom mode reveals one account-ID field with a persistent label. Payment approval defaults to Manual; Automatic reveals a separate consent checkbox with the fixed service price, seller and delivery trigger. Save is disabled for invalid accounts, missing automatic consent or an in-flight operation. Existing signed policy and purchasing-agent account remain visible in the pass facts. Do not reset edited values on background polling; reset after a changed onchain authorization revision. External-agent instructions link to the executable SDK guide, with no key entry/upload field. Keep the wallet-owned NFT and buyer-only result boundaries visible. Existing scrolling, mobile stacking and reduced-motion rules remain unchanged.
