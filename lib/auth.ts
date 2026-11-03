import { createHash, createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(scryptCallback);
export const SESSION_COOKIE = 'escala_session';
export const SESSION_SECONDS = 8 * 60 * 60;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function configuration() {
  const email = process.env.ESCALA_ADMIN_EMAIL?.trim().toLowerCase();
  const storedHash = process.env.ESCALA_ADMIN_PASSWORD_HASH;
  const password = process.env.ESCALA_ADMIN_PASSWORD;
  const hash = storedHash || (password && password.length >= 12 && password.length <= 256 ? `env$${createHash('sha256').update(password).digest('hex')}` : undefined);
  const secret = process.env.ESCALA_SESSION_SECRET;
  if (!email || !EMAIL.test(email) || !hash || !(/^(scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}|env\$[a-f0-9]{64})$/.test(hash)) || !secret || secret.length < 32) return null;
  return { email, hash, secret };
}
export function authConfigured() { return configuration() !== null; }
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, 64) as Buffer;
  return `scrypt$${salt}$${key.toString('hex')}`;
}
export async function verifyCredentials(email: string, password: string) {
  const config = configuration();
  if (!config || password.length > 256) return false;
  if (config.hash.startsWith('env$')) {
    const expected = Buffer.from(config.hash.slice(4), 'hex');
    const actual = createHash('sha256').update(password).digest();
    return timingSafeEqual(actual, expected) && email.trim().toLowerCase() === config.email;
  }
  const [, salt, expected] = config.hash.split('$');
  const key = await scrypt(password, salt, 64) as Buffer;
  return timingSafeEqual(key, Buffer.from(expected, 'hex')) && email.trim().toLowerCase() === config.email;
}
function subject(email: string, hash: string) { return createHash('sha256').update(email + '\0' + hash).digest('hex'); }
export function createSession(now = Date.now()) {
  const config = configuration();
  if (!config) throw new Error('Authentication is not configured');
  const iat = Math.floor(now / 1000);
  const payload = Buffer.from(JSON.stringify({ v: 1, sub: subject(config.email, config.hash), iat, exp: iat + SESSION_SECONDS, nonce: randomBytes(16).toString('hex') })).toString('base64url');
  const signature = createHmac('sha256', config.secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}
export function verifySession(token: string | undefined, now = Date.now()) {
  const config = configuration();
  if (!config || !token || token.length > 1024) return false;
  try {
    const parts = token.split('.');
    if (parts.length !== 2 || !/^[A-Za-z0-9_-]+$/.test(parts[0]) || !/^[A-Za-z0-9_-]{43}$/.test(parts[1])) return false;
    const expected = createHmac('sha256', config.secret).update(parts[0]).digest();
    const actual = Buffer.from(parts[1], 'base64url');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return false;
    const data = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    const current = Math.floor(now / 1000);
    return data.v === 1 && data.sub === subject(config.email, config.hash) && Number.isInteger(data.iat) && data.iat <= current && data.exp === data.iat + SESSION_SECONDS && data.exp > current;
  } catch { return false; }
}
export function cookieFromRequest(request: Request) {
  return request.headers.get('cookie')?.split(';').map(s => s.trim()).find(s => s.startsWith(SESSION_COOKIE + '='))?.slice(SESSION_COOKIE.length + 1);
}
export function authenticated(request: Request) { return verifySession(cookieFromRequest(request)); }
function requestAuthority(request: Request) {
  // Next.js may expose an internal address in request.url. Host retains the
  // address used by the browser; do not trust a client-supplied forwarded host.
  return request.headers.get('host') ?? new URL(request.url).host;
}
function isLoopback(hostname: string) { return ['localhost', '127.0.0.1', '[::1]'].includes(hostname); }
export function sameOrigin(request: Request) {
  try {
    const origin = request.headers.get('origin');
    if (!origin) return false;
    const provided = new URL(origin);
    const expected = new URL(`https://${requestAuthority(request)}`);
    const protocol = isLoopback(expected.hostname) ? new URL(request.url).protocol : 'https:';
    return provided.origin === origin && provided.host === expected.host && provided.protocol === protocol;
  } catch { return false; }
}
export function sessionCookieOptions(request: Request) {
  const hostname = new URL(`https://${requestAuthority(request)}`).hostname;
  return { httpOnly: true, sameSite: 'lax' as const, secure: !isLoopback(hostname), path: '/', maxAge: SESSION_SECONDS };
}
