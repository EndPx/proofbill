// Original generated materials and fallback pass artwork; product image is a recorded testnet receipt.
// Extraction and handover illustrations explain behavior without claiming a new inference or transfer.
export const landing = {
  url: "https://proofbill-two.vercel.app",
  title: "ProofBill | Permission before payment.",
  description:
    "Give your AI agent a funded Purchase Pass on NEAR. Review the private result and its evidence, then approve the exact seller payment.",
  github: "https://github.com/EndPx/proofbill",
  contract:
    "https://testnet.nearblocks.io/address/proofbill-endpx-2026.testnet",
  receipt: "/app/receipts/pass-2-order",
  payment:
    "https://testnet.nearblocks.io/txns/EKHAhwbEjwJos2sAzc7kxvHAnuA4aYS24H7TmjeeKj5Z",
  hero: {
    first: "Agents order.",
    second: "You approve.",
    body: "Give your AI agent a funded Purchase Pass. Review what comes back, inspect the evidence, and approve the exact payment. All in one place.",
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
      title: "Review it. Then approve payment.",
      body: "Inspect the result before your wallet approves the seller payment. The receipt becomes Paid after the contract confirms the transfer.",
      detail:
        "The recorded demo payment can be checked directly on NEAR testnet.",
    },
  ],
  faqs: [
    {
      question: "What can I try today?",
      answer:
        "The testnet MVP offers one service: extracting an item, quantity and requester from a short purchase brief. You can fund a pass, assign the agent, run a task, review its result and evidence, then approve payment or request a refund where the contract permits it.",
    },
    {
      question: "Do I need a NEAR wallet?",
      answer:
        "Yes. Connect a testnet wallet before entering the workspace. A separate signed message unlocks private data. Funding and payment actions ask for your wallet approval; connecting alone does not move funds.",
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
        "An unused pass can move to another holder with its use and refund rights. Transfer clears the previous agent assignment. An active order locks transfer. Refund availability follows the contract state; a completed pass keeps its receipt and has no remaining service allocation.",
    },
  ],
} as const;
