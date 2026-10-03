// Helpers shared by the writer panel pages.
import type { SupabaseClient } from '@supabase/supabase-js';
import { slugify } from './format';

/** A web address part that no other row in the table uses yet. */
export async function uniqueSlug(
  db: SupabaseClient,
  table: 'stories' | 'champions' | 'teams',
  wanted: string,
  excludeId?: string,
): Promise<string> {
  const base = slugify(wanted) || 'item';
  for (let i = 1; i < 50; i++) {
    const candidate = i === 1 ? base : `${base}-${i}`;
    let query = db.from(table).select('id').eq('slug', candidate);
    if (excludeId) query = query.neq('id', excludeId);
    const { data } = await query.maybeSingle();
    if (!data) return candidate;
  }
  return `${base}-${crypto.randomUUID().slice(0, 6)}`;
}

/** Back to a page with a green message (msg) or a red one (error). */
export function withMessage(path: string, message: string, kind: 'msg' | 'error' = 'msg') {
  const [base, query = ''] = path.split('?');
  const params = new URLSearchParams(query);
  params.delete('msg');
  params.delete('error');
  params.set(kind, message);
  return `${base}?${params}`;
}

/** An easy-to-type temporary password, like "kyc-7hq2-m9xr-4tbe". */
export function temporaryPassword(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
  return `kyc-${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}`;
}

/** Turns a database error into a sentence a writer can act on. */
export function friendlyError(error: { message: string; code?: string } | null, fallback = 'Something went wrong. Try again.'): string {
  if (!error) return fallback;
  if (error.code === '23505') {
    if (error.message.includes('stories_one_per_day')) return 'Another published story already has that date. Choose a different day.';
    if (error.message.includes('slug')) return 'That web address is already used. Change the "Web address" field.';
    return 'That already exists.';
  }
  if (error.code === '42501') return 'You do not have permission to do that.';
  return error.message || fallback;
}
