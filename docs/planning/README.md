# ProofBill build plan

Updated 14 November 2026, Asia/Jakarta. State: **hosted testnet MVP with both agent options, both payment modes and anonymous public receipts.** See [agent/payment evidence](../evidence/agent-payment-hosted.md), [recovery/storage evidence](../evidence/recovery-storage-release.md) and [public receipts](../evidence/public-receipts.md). Product/architecture guides reflect current scope; the delivery plan retains its dated milestone history.

The user selected four build targets: **Agent Economy (`agents`), AI Security & Defense (`security`), Privacy & Private AI (`privacy`), and NFTs That Do Something (`nfts`)**. NFT Purchase Pass is part of the required product scope. Earlier research that calls NFT optional is superseded by this decision.

## Read in order

1. [Product specification and adjusted flow](PRODUCT-SPEC.md) — customer, experience, Purchase Pass rights, money, privacy, screens and track outcomes. This is the home for product decisions.
2. [Technical design](TECHNICAL-DESIGN.md) — responsibilities, state, contract interface, verification bridge, data and authorization. Source/build artifacts define exact interfaces.
3. [Delivery plan](DELIVERY-PLAN.md) — feature milestones, bounded verification, demo and release evidence. This is the home for work status.

## Build outcome

**A holder funds an NFT Purchase Pass, selects the ProofBill assistant or their own agent, and sets Manual or Automatic payment. The agent orders a private AI service; payment follows the chosen authorization and produces a public NEAR testnet receipt after confirmation.** Manual permits review before approval; Automatic has no final review gate. An unused pass transfer moves purchase/refund rights and clears previous assignment and Automatic permission.

Working pitch: **Your agent orders. You stay in control.**

## Historical inputs to the original build

- One actual NEAR AI Cloud response with matching `provider_tee` signature and dated model/gateway preflight evidence; see [feasibility report](../evidence/near-ai-response-probe.md).
- Free NEAR Builders credits claimed; credential is local and ignored, never copied into these documents.
- Two [v2 UI concepts](../../design/proofbill-ui-v2/README.md): charcoal shell/sidebar, inset rounded white content surface, black actions and limited mint/amber accents.

These are inputs to the build. They do not establish NFT deployment, a working app, private sessions, an agent purchase or payment.

## Delivery discipline

Build visible, complete product slices. Add the necessary checks inside the slice, then move to the next feature. Fix defects that prevent the user journey, violate money/ownership/privacy rights, or break reproduction. Defer cosmetic refinements and speculative hardening once the stated checks pass. Do not start repeated audit/refactor loops.

The [delivery plan](DELIVERY-PLAN.md) preserves original milestone context. Current product and technical guides explain behavior; linked release reports establish the tested scope. Planning text is not execution evidence.

## Official references

- [Hackathon rules](https://nearhackathon.com/HACKATHON.md): check current eligibility, track selection, deadline and submission requirements directly with the organizer.
- [NFT track guidance](https://github.com/nearai/near-hackathon-prompt-examples/blob/main/tracks/10-nfts.md): functional ownership/access rights; examples are guidance rather than mandatory architecture.
- [NEP-171](https://github.com/near/NEPs/blob/master/neps/nep-0171.md), [NEAR Connect](https://docs.near.org/tools/near-connect), [NEAR AI response signatures](https://docs.near.ai/cloud/verification/cloud-api/response-signatures).

Recheck submission rules at release. ProofBill replaces the Keyfolio entry; if ShowStake is also submitted, both READMEs disclose the other independent project. Product source and financial state are separate from ShowStake/Keyfolio.
