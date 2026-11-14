---
description: "Prices, NFT identity, approval, and private access."
---

# Frequently Asked Questions

## Is one NFT limited to one purchase?

New flexible passes support sequential purchases, with one active order at a time. Available budget, expiry, optional ceiling, and storage still apply. Legacy single-use NFTs keep their original rules.

## Why is 0.010 NEAR mentioned?

It is the current extraction price, not a mandatory owner-defined ceiling. Turning the optional ceiling off removes that extra limit; it does not remove the seller’s charge. Dynamic seller quotes are not implemented today.

## Why does approval appear during minting and assignment?

Minting records the payment mode. The assignment form also edits policy and starts with that saved mode. Funding and agent authorization are separate transactions. Automatic consent is explicitly confirmed for the assignment being saved.

## Does the NFT have its own address?

Contract address plus token ID identifies it. `proofbill-endpx-2026.testnet` and `pass-15` identify one token. Funds are held by the contract under that token; the NFT is not an independent wallet.

## Is the standard NEP-117?

The implementation uses NEP-171 core interfaces, NEP-177 metadata, and NEP-181 enumeration. Custom purchasing restrictions apply. Marketplace compatibility has not been independently established.

## Must I transfer the NFT to my agent?

No. Assign the agent while retaining ownership. A transfer between orders gives remaining rights to a new holder and clears prior agent/Automatic authority.

## Does a service refund include storage?

No. It closes the remaining service budget and excludes prior seller payments and retained storage. History can require additional backing.

## Is the whole application private?

Workspace reads are buyer-authenticated and stored artifacts are encrypted. The operator still handles plaintext during execution. Public financial identities, amounts, policies, and commitments remain public.

## Does a new NFT holder get old results?

No. Private access stays with each historical buyer. Public receipts remain readable by anyone.

## Does verification prove answer quality?

No. It checks recorded evidence and byte/order integrity within its scope. It does not establish semantic accuracy, full image provenance, or which model weights ran.
