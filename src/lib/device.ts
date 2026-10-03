import type { AstroCookies } from 'astro';

const COOKIE = 'kyc_device';

/**
 * A random ID stored in a cookie, so one browser can react once per story
 * and report a message once. It says nothing about who the visitor is.
 */
export function deviceId(cookies: AstroCookies, secure: boolean): string {
  const existing = cookies.get(COOKIE)?.value;
  if (existing && /^[a-f0-9-]{36}$/.test(existing)) return existing;
  const id = crypto.randomUUID();
  cookies.set(COOKIE, id, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure,
    maxAge: 60 * 60 * 24 * 365 * 2,
  });
  return id;
}
