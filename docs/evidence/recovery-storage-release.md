# Recovery and NFT storage release

Validated 13 November 2026. Functional fixes were committed separately: `2a5f072` for worker recovery and `a255b6e` for asynchronous NFT storage. Internal mock-judge reports are not part of this release.

## Reproduced regressions and checks

- The original quick-restart claim test failed against isolated PostgreSQL; expired active work remained unclaimable. The fix passed fifteen queue and sixteen worker-recovery tests, including actual SIGKILL/restart and continued polling, lease heartbeats/fencing, saved publication, unknown inference, transport acknowledgement loss and privacy erasure. RPC/provider/payment boundaries in those crash tests are durable fixtures. [Worker evidence](worker-recovery.md).
- The original storage unit test lost the 1,024-byte rollback reserve. The previous deployed Wasm reproduced credit `2070 -> 1046 -> 22` bytes and blocked the third asynchronous handover. The candidate passed eight Rust unit tests and both Wasm/Sandbox scenarios, including repeated keep/return/failure, maximum-length IDs, interleaved mint accounting, callback replay rejection and later use/refund. [Storage evidence](nft-transfer-storage.md).
- Typechecking and eight ordinary TypeScript tests passed. [Recovery CI](https://github.com/EndPx/proofbill/actions/runs/43406126409) and [NFT-fix CI](https://github.com/EndPx/proofbill/actions/runs/43410605611) passed; their workflow also runs PostgreSQL checks, the production build and browser journeys. Rust/Sandbox was run separately on the server.

## Deployment compatibility

The [upgrade record](../../infra/near/nft-storage-credit-upgrade.json) identifies transaction [Dyx1n3EniZ93zwFY69QwvVD388YPXWWgvmadniRG7RjX](https://testnet.nearblocks.io/txns/Dyx1n3EniZ93zwFY69QwvVD388YPXWWgvmadniRG7RjX). The reviewed previous code hash was checked before deployment and the deployed candidate hash was checked afterward. Nine pre-existing passes and nine orders retained their original fields and Manual/Automatic policies; no state was reinitialized.

The migration adds nullable lease fencing metadata. The live worker was updated while no jobs were active. No live process was killed for fault injection. The NFT fix preserves root/pass/order Borsh layouts and accounts for pending storage through a temporary marker.

## Real hosted smoke and artifact compatibility

The [pass-10 integration](integration/pass-10-order.json) used the hosted API, an external agent signer, the updated worker, actual NEAR AI inference and Automatic testnet settlement. The order reached Paid and the NFT Completed. Buyer-only result access and duplicate-payment rejection passed. [Receipt](https://proofbill-two.vercel.app/app/receipts/pass-10-order).

The [real-artifact recovery check](integration/worker-real-artifact-recovery.json) copied that encrypted saved input/result into an isolated PostgreSQL schema as an expired publishing job. The new runner read actual finalized chain state and reconciled it to delivered with zero provider calls and zero publication calls. The production job was unchanged, and no private artifact or key is included in the report. This is a controlled recovery simulation using a real saved result, not a claim that the live worker was crashed.

## Repeated live asynchronous returns

The [live NFT record](integration/nft-credit-live.json) documents four `nft_transfer_call` attempts to a project-owned account without a receiver method. Each expected receiver failure resolved by returning the NFT to its owner, advancing its revision and clearing pending status. Agent assignment and Automatic permission were cleared. Credit stayed exactly `21450000000000000000000` yoctoNEAR after the first return and across all following returns; the first return additionally reclaimed storage freed by authorization cleanup.

The current holder then received the service-allocation refund and the NFT ended Refunded. No paid inference was used for this transfer test. Keep/explicit-true-return/mixed activity/long-ID paths were exercised in Sandbox; only the failed-receiver path was repeated on live testnet.

All hosted actions used project-owned testnet accounts and synthetic input. These checks establish the stated paths, not a production security audit, mainnet readiness, organic adoption or successful recovery of an unknowable provider response. Unknown inference still requires a safe review/refund outcome rather than another model call.
