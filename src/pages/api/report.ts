// A visitor reports a cheer. Three reports from different browsers hide it
// until a writer reviews it (handled by a database trigger).
import type { APIRoute } from 'astro';
import { adminClient } from '../../lib/supabase';
import { deviceId } from '../../lib/device';
import { isUuid, json } from '../../lib/http';

export const POST: APIRoute = async ({ request, cookies, url }) => {
  const body = (await request.json().catch(() => null)) as { cheerId?: string } | null;
  if (!body || !isUuid(body.cheerId)) return json({ error: 'Invalid report.' }, 400);

  const device = deviceId(cookies, url.protocol === 'https:');
  await adminClient()
    .from('cheer_reports')
    .upsert({ cheer_id: body.cheerId, device }, { onConflict: 'cheer_id,device', ignoreDuplicates: true });

  return json({ ok: true });
};
