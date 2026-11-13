import { runOnce } from "../../../../workers/agent/src/runner.ts";
import { fixtureSql, fixtureRuntime } from "./worker-runtime.ts";
const sql = fixtureSql();
try {
  const runtime = fixtureRuntime(sql, {
    crash: process.env.WORKER_FIXTURE_CRASH,
    afterPublishOwner: process.env.WORKER_FIXTURE_NEW_OWNER,
  });
  let worked = await runOnce(runtime);
  if (!worked && process.env.WORKER_FIXTURE_POLL === "yes") {
    console.log("fixture-idle");
    for (let i = 0; i < 100 && !worked; i++) {
      await new Promise((r) => setTimeout(r, 25));
      worked = await runOnce(runtime);
    }
    if (!worked) throw new Error("FIXTURE_POLL_TIMEOUT");
  }
  console.log(JSON.stringify({ worked }));
} finally {
  await sql.end();
}
