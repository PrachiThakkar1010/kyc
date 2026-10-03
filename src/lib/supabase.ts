import { createClient } from '@supabase/supabase-js';
import { createServerClient, parseCookieHeader } from '@supabase/ssr';
import type { AstroCookies } from 'astro';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY } from 'astro:env/server';

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

/** Reads public content as an anonymous visitor. Row Level Security applies. */
export function publicClient() {
  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, noSession);
}

/**
 * Full access, skips Row Level Security. Server only. Used for things
 * visitors submit (after we check them) and for managing writer accounts.
 */
export function adminClient() {
  return createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, noSession);
}

/** Acts as the logged-in writer, using their login cookie. */
export function sessionClient(request: Request, cookies: AstroCookies) {
  return createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return parseCookieHeader(request.headers.get('Cookie') ?? '').map((c) => ({
          name: c.name,
          value: c.value ?? '',
        }));
      },
      setAll(list) {
        for (const { name, value, options } of list) {
          cookies.set(name, value, options as Parameters<AstroCookies['set']>[2]);
        }
      },
    },
  });
}

/** Turns a stored photo path into a full web address. */
export function photoUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return `${SUPABASE_URL}/storage/v1/object/public/photos/${path}`;
}
