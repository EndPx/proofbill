# ProofBill MVP validation

Date: 13 November 2026, Asia/Jakarta. Network: NEAR testnet. These are project-owned scripted accounts, not customer traction. Hosting validation is tracked separately.

This is the historical Manual-first validation matrix. Later scope is recorded in the [agent/payment release](agent-payment-hosted.md), [recovery/storage release](recovery-storage-release.md) and [public-receipt checks](public-receipts.md). Original outcomes below are retained as evidence of that baseline.

## Executed outcomes

| Boundary | Outcome | Scope |
| --- | --- | --- |
| Five-table ERD | Neon information_schema confirmed five PKs and five FKs; jobs use UUID and scoped order/pass uniqueness | Actual application database |
| Holder authentication | Alice and Bob signed NEP-413 challenges; API created separate private sessions | SDK wallet-key signatures over HTTP, not a claimed browser-wallet confirmation |
| NFT purchase right | Alice minted/funded pass-1, assigned an agent, transferred to Bob; prior assignment cleared and Alice refund refused | Actual testnet transactions |
| Agent order | Restricted agent account reserved pass-1-order; method-limited publisher recorded delivery | Actual testnet transactions |
| Private AI | Synthetic brief produced item=workshop notebooks, quantity=12, requested_by=Community team; required TDX/GPU/signature checks passed | Actual NEAR AI response and vendor evidence |
| Private read | Bob could read the result; Alice received 404 | Actual authenticated API requests |
| Seller payment | Holder-approved 0.010 native testnet NEAR payout completed; NFT metadata became Completed | Actual receiver result/contract state |
| Repeat payment | Same order refused with ORDER_NOT_PAYABLE | Actual failed testnet transaction |
| Receiver callbacks | True returned ownership, false retained it, missing receiver code rolled it back; refund rights followed resulting ownership | Actual Wasm in local Sandbox |
| Native payout failure | Nonexistent Sandbox seller caused TransferFailed; holder refund completed; later retry refused | Local Sandbox, synthetic publisher statement |
| UI | Desktop shell and 390px mobile form inspected; no horizontal document overflow; testnet wallet selector opened | Local browser, no user financial signing automated |
| Credential boundary | Configured secret values absent from local browser static JS/maps; API uses a server-only import boundary | Scoped build scan, not a security audit |

## Public chain references

| Action | Transaction hash |
| --- | --- |
| Deploy and init | `Awp98RaHMsffcfz9HqrLCaPR6WeCaWig3suGq816pyHY` |
| Mint pass-1 | `CusUPPqWLaa8HCnGZPd2eyThcbTPU63K8mM1vFDihDUY` |
| Initial assignment | `2W4x7wTF6Ncto7p2JKp8bE5eBUAAGPXstjKs1D7B5wqr` |
| Transfer to Bob | `Hc6rBA4HnEYbueLTuRpu1VVUdyHLteq1Sxj9Zgi67VhU` |
| Old holder refused | `CZ8ZZFedvqqKb6FSDSdxj4kXfjXUKazXbJ8uCVhXVvE4` |
| Bob assignment | `DyuQGsxY4nra74b4RX9D1rWkjjDNNLn8ApdkCxrsBwFD` |
| Reserve order | `CRNZhG9Wob7xGSHvd6CPXncP8Cdhd8JQaakUJvu3gwiT` |
| Publish verified delivery | `FKX97BMiwFiLrKrS3wbNBH5uDzn8knMiRz41S1UdnUJF` |
| Seller payment | `9s1TrL3tjWUFn4kuLY2JLfSkztN2MC8LAssPrebcp1vJ` |
| Duplicate payment refused | `EEVzKgstU98jiwA4UbWL6U27REW3vXX13XRuc5kv94KU` |

Inspect via `https://testnet.nearblocks.io/txns/<hash>`. The [integration record](integration/pass-1-order.json) contains the completed HTTP/provider/payment checks. It resumed the already-funded/transferred pass after correcting a local origin configuration mismatch; it did not claim a new mint in that resumed phase.

## Commands executed

- `pnpm check`: all TypeScript modules passed.
- `pnpm test`: three amount/rights/encryption tests passed.
- `pnpm build`: production Next.js build passed.
- `cargo test --lib`: three contract unit tests passed.
- `cargo test --test test_basics -- --nocapture`: Wasm/Sandbox callback/refund scenario passed.
- Explicit testnet integration script: passed against actual provider/chain state.

## Limits retained

The initialized publisher is a trusted application verifier. Contract code does not independently validate hardware quotes. TLS SPKI binding and independent source/image allowlisting were not checked; NRAS uses authenticated HTTPS rather than local JWT-chain verification. Signed output does not prove accuracy. The app operator processes plaintext during execution. No mainnet readiness, audit, independent adoption or browser financial approval is inferred from these results.
