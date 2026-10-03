// A visitor sends a message to a champion's or team's cheer wall.
import type { APIRoute } from 'astro';
import { adminClient } from '../../lib/supabase';
import { deviceId } from '../../lib/device';
import { passedTurnstile } from '../../lib/turnstile';
import { checkMessage } from '../../lib/moderation';
import { isUuid, json, text } from '../../lib/http';

const PER_HOUR = 5;

export const POST: APIRoute = async ({ request, cookies, url, clientAddress, redirect }) => {
  const form = await request.formData().catch(() => null);
  if (!form) return json({ ok: false, error: 'Invalid form.' }, 400);

  const wantsJson = (request.headers.get('Accept') ?? '').includes('application/json');
  const back = request.headers.get('Referer') ?? '/';
  const fail = (error: string, status = 400) => (wantsJson ? json({ ok: false, error }, status) : redirect(back, 303));

  const subject = text(form, 'subject');
  const subjectId = text(form, 'subjectId');
  const message = text(form, 'message', 280);
  const name = text(form, 'name', 60);
  const city = text(form, 'city', 60) || null;
  const tagged = text(form, 'tagged');

  if (!['champion', 'team'].includes(subject) || !isUuid(subjectId)) return fail('Invalid page.');
  if (!message || !name) return fail('Write a message and your name first.');

  if (!(await passedTurnstile(form.get('cf-turnstile-response'), clientAddress))) {
    return fail('The bot check did not pass. Wait a moment and try again.', 403);
  }

  const db = adminClient();
  const device = deviceId(cookies, url.protocol === 'https:');

  // Slow down anyone sending too many messages.
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await db.from('cheers').select('id', { count: 'exact', head: true }).eq('device', device).gte('created_at', since);
  if ((count ?? 0) >= PER_HOUR) return fail('You have sent several cheers already. Try again in an hour.', 429);

  // The champion or team must exist.
  const table = subject === 'team' ? 'teams' : 'champions';
  const { data: target } = await db.from(table).select('id').eq('id', subjectId).maybeSingle();
  if (!target) return fail('This page no longer exists.', 404);

  const flag = checkMessage(message, name, city);
  const status = flag ? 'pending' : 'visible';

  const { error } = await db.from('cheers').insert({
    champion_id: subject === 'champion' ? subjectId : null,
    team_id: subject === 'team' ? subjectId : null,
    tagged_champion_id: subject === 'team' && isUuid(tagged) ? tagged : null,
    name,
    city,
    message,
    status,
    flag_reason: flag,
    device,
  });
  if (error) return fail('Your message could not be saved. Try again.', 500);

  if (!wantsJson) return redirect(`${back.split('#')[0]}#cheer`, 303);
  return json({ ok: true, status, cheer: status === 'visible' ? { name, city, message } : null });
};
