import type { AstroGlobal } from 'astro';
import { publicClient, sessionClient } from './supabase';

/**
 * Normal visitors read with the public client. A logged-in writer who adds
 * ?preview=1 reads as themselves, so they can see drafts and scheduled stories.
 */
export async function readerClient(Astro: AstroGlobal) {
  if (Astro.url.searchParams.get('preview') !== '1') return { db: publicClient(), preview: false };
  const db = sessionClient(Astro.request, Astro.cookies);
  const { data } = await db.auth.getUser();
  if (!data.user) return { db: publicClient(), preview: false };
  const { data: isWriter } = await db.rpc('is_writer');
  return isWriter ? { db, preview: true } : { db: publicClient(), preview: false };
}
