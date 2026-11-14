// Run at policy approval/review time, outside the credential-isolated live worker.
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = new URL("../", import.meta.url);
const policy = JSON.parse(await readFile(new URL("workers/inference/deployment-policy.json", root), "utf8"));
const approvedPins = new Set(policy.approvals.map(a => `nearaidev/${a.name}@sha256:${a.image_digest}`));
for (const image of [...Object.values(policy.gateway.images).filter(i => i.startsWith("nearaidev/")), policy.model.manager_image]) {
  if (!approvedPins.has(image)) throw new Error("MISSING_SOURCE_BUILD_APPROVAL");
}
for (const approval of policy.approvals) {
  const manifest = new URL(`docs/evidence/image-approvals/${approval.name}-manifest.json`, root);
  const bundle = new URL(`docs/evidence/image-approvals/${approval.name}-bundle.jsonl`, root);
  const digest = createHash("sha256").update(await readFile(manifest)).digest("hex");
  if (digest !== approval.image_digest) throw new Error("APPROVAL_MANIFEST_MISMATCH");
  const verified = JSON.parse(execFileSync("gh", ["attestation", "verify", fileURLToPath(manifest),
    "--bundle", fileURLToPath(bundle), "--repo", approval.repository, "--format", "json"],
    { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8", maxBuffer: 8_000_000 }));
  // Apply exact policy to cryptographically verified output, never to an unverified bundle payload.
  if (!verified.some(({ verificationResult: result }) => {
    const certificate = result.signature.certificate;
    return certificate.subjectAlternativeName === approval.workflow_identity &&
      certificate.issuer === approval.issuer &&
      certificate.sourceRepositoryDigest === approval.source_revision &&
      certificate.sourceRepositoryURI === `https://github.com/${approval.repository}` &&
      result.statement.subject.some(subject => subject.name === `docker.io/nearaidev/${approval.name}` &&
        subject.digest.sha256 === approval.image_digest);
  })) throw new Error("APPROVAL_SOURCE_POLICY_MISMATCH");
  console.log(`${approval.name}: exact digest, repository, workflow, issuer and source revision verified`);
}
