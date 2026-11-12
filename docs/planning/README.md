# ProofBill build plan

Date: 13 November 2026, Asia/Jakarta. State: **live testnet MVP; hosted end-to-end validation passed.** See [hosted release evidence](../evidence/hosted-release.md). This folder retains design intent; source and execution evidence describe what actually runs.

The user selected four build targets: **Agent Economy (`agents`), AI Security & Defense (`security`), Privacy & Private AI (`privacy`), and NFTs That Do Something (`nfts`)**. NFT Purchase Pass is part of the required product scope. Earlier research that calls NFT optional is superseded by this decision.

## Read in order

1. [Product specification and adjusted flow](PRODUCT-SPEC.md) — customer, experience, Purchase Pass rights, money, privacy, screens and track outcomes. This is the home for product decisions.
2. [Technical design](TECHNICAL-DESIGN.md) — responsibilities, state, proposed contract interface, verification bridge, data and authorization. Interfaces are proposed, not deployed methods.
3. [Delivery plan](DELIVERY-PLAN.md) — feature milestones, bounded verification, demo and release evidence. This is the home for work status.

## Build outcome

**A holder funds an NFT Purchase Pass, assigns a purchasing agent, receives a private AI result with inspectable evidence, approves the exact payment, and obtains a confirmed NEAR testnet receipt.** A separate pass transfer demonstrates that purchase/refund authority follows current ownership before use.

Working pitch: **Give your agent a budget. Know what it bought. Pay once.**

## Baseline already available

- One actual NEAR AI Cloud response with matching `provider_tee` signature and dated model/gateway preflight evidence; see [feasibility report](../evidence/near-ai-response-probe.md).
- Free NEAR Builders credits claimed; credential is local and ignored, never copied into these documents.
- Two [v2 UI concepts](../../design/proofbill-ui-v2/README.md): charcoal shell/sidebar, inset rounded white content surface, black actions and limited mint/amber accents.

These are inputs to the build. They do not establish NFT deployment, a working app, private sessions, an agent purchase or payment.

## Delivery discipline

Build visible, complete product slices. Add the necessary checks inside the slice, then move to the next feature. Fix defects that prevent the user journey, violate money/ownership/privacy rights, or break reproduction. Defer cosmetic refinements and speculative hardening once the stated checks pass. Do not start repeated audit/refactor loops.

This task creates planning documents only. No source scaffold, account, deployment, transaction, repository publication or submission is authorized by the planning request.

## Official references

- [Hackathon rules](https://nearhackathon.com/HACKATHON.md): multiple fitting tracks in one submission, testnet eligibility, and public repository/demo requirements. Current deadline: **15 November 2026, 06:59 WIB** (14 November, 23:59 UTC).
- [NFT track guidance](https://github.com/nearai/near-hackathon-prompt-examples/blob/main/tracks/10-nfts.md): functional ownership/access rights; examples are guidance rather than mandatory architecture.
- [NEP-171](https://github.com/near/NEPs/blob/master/neps/nep-0171.md), [NEAR Connect](https://docs.near.org/tools/near-connect), [NEAR AI response signatures](https://docs.near.ai/cloud/verification/cloud-api/response-signatures).

Recheck submission rules at release. ProofBill replaces the Keyfolio entry; if ShowStake is also submitted, both READMEs disclose the other independent project. Product source and financial state are separate from ShowStake/Keyfolio.
