import assert from "node:assert/strict";
import { KeyPairSigner, type KeyPairString } from "near-api-js";
import { db } from "@proofbill/server";
import { provider, contractId, view } from "@proofbill/server/chain";
const sql=db();
const query=await sql`select 1 as connected`;
assert.equal(query[0].connected,1);
assert.equal((sql.options.ssl as {rejectUnauthorized?:boolean}).rejectUnauthorized,true);
assert.equal(await provider().getNetworkId(),"testnet");
const config=await view<{network:string}>("get_config");assert.equal(config.network,"testnet");
for(const [role,method] of [["agent","reserve_order"],["publisher","publish_delivery"]] as const){
 const prefix=`NEAR_${role.toUpperCase()}`;const accountId=process.env[prefix+"_ID"],key=process.env[prefix+"_KEY"];
 assert.ok(accountId&&key,"Operational identity not configured");
 const signer=KeyPairSigner.fromSecretKey(key as KeyPairString);
 const access=await provider().viewAccessKey({accountId,publicKey:await signer.getPublicKey()});
 const scope=typeof access.permission==="object"?access.permission.FunctionCall:null;
 assert.equal(scope?.receiver_id,contractId());assert.deepEqual(scope?.method_names,[method]);
}
console.log(JSON.stringify({database_connected:true,database_tls_certificate_verified:true,network:"testnet",agent_scope_valid:true,publisher_scope_valid:true}));
await sql.end();
