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

## 9. Public landing page: a purchase on the record

Brief: help developers who use paid AI services understand the single-purchase permission, private delivery and holder-approved payment before connecting a wallet. Use the existing Next.js app and CSS Modules so marketing styles do not affect the workspace or wallet entry. All copy describes the testnet MVP; no customer, market or security-audit metrics are assumed.

Reference: near.com, inspected in a real browser on 13 November 2026. Its hero uses 60px/60px medium-weight Figtree, -1.5px tracking, an open white field, narrow border-aligned content and 12px black CTA corners; product previews lead into split explanations, charcoal privacy sections and a green closing CTA. Adapt that spatial rhythm and retain ProofBill's existing Inter, mint and charcoal identity. Do not reuse NEAR's logo, proprietary copy or example balances.

Concept candidates (originality / fit / feasibility / portability, 1–5; lower portability is better):

- Permission slip: a tactile purchase pass accompanies an agent's request. 4 / 5 / 5 / 2. Signature: pass art settles into the actual product record.
- Evidence trail: request, delivery and payment align along a technical timeline. 3 / 5 / 5 / 3. Clear but too close to a generic infrastructure page.
- Checkout counter: a playful shopping scene for agent purchases. 4 / 3 / 3 / 3. More commerce than the current one-service MVP supports.

Selected: permission slip, because the funded NFT and separate holder approval are the product's defining objects. Idea: your agent can order, while you retain approval of the seller payment. Metaphor: a purchase pass becomes a receipt. Emotion: calm authority. Motion verb: settle into place. Screenshot: oversized dark headline, mint pass sculpture, then a framed actual testnet receipt.

Marketing tokens: white #ffffff, ink #171717, muted #606560, line #e4e8e4, pale field #f3f7f3, mint #51e79c, charcoal #252525. Desktop display 64–80px with -0.055em tracking and 1.03 leading; phone 42–48px. Body 17px/1.6. Content max 1280px, gutters 32px desktop and 20px phone, section spacing varies 64/104/128px. Corners 12px for controls, 24px for artwork and product frames. Native details elements handle FAQ; flow selector uses buttons with an explicit selected state and keyboard-operable panels.

Composition: border-aligned header → asymmetric headline/art → full-width actual receipt preview on mint → split interactive three-step explanation → charcoal private/public record comparison → ownership handover diagram → FAQ rows → mint closing statement → quiet footer. Headline and all product copy remain server-rendered. The generated sculpture is decorative art; the product screenshot is an existing recorded testnet receipt, labelled as a snapshot. Example extraction content is explicitly illustrative, never presented as a fresh inference.

Motion: one landing-scoped GSAP context and ticker, Lenis on that same clock, no viewport pinning or loader. The sculpture and preview settle on scroll; buttons move their arrow and respond to press. Keep the site still at rest to favor reading. Reduced motion disables smooth scrolling and all scroll-driven transforms; content remains visible without JavaScript. Cleanup removes the ticker, destroys Lenis and reverts GSAP on leaving the landing page. No global route interception or changes to wallet signing.

Refinement after the first independent screenshot critique: keep a persistent pass motif across the three workflow panels, add a clearly labelled handover illustration with preview/reset controls, magnify the recorded receipt detail on mobile using the same original screenshot, and give the verification-limits link a 28px minimum target. The screenshot ships as a precompressed 49KB WebP at source resolution so enlarged text does not use a low-resolution responsive derivative. Entry into the wallet gate remains immediate; a blocking branded route curtain is deliberately omitted.

Genericness check: replace generic feature-card grids and decorative charts with the real receipt, the fixed allocation/storage distinction, ownership behavior and the operator trust boundary. App access still goes through the wallet gate. QA artifacts, generated source images and critic notes stay local; ship only the optimized selected art, implementation and meaningful tests.
