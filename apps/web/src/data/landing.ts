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
  receipt: "/receipts/pass-2-order",
  payment:
    "https://testnet.nearblocks.io/txns/EKHAhwbEjwJos2sAzc7kxvHAnuA4aYS24H7TmjeeKj5Z",
  hero: {
    first: "Agents order.",
    second: "You decide.",
    body: "Fund one Purchase Pass, choose the ProofBill assistant or your own agent, and set your payment policy. Review before paying in Manual mode, or authorize Automatic payment in advance.",
    note: "Built on NEAR testnet. Start with your wallet.",
  },
  steps: [
    {
      title: "Fund a Purchase Pass",
      body: "Start with one fixed-price service. Your NFT holds the service allocation and names the seller before your agent can order.",
      detail:
        "One pass authorizes one purchase. Storage is budgeted separately.",
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
        "The testnet MVP extracts an item, quantity and requester from a purchase brief. Assign the ProofBill assistant or your own agent. Manual payment lets you review before approving; Automatic payment starts after matching publisher delivery. Paid appears only after the seller transfer succeeds. Refunds follow contract state.",
    },
    {
      question: "Do I need a NEAR wallet?",
      answer:
        "Public receipts need no wallet. Connect a testnet wallet to enter the workspace, then sign a separate message to unlock private data. Funding and policy changes require a wallet transaction. Manual payment asks again; Automatic payment uses explicit advance authorization. Connecting alone does not move funds.",
    },
    {
      question: "What does the Purchase Pass pay for?",
      answer:
        "The current service allocation is 0.010 testnet NEAR. Minting also reserves a separate 0.030 NEAR storage budget, plus transaction gas. Storage is not part of the service refund. Review the amounts in your wallet before signing.",
    },
    {
      question: "Does verified evidence mean the AI answer is correct?",
      answer:
        "No. Response signatures and attestation checks help establish response integrity and its stated execution context. They do not guarantee answer accuracy. ProofBill's operator handles plaintext, and its offchain evidence publisher remains trusted. The current policy does not check TLS binding, a source-image allowlist or the NRAS JWT chain locally.",
    },
    {
      question: "Can I transfer or refund a pass?",
      answer:
        "An unused pass can move to another holder with its use and refund rights. Transfer clears the previous agent assignment and automatic-payment permission. An active order locks transfer. Refund availability follows the contract state; a completed pass keeps its receipt and has no remaining service allocation.",
    },
  ],
} as const;
