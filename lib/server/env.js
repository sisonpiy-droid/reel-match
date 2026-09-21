// Read per call, not captured at import -- same reasoning as
// presence-project/lib/chat-core.js: a module-level constant can never be
// exercised by a test that sets the env var afterwards.
export const envNum = (name, fallback) => Number(process.env[name] || fallback);
export const upstreamTimeoutMs = () => envNum("UPSTREAM_TIMEOUT_MS", 20000);

export function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}
