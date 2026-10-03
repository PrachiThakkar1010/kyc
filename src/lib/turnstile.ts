import { TURNSTILE_SECRET_KEY } from 'astro:env/server';

/** Asks Cloudflare whether the visitor passed the invisible bot check. */
export async function passedTurnstile(token: FormDataEntryValue | null, ip?: string): Promise<boolean> {
  if (!TURNSTILE_SECRET_KEY) {
    console.warn('TURNSTILE_SECRET_KEY is not set: skipping the bot check.');
    return true;
  }
  if (typeof token !== 'string' || !token) return false;

  const body = new FormData();
  body.append('secret', TURNSTILE_SECRET_KEY);
  body.append('response', token);
  if (ip) body.append('remoteip', ip);

  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
    const result = (await res.json()) as { success: boolean };
    return result.success === true;
  } catch {
    return false;
  }
}
