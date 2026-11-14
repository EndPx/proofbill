export const adminTrust = {
  title: "Who controls the contract account?",
  summary:
    "The testnet contract retains a FullAccess administrator key. Its holder can transfer contract-held NEAR or replace the code without using the app's approval flow. Funding a pass requires trusting that administrator.",
  detail:
    "Spending limits, payment approvals and refund rules describe the current contract's behavior. Method-restricted worker keys limit automation and do not remove account-level administrator authority. Public permissions do not establish private-key custody; renounced administration, timelock or multisig protection is not claimed.",
} as const;
