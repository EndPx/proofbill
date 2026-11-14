// The inference subprocess needs provider access, not database, wallet or deployment credentials.
const allowed = new Set([
  "PATH", "SYSTEMROOT", "WINDIR", "TEMP", "TMP", "HOME", "USERPROFILE",
  "LANG", "LC_ALL", "LC_CTYPE", "TZ", "XDG_CACHE_HOME",
  "SSL_CERT_FILE", "SSL_CERT_DIR", "REQUESTS_CA_BUNDLE", "CURL_CA_BUNDLE",
  "NEAR_AI_CLOUD_API_KEY",
]);

export function inferenceEnvironment(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return {
    ...Object.fromEntries(Object.entries(source).filter(
      ([name, value]) => value !== undefined && allowed.has(name.toUpperCase()),
    )),
    PYTHONNOUSERSITE: "1",
    PYTHONDONTWRITEBYTECODE: "1",
    PYTHONUTF8: "1",
  };
}
