import { scryptSync } from 'node:crypto';
import { createSession } from '../lib/auth';
// Test-only identity. These values are never used as application defaults.
export const testEmail = 'admin@example.test';
export const testPassword = 'test-only-password-2026';
const salt = '0123456789abcdef0123456789abcdef';
export const testAuthEnv = {
 ESCALA_ADMIN_EMAIL: testEmail,
 ESCALA_ADMIN_PASSWORD: '',
 ESCALA_ADMIN_PASSWORD_HASH: `scrypt$${salt}$${scryptSync(testPassword, salt, 64).toString('hex')}`,
 ESCALA_SESSION_SECRET: 'test-only-session-secret-never-use-in-production-2026'
};
export function configureTestAuth() { Object.assign(process.env, testAuthEnv); }
export function authenticatedRequest(url: string, init: RequestInit = {}) {
 const headers = new Headers(init.headers);
 headers.set('cookie', `escala_session=${createSession()}`);
 return new Request(url, { ...init, headers });
}
