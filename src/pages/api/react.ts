// A visitor taps Proud / Inspired / Respect on a story.
import type { APIRoute } from 'astro';
import { adminClient, publicClient } from '../../lib/supabase';
import { deviceId } from '../../lib/device';
import { getReactionCounts } from '../../lib/data';
import { isUuid, json } from '../../lib/http';

const KINDS = ['proud', 'inspired', 'respect'];

export const POST: APIRoute = async ({ request, cookies, url }) => {
  const body = (await request.json().catch(() => null)) as { storyId?: string; kind?: string } | null;
  if (!body || !isUuid(body.storyId) || !KINDS.includes(body.kind ?? '')) {
    return json({ error: 'Invalid reaction.' }, 400);
  }

  // Only published, visible stories can be reacted to.
  const { data: story } = await publicClient().from('stories').select('id').eq('id', body.storyId).maybeSingle();
  if (!story) return json({ error: 'Story not found.' }, 404);

  const device = deviceId(cookies, url.protocol === 'https:');
  // The same browser can only add each reaction once; repeats are ignored.
  await adminClient()
    .from('reactions')
    .upsert({ story_id: story.id, kind: body.kind, device }, { onConflict: 'story_id,kind,device', ignoreDuplicates: true });

  return json({ counts: await getReactionCounts(publicClient(), story.id) });
};
