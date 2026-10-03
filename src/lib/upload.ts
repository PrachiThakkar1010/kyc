import type { SupabaseClient } from '@supabase/supabase-js';

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 8 * 1024 * 1024;

/**
 * Uploads a photo from a form to the "photos" storage bucket.
 * Returns the stored path, null if no file was chosen, or throws a readable error.
 */
export async function uploadPhoto(
  db: SupabaseClient,
  file: FormDataEntryValue | null,
  folder: string,
): Promise<string | null> {
  if (!file || typeof file === 'string' || file.size === 0) return null;
  if (!ALLOWED.includes(file.type)) throw new Error('Photos must be JPG, PNG or WebP.');
  if (file.size > MAX_BYTES) throw new Error('That photo is larger than 8 MB. Choose a smaller one.');

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await db.storage.from('photos').upload(path, file, {
    contentType: file.type,
    cacheControl: '31536000',
    upsert: false,
  });
  if (error) throw new Error(`Photo upload failed: ${error.message}`);
  return path;
}

/** Removes photos that are no longer used. Failures are ignored. */
export async function removePhotos(db: SupabaseClient, paths: (string | null | undefined)[]) {
  const list = paths.filter((p): p is string => !!p);
  if (list.length) await db.storage.from('photos').remove(list);
}
