/** Shared-passcode gate: the cookie token, its checks, and which requests the proxy lets through. */

export const GATE_COOKIE = 'pogs_gate';
export const GATE_MAX_AGE = 86400; // 1 day

const enc = new TextEncoder();

/** HMAC of a fixed message keyed by the passcode, so changing the passcode invalidates every cookie. */
export async function gateToken(passcode: string): Promise<string> {
  const key = await globalThis.crypto.subtle.importKey('raw', enc.encode(passcode), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await globalThis.crypto.subtle.sign('HMAC', key, enc.encode('pogs-gate-v1')));
  return btoa(String.fromCharCode(...sig)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Compares in time independent of where the strings differ. */
export function safeEqual(a: string, b: string): boolean {
  const n = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < n; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

export async function isValidGateCookie(value: string | undefined, passcode: string | undefined): Promise<boolean> {
  if (!value || !passcode) return false;
  return safeEqual(value, await gateToken(passcode));
}

/** Only same-origin relative paths survive; anything that could leave the site becomes '/'. */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return '/';
  return next;
}

export type GateDecision = 'allow' | 'redirect' | 'deny';

const PUBLIC_PREFIXES = ['/_next/', '/fonts/', '/sheet-assets/'];

export function gateDecision(pathname: string, unlocked: boolean): GateDecision {
  if (unlocked || pathname === '/unlock' || pathname === '/api/unlock') return 'allow';
  if (pathname === '/api' || pathname.startsWith('/api/')) return 'deny';
  // public/ files: known asset folders, or anything whose last segment has an extension (favicon.ico, *.svg)
  const last = pathname.slice(pathname.lastIndexOf('/') + 1);
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p)) || /\.[A-Za-z0-9]+$/.test(last)) return 'allow';
  return 'redirect';
}
