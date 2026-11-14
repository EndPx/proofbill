import assert from "node:assert/strict";
import { test } from "node:test";
import { inferenceEnvironment } from "./inference-env.ts";

test("inference inherits only the provider credential and required system settings", () => {
  const secret = "synthetic-private-marker";
  const source = {
    PATH: "/usr/bin", XDG_CACHE_HOME: "/opt/proofbill/.runtime/cache",
    REQUESTS_CA_BUNDLE: "/etc/ssl/custom.pem", NEAR_AI_CLOUD_API_KEY: "fixture-provider-key",
    DATABASE_URL: secret, ARTIFACT_ENCRYPTION_KEY: secret, NEAR_AGENT_KEY: secret,
    NEAR_PUBLISHER_KEY: secret, OWN_AGENT_KEY: secret, GH_TOKEN: secret,
    AWS_SECRET_ACCESS_KEY: secret, SSH_AUTH_SOCK: secret, FUTURE_UNRELATED_SECRET: secret,
    PYTHONPATH: secret, PYTHONSTARTUP: secret, NODE_OPTIONS: secret,
  };
  const env = inferenceEnvironment(source);
  assert.deepEqual(env, {
    PATH: source.PATH, XDG_CACHE_HOME: source.XDG_CACHE_HOME,
    REQUESTS_CA_BUNDLE: source.REQUESTS_CA_BUNDLE, NEAR_AI_CLOUD_API_KEY: source.NEAR_AI_CLOUD_API_KEY,
    PYTHONNOUSERSITE: "1", PYTHONDONTWRITEBYTECODE: "1", PYTHONUTF8: "1",
  });
  assert.equal(Object.values(env).includes(secret), false);
  assert.equal(source.DATABASE_URL, secret);
});

test("Windows system-variable casing is preserved and absent keys are not invented", () => {
  const env = inferenceEnvironment({ Path: "C:\\Windows", SystemRoot: "C:\\Windows", TEMP: undefined });
  assert.equal(env.Path, "C:\\Windows");
  assert.equal(env.SystemRoot, "C:\\Windows");
  assert.equal("TEMP" in env, false);
  assert.equal("NEAR_AI_CLOUD_API_KEY" in env, false);
});
