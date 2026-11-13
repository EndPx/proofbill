# Reusable Purchase Pass contract

Local Wasm/Sandbox validation on 14 November 2026. This report does not establish a hosted deployment or a real provider call.

An opt-in `create_budget_pass` funds 1–100 fixed-price service purchases. Service budget is separate from storage backing. A sidecar records funded, available, reserved, spent and refunded amounts; their sum must equal the funded amount. Existing Borsh root/pass/order records and legacy single-use creation remain readable.

One order may be active at a time. Reservation moves one service price from available to reserved. Only a successful seller-transfer callback moves it to spent and reopens a pass with remaining funds. Each order has a distinct sequence and recorded payment policy. Successful completion increments authorization revision, invalidating stale requests. Refund transfers the remaining available/reserved service amount; prior seller payments and storage backing are excluded.

Twelve Rust tests and three actual Wasm/Sandbox scenarios passed. The new Sandbox journey exercises two Automatic purchases, handover of the remaining budget, a Manual purchase by the new holder and the final unused-balance refund. It also rejects concurrent reservation and the former holder's refund, and checks that earlier Paid orders and their recorded policies survive later use/refund. Existing receiver-return/failure/storage and legacy lifecycle scenarios still pass. Unit tests cover exhausted budgets and failed payout/refund accounting.

The Sandbox publisher supplies synthetic commitments. It does not prove inference, user demand, or independent hardware verification. Hosted integration and provider checks must be recorded separately before claiming this feature is live.
