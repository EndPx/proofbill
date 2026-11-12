import { readFile } from "node:fs/promises";
import { db } from "./index.ts";
await db().unsafe(
  await readFile(new URL("./schema.sql", import.meta.url), "utf8"),
);
await db().begin(async (sql) => {
  await sql.unsafe("select set_config('proofbill.contract_id',$1,true)", [
    process.env.NEAR_CONTRACT_ID ?? "",
  ]);
  await sql.unsafe(
    await readFile(new URL("./relations.sql", import.meta.url), "utf8"),
  );
});
console.log("ProofBill relational schema ready (5 tables)");
await db().end();
