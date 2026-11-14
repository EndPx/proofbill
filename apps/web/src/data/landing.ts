// Original generated materials and fallback pass artwork; product image is a recorded testnet receipt.
// Extraction and handover illustrations explain behavior without claiming a new inference or transfer.
export const landing = {
  url: "https://proofbill-two.vercel.app",
  title: "ProofBill | Permission before payment.",
  description:
    "Give your AI agent a funded Purchase Pass on NEAR. Choose Manual approval or preauthorized Automatic payment, then inspect its public receipt.",
  github: "https://github.com/EndPx/proofbill",
  contract:
    "https://testnet.nearblocks.io/address/proofbill-endpx-2026.testnet",
  receipt: "/receipts/pass-13-order-1",
  payment:
    "https://testnet.nearblocks.io/txns/HjdeMa8SLTTeKSpvoHasf2JJk7Z5Jw5PjgpNGQMpzLoE",
  hero: {
    first: "Agents order.",
    second: "You decide.",
    body: "Fund one Purchase Pass, choose the ProofBill assistant or your own agent, and set your payment policy. Review before paying in Manual mode, or authorize Automatic payment in advance.",
    note: "Built on NEAR testnet. Start with your wallet.",
  },
  steps: [
    {
      title: "Fund a Purchase Pass",
      body: "Choose your total service budget and an optional maximum per purchase. Your NFT carries the remaining allocation and fixes the seller before your agent can order.",
      detail:
        "One active order at a time. Unspent service funds can be refunded; storage is separate.",
    },
    {
      title: "Give your agent the brief",
      body: "The agent requests private brief extraction through NEAR AI Cloud. Your result and the response evidence stay attached to that purchase.",
      detail:
        "Sign a wallet message to open your private result and evidence report.",
    },
    {
      title: "Your policy. Your payment.",
      body: "Manual mode lets you inspect the result before approving. Automatic mode uses your advance authorization after matching delivery. Paid appears after the transfer is confirmed.",
      detail:
        "Manual is the default. Automatic payment is an explicit per-pass choice.",
    },
  ],
  faqs: [
    {
      question: "What can I try today?",
      answer:
        "The testnet MVP extracts an item, quantity and requester from a purchase brief. Fund a reusable budget and assign the ProofBill assistant or your own agent. Manual payment lets you review each delivery; Automatic uses your advance authorization. Paid appears only after a successful seller transfer. Refunds follow contract state.",
    },
    {
      question: "Do I need a NEAR wallet?",
      answer:
        "Public receipts need no wallet. Connect a testnet wallet to enter the workspace, then sign a separate message to unlock private data. Funding and policy changes require a wallet transaction. Manual payment asks again; Automatic payment uses explicit advance authorization. Connecting alone does not move funds.",
    },
    {
      question: "What does the Purchase Pass pay for?",
      answer:
        "The current service quote is 0.010 testnet NEAR. Choose a total covering that quote, with no price-step or 1 NEAR ceiling, and optionally cap each purchase. Starting storage backing is separate, at least 0.030 NEAR regardless of your total. A 1 NEAR service budget therefore starts at 1.030 NEAR plus gas. Retained history can need an owner-approved storage top-up later. Refunds return unspent service funds; earlier payments and storage are excluded.",
    },
    {
      question: "Does verified evidence mean the AI answer is correct?",
      answer:
        "No. Response signatures and attestation checks help establish response integrity and its stated execution context. They do not guarantee answer accuracy. ProofBill's operator handles plaintext, and its offchain evidence publisher remains trusted. The current verifier checks NRAS JWT signatures and claims against NVIDIA's HTTPS signing keys. TLS binding and a source-image allowlist remain unchecked. Older deliveries keep their original check labels and scope.",
    },
    {
      question: "Can I transfer or refund a pass?",
      answer:
        "Between orders, a pass can move to another holder with its remaining use and refund rights. Transfer clears the previous agent assignment and Automatic permission. Active orders lock transfer. Earlier private results remain with their historical buyers. Refunds return unspent service funds; earlier seller payments and storage are excluded.",
    },
  ],
} as const;
