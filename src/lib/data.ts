// All the reads the public website makes. Each function takes a Supabase
// client, so the same code works for visitors and for the writer panel.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Champion, Cheer, Medal, MedalKind, Stop, Story, Team } from './types';
import { MEDAL_ORDER } from './format';

const STORY_FIELDS =
  'id, slug, headline, hook, champion_id, team_id, cover_path, cover_credit, featured_on, status, author_name, ' +
  'champion:champions(*), team:teams(*), stops:story_stops(*)';

function sortStops<T extends { stops?: Stop[] }>(story: T): T {
  story.stops?.sort((a, b) => a.position - b.position);
  return story;
}

// ---------------------------------------------------------------------
// Medal tally
// ---------------------------------------------------------------------
export async function getTally(db: SupabaseClient) {
  const [{ data: medals }, { data: settings }] = await Promise.all([
    db.from('medals').select('medal'),
    db.from('settings').select('key, value'),
  ]);
  const counts: Record<MedalKind, number> = { gold: 0, silver: 0, bronze: 0 };
  for (const m of medals ?? []) counts[m.medal as MedalKind]++;
  const setting = (key: string) => settings?.find((s) => s.key === key)?.value ?? '';
  return {
    counts,
    total: counts.gold + counts.silver + counts.bronze,
    asOf: setting('tally_as_of'),
    note: setting('tally_note'),
  };
}

// ---------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------

/** Published stories whose day has come, newest first. */
export async function getStories(db: SupabaseClient, limit = 200): Promise<Story[]> {
  const { data } = await db
    .from('stories')
    .select(STORY_FIELDS)
    .eq('status', 'published')
    .order('featured_on', { ascending: false })
    .limit(limit);
  return ((data ?? []) as unknown as Story[]).map(sortStops);
}

export async function getStoryBySlug(db: SupabaseClient, slug: string): Promise<Story | null> {
  const { data } = await db.from('stories').select(STORY_FIELDS).eq('slug', slug).maybeSingle();
  return data ? sortStops(data as unknown as Story) : null;
}

/** The newest published story for a champion or team, if any. */
async function getStoryFor(db: SupabaseClient, column: 'champion_id' | 'team_id', id: string) {
  const { data } = await db
    .from('stories')
    .select(STORY_FIELDS)
    .eq(column, id)
    .eq('status', 'published')
    .order('featured_on', { ascending: false })
    .limit(1);
  const story = (data?.[0] as unknown as Story) ?? null;
  return story ? sortStops(story) : null;
}

/** Name and link of the person or team a story is about. */
export function storySubject(story: Story) {
  if (story.team) {
    return { name: story.team.name, sport: story.team.sport, href: `/teams/${story.team.slug}`, isTeam: true };
  }
  const c = story.champion;
  return {
    name: c?.name ?? '',
    sport: c?.sport ?? '',
    href: c ? `/champions/${c.slug}` : '#',
    isTeam: false,
  };
}

// ---------------------------------------------------------------------
// Champions directory: every individual and every team, with their medals
// ---------------------------------------------------------------------
export interface DirectoryEntry {
  kind: 'champion' | 'team';
  id: string;
  slug: string;
  href: string;
  name: string;
  sport: string;
  state: string | null;
  photo_path: string | null;
  medals: MedalKind[];
  hasStory: boolean;
}

export async function getDirectory(db: SupabaseClient): Promise<DirectoryEntry[]> {
  const [champs, teams, members, medals, stories] = await Promise.all([
    db.from('champions').select('id, slug, name, sport, state, photo_path'),
    db.from('teams').select('id, slug, name, sport, photo_path'),
    db.from('team_members').select('team_id, champion_id'),
    db.from('medals').select('medal, champion_id, team_id'),
    db.from('stories').select('champion_id, team_id').eq('status', 'published'),
  ]);

  const medalsByChampion = new Map<string, MedalKind[]>();
  const medalsByTeam = new Map<string, MedalKind[]>();
  const push = (map: Map<string, MedalKind[]>, key: string, m: MedalKind) =>
    map.set(key, [...(map.get(key) ?? []), m]);

  for (const m of medals.data ?? []) {
    if (m.champion_id) push(medalsByChampion, m.champion_id, m.medal);
    if (m.team_id) push(medalsByTeam, m.team_id, m.medal);
  }
  // A player also "has" the medals of every team they were part of.
  for (const tm of members.data ?? []) {
    for (const m of medalsByTeam.get(tm.team_id) ?? []) push(medalsByChampion, tm.champion_id, m);
  }

  const storyChampions = new Set((stories.data ?? []).map((s) => s.champion_id).filter(Boolean));
  const storyTeams = new Set((stories.data ?? []).map((s) => s.team_id).filter(Boolean));

  const sortMedals = (list: MedalKind[]) => [...list].sort((a, b) => MEDAL_ORDER[a] - MEDAL_ORDER[b]);

  const entries: DirectoryEntry[] = [
    ...(champs.data ?? []).map((c) => ({
      kind: 'champion' as const,
      id: c.id,
      slug: c.slug,
      href: `/champions/${c.slug}`,
      name: c.name,
      sport: c.sport,
      state: c.state,
      photo_path: c.photo_path,
      medals: sortMedals(medalsByChampion.get(c.id) ?? []),
      hasStory: storyChampions.has(c.id),
    })),
    ...(teams.data ?? []).map((t) => ({
      kind: 'team' as const,
      id: t.id,
      slug: t.slug,
      href: `/teams/${t.slug}`,
      name: t.name,
      sport: t.sport,
      state: null,
      photo_path: t.photo_path,
      medals: sortMedals(medalsByTeam.get(t.id) ?? []),
      hasStory: storyTeams.has(t.id),
    })),
  ];

  // Stories first, then best medals, then most medals, then name.
  return entries.sort(
    (a, b) =>
      Number(b.hasStory) - Number(a.hasStory) ||
      MEDAL_ORDER[a.medals[0] ?? 'bronze'] - MEDAL_ORDER[b.medals[0] ?? 'bronze'] ||
      b.medals.length - a.medals.length ||
      a.name.localeCompare(b.name),
  );
}

