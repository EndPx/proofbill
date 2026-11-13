// Explicit operator command for this project-owned testnet account; never initializes or rewrites state.
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { Account, KeyPairSigner, actions } from "near-api-js";
import { db, digest } from "@proofbill/server";
import { contractId, provider, view } from "@proofbill/server/chain";
import type { PurchasePass, PurchaseOrder } from "@proofbill/shared";

const root = "proofbill-endpx-2026.testnet";
assert.equal(contractId(), root);
const rpc = provider();
assert.equal(await rpc.getNetworkId(), "testnet");
const beforePasses = await view<PurchasePass[]>("list_passes", {
  from_index: 0,
  limit: 100,
});
const beforeOrders = await view<PurchaseOrder[]>("list_orders", {
  from_index: 0,
  limit: 100,
});
const supply = await view<string>("nft_total_supply");
assert.equal(
  BigInt(supply),
  BigInt(beforePasses.length),
  "Paginate the snapshot before upgrading more than 100 passes",
);
const accountBefore = await rpc.viewAccount({
  accountId: root,
  blockQuery: { finality: "final" },
});
const active =
  await db()`select count(*)::int as count from pb_jobs where contract_id=${root} and (state in ('awaiting_reservation','queued','claimed','reserving','running','publishing') or (state='reconciliation_required' and lease_until is not null) or (state='failed' and result_cipher is not null))`;
assert.equal(
  active[0].count,
  0,
  "Wait for active jobs; never interrupt a provider attempt",
);
assert.ok(
  beforePasses.every(
    (p) => !p.transfer_pending && !["InUse", "RefundPending"].includes(p.phase),
  ),
  "Wait for active onchain operations",
);
console.log(
  JSON.stringify({
    contract_id: root,
    account_balance_yocto: accountBefore.amount.toString(),
    storage_bytes: accountBefore.storage_usage,
    active_jobs: active[0].count,
    passes: beforePasses.length,
  }),
);

if (process.env.CONFIRM_PROOFBILL_TESTNET_UPGRADE === "yes") {
  assert.ok(
    process.env.PROOFBILL_WASM &&
      process.env.EXPECTED_WASM_SHA256 &&
      process.env.EXPECTED_PREVIOUS_WASM_SHA256,
    "Supply reviewed candidate path, candidate SHA-256 and expected current SHA-256",
  );
  const recordName = process.env.UPGRADE_RECORD_NAME ?? "contract-upgrade";
  assert.match(recordName, /^[a-z0-9-]{1,64}$/);
  const backupDir = `.local/upgrades/${recordName}`;
  await mkdir(backupDir, { recursive: true });
  await writeFile(
    `${backupDir}/before.json`,
    JSON.stringify(
      { passes: beforePasses, orders: beforeOrders, account: accountBefore },
      (_, value) => (typeof value === "bigint" ? value.toString() : value),
      2,
    ),
  );
  const wasm = await readFile(process.env.PROOFBILL_WASM);
  assert.equal(digest(wasm), process.env.EXPECTED_WASM_SHA256);
  const previous = await rpc.viewContractCode({
    contractId: root,
    blockQuery: { finality: "final" },
  });
  assert.equal(
    digest(previous.code),
    process.env.EXPECTED_PREVIOUS_WASM_SHA256,
    "Existing code changed; inspect it before another deployment",
  );
  await writeFile(`${backupDir}/previous.wasm`, previous.code);
  const credential = JSON.parse(
    await readFile(
      join(homedir(), ".near-credentials", "testnet", root + ".json"),
      "utf8",
    ),
  );
  const signer = KeyPairSigner.fromSecretKey(
    credential.private_key ?? credential.secret_key,
  );
  const account = new Account(root, rpc, signer);
  const deployed = await account.signAndSendTransaction({
    receiverId: root,
    actions: [actions.deployContract(wasm)],
    waitUntil: "FINAL",
    throwOnFailure: true,
    retries: 0,
  });
  const code = await rpc.viewContractCode({
    contractId: root,
    blockQuery: { finality: "final" },
  });
  assert.equal(digest(code.code), digest(wasm));
  for (const old of beforePasses) {
    const current = await view<PurchasePass>("get_pass", {
      token_id: old.token_id,
    });
    for (const [field, value] of Object.entries(old))
      assert.deepEqual(
        (current as unknown as Record<string, unknown>)[field],
        value,
      );
  }
  for (const old of beforeOrders)
    assert.deepEqual(await view("get_order", { order_id: old.order_id }), old);
  const report = {
    tested_at: new Date().toISOString(),
    network: "testnet",
    contract_id: root,
    deploy_transaction: deployed.transaction.hash,
    wasm_sha256: digest(wasm),
    wasm_bytes: wasm.length,
    preserved_passes: beforePasses.length,
    preserved_orders: beforeOrders.length,
    previous_wasm_sha256: digest(previous.code),
    payment_policies_preserved: true,
    state_reinitialized: false,
  };
  await writeFile(
    `infra/near/${recordName}.json`,
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
}
await db().end();
