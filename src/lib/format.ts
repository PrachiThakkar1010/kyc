import type { MedalKind, StopKind } from './types';

/** Today's date in India as YYYY-MM-DD. */
export function todayIST(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

/** "2026-10-03" -> "3 October" (adds the year if it isn't this year). */
export function prettyDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00Z');
  const sameYear = d.getUTCFullYear() === new Date().getUTCFullYear();
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'long',
    ...(sameYear ? {} : { year: 'numeric' }),
    timeZone: 'UTC',
  }).format(d);
}

export const MEDAL_ORDER: Record<MedalKind, number> = { gold: 0, silver: 1, bronze: 2 };

export const MEDAL_LABEL: Record<MedalKind, string> = {
  gold: 'Gold',
  silver: 'Silver',
  bronze: 'Bronze',
};

export const STOP_LABEL: Record<StopKind, string> = {
  origin: 'Where it began',
  turning_point: 'Turning point',
  setback: 'Setback',
  breakthrough: 'Breakthrough',
  podium: 'The podium',
};

export const STOP_KINDS = Object.keys(STOP_LABEL) as StopKind[];

/** Rough reading time for a story. */
export function readMinutes(texts: (string | null | undefined)[]): number {
  const words = texts.join(' ').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/** "Lovlina Borgohain" -> "lovlina-borgohain" */
export function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** Best medal first, e.g. ['bronze','gold'] -> 'gold'. */
export function bestMedal(medals: MedalKind[]): MedalKind | null {
  return [...medals].sort((a, b) => MEDAL_ORDER[a] - MEDAL_ORDER[b])[0] ?? null;
}

/** Turns plain text with blank lines into paragraphs. */
export function paragraphs(text: string | null | undefined): string[] {
  return (text ?? '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}
