// Single-admin MVP: bound attempts across this server instance, not by a spoofable header.
// Multi-instance deployments need a shared limiter before adding more users.
const WINDOW = 15 * 60 * 1000;
const MAX_ATTEMPTS = 20;
let attempts = 0;
let started = 0;
export function allowLogin(now = Date.now()) {
  if (now - started >= WINDOW) { started = now; attempts = 0; }
  if (attempts >= MAX_ATTEMPTS) return false;
  attempts++;
  return true;
}