// ---------------------------------------------------------------------
// All medals, for the medals page
// ---------------------------------------------------------------------
export interface MedalRow extends Medal {
   champion: Pick<Champion, 'name' | 'slug' | 'photo_path'> | null;
   team: Pick<Team, 'name' | 'slug' | 'photo_path'> | null;
}

export async function getAllMedals(db: SupabaseClient): Promise<MedalRow[]> {
  const { data } = await db
    .from('medals')
    .select('*, champion:champions(name, slug, photo_path), team:teams(name, slug, photo_path)')
    .order('won_on', { ascending: false, nullsFirst: false });
  return ((data ?? []) as unknown as MedalRow[]).sort((a, b) => MEDAL_ORDER[a.medal] - MEDAL_ORDER[b.medal]);
}

// ---------------------------------------------------------------------
// One champion
// ---------------------------------------------------------------------
export async function getChampionPage(db: SupabaseClient, slug: string) {
  const { data: champion } = await db.from('champions').select('*').eq('slug', slug).maybeSingle();
  if (!champion) return null;

  const [own, memberships, story, cheers] = await Promise.all([
    db.from('medals').select('*').eq('champion_id', champion.id),
    db.from('team_members').select('team:teams(id, name, slug, sport)').eq('champion_id', champion.id),
    getStoryFor(db, 'champion_id', champion.id),
    getCheers(db, 'champion_id', champion.id),
  ]);

  const teams = (memberships.data ?? []).map((m) => m.team as unknown as Team).filter(Boolean);
  const teamMedals = teams.length
    ? ((await db.from('medals').select('*').in('team_id', teams.map((t) => t.id))).data ?? [])
    : [];

  const medals = [
    ...((own.data ?? []) as Medal[]).map((m) => ({ ...m, team: null as Team | null })),
    ...(teamMedals as Medal[]).map((m) => ({ ...m, team: teams.find((t) => t.id === m.team_id) ?? null })),
  ].sort((a, b) => MEDAL_ORDER[a.medal] - MEDAL_ORDER[b.medal]);

  return { champion: champion as Champion, medals, story, cheers };
}

// ---------------------------------------------------------------------
// One team
// ---------------------------------------------------------------------
export async function getTeamPage(db: SupabaseClient, slug: string) {
  const { data: team } = await db.from('teams').select('*').eq('slug', slug).maybeSingle();
  if (!team) return null;

  const [members, medals, story, cheers] = await Promise.all([
    db.from('team_members').select('note, position, champion:champions(*)').eq('team_id', team.id).order('position'),
    db.from('medals').select('*').eq('team_id', team.id),
    getStoryFor(db, 'team_id', team.id),
    getCheers(db, 'team_id', team.id),
  ]);

  return {
    team: team as Team,
    members: (members.data ?? []).map((m) => ({
      note: m.note as string | null,
      champion: m.champion as unknown as Champion,
    })),
    medals: ((medals.data ?? []) as Medal[]).sort((a, b) => MEDAL_ORDER[a.medal] - MEDAL_ORDER[b.medal]),
    story,
    cheers,
  };
}

// ---------------------------------------------------------------------
// Cheers and reactions
// ---------------------------------------------------------------------
export async function getCheers(db: SupabaseClient, column: 'champion_id' | 'team_id', id: string) {
  const { data } = await db
    .from('cheers')
    .select('id, name, city, message, created_at, tagged_champion_id')
    .eq(column, id)
    .eq('status', 'visible')
    .order('created_at', { ascending: false })
    .limit(100);
  return (data ?? []) as Cheer[];
}

export async function getReactionCounts(db: SupabaseClient, storyId: string) {
  const counts: Record<string, number> = { proud: 0, inspired: 0, respect: 0 };
  const { data } = await db.rpc('reaction_counts', { p_story: storyId });
  for (const row of (data ?? []) as { kind: string; total: number }[]) counts[row.kind] = Number(row.total);
  return counts;
}

/** Medals won by the person or team a story is about, best first. */
export async function getSubjectMedals(db: SupabaseClient, story: Story): Promise<Medal[]> {
  let medals: Medal[] = [];
  if (story.team_id) {
    medals = ((await db.from('medals').select('*').eq('team_id', story.team_id)).data ?? []) as Medal[];
  } else if (story.champion_id) {
    const [own, memberships] = await Promise.all([
      db.from('medals').select('*').eq('champion_id', story.champion_id),
      db.from('team_members').select('team_id').eq('champion_id', story.champion_id),
    ]);
    const teamIds = (memberships.data ?? []).map((m) => m.team_id);
    const viaTeams = teamIds.length
      ? ((await db.from('medals').select('*').in('team_id', teamIds)).data ?? [])
      : [];
    medals = [...((own.data ?? []) as Medal[]), ...(viaTeams as Medal[])];
  }
  return medals.sort((a, b) => MEDAL_ORDER[a.medal] - MEDAL_ORDER[b.medal]);
}
