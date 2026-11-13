# Anonymous public receipts and payment-mode wording

Validated 13 November 2026. Feature commit `649e4c8` adds `/receipts/:orderId` and the explicit public DTO at `/api/receipt/:orderId`.

- [Manual receipt](https://proofbill-two.vercel.app/receipts/pass-2-order)
- [Automatic receipt](https://proofbill-two.vercel.app/receipts/pass-10-order)

## Public and private boundaries

The server reads order and NFT data at the same finalized block. A specific field projection exposes the service amount, historical buyer, agent, seller, current NFT holder, payment policy, order/NFT phases, commitments and recorded transaction references. The references query selects public reference columns only. Missing reference persistence does not suppress otherwise readable chain facts.

The receipt reader does not inspect sessions or load private jobs/results, even when a session cookie is supplied. Raw input, output, response bytes, salt, nonce, encryption fields and private verification artifacts are excluded. Native amounts retain full nonzero fractional precision. Pending/refund/failed phases have their own wording; they do not become confirmed seller payments.

Wallet initialization now lives under `/app`. Public receipts server-render without the connector and work with JavaScript disabled; their refresh control is a read-only GET form. `/app/receipts/:orderId` redirects to the public canonical route. Workspace lists, passes and order/private-result screens remain behind the connection gate; private result APIs still require the buyer's signed session. Receipt pages use noindex metadata, which is not an access-control mechanism.

The public receipt explains the actual recorded policy. Manual requires the owner's approval before settlement; Automatic uses advance authorization and matching publisher delivery, without a final wallet approval. Wallet entry and general marketing wording were updated to avoid claiming every payment requires a final approval. Automatic publisher trust and the limits of evidence remain explicit.

## Checks

- Typechecking and sixteen TypeScript tests passed. Eight new receipt tests cover explicit field projection, both modes, historical buyer versus current holder, pending/refunded phases, invalid/missing data, optional transaction references and exact yoctoNEAR precision.
- All thirty browser tests passed against a production build, including eight public-receipt cases. The server-side RPC fixture supports read methods only and the browser-test server masks production secrets. Test fixtures are not production chain evidence.
- Desktop 1440px and mobile 360px checks found no document overflow or serious/critical axe violations. Visual review used the existing white receipt/charcoal frame and corrected the wordmark contrast on white navigation.
- No-JavaScript rendering, legacy redirect, Manual/Automatic copy, workspace connection gate and anonymous private HTTP 401 were exercised. A supplied cookie did not change the public response or cause session lookup.
- [Feature CI](https://github.com/EndPx/proofbill/actions/runs/43422241204) passed. Browser/build checks were additionally run on an isolated Linux server after the local Windows Next build worker terminated.

## Read-only hosted verification

The [live browser/API report](integration/public-receipts-live.json) verifies real Manual `pass-2-order` and Automatic `pass-10-order`: HTTP 200, Paid/Completed, public references, cookie-independent public financial facts and anonymous private HTTP 401. A fresh browser made no wallet-initialization or private endpoint requests while reading public receipts. The legacy URL redirected; entering the workspace still showed Connect to continue. A separate JavaScript-disabled context also read the finalized payment.

The live checks used existing public testnet records. They did not connect a wallet, sign, submit transactions or consume paid inference. A literal configured-credential scan of two hosted HTML pages and fifteen public scripts found zero matches; that limited scan is not a security audit.
