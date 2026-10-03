// Shapes of the rows we read from the database.

export type MedalKind = 'gold' | 'silver' | 'bronze';
export type StopKind = 'origin' | 'turning_point' | 'setback' | 'breakthrough' | 'podium';

export interface Profile {
  id: string;
  display_name: string;
  email: string | null;
  role: 'admin' | 'writer';
  active: boolean;
  must_change_password: boolean;
}

export interface Champion {
  id: string;
  slug: string;
  name: string;
  sport: string;
  state: string | null;
  hometown: string | null;
  bio: string | null;
  photo_path: string | null;
  photo_credit: string | null;
}

export interface Team {
  id: string;
  slug: string;
  name: string;
  sport: string;
  bio: string | null;
  photo_path: string | null;
  photo_credit: string | null;
}

export interface Medal {
  id: string;
  medal: MedalKind;
  sport: string;
  event: string;
  won_on: string | null;
  champion_id: string | null;
  team_id: string | null;
}

export interface Stop {
  id: string;
  story_id: string;
  position: number;
  kind: StopKind;
  label: string | null;
  place: string | null;
  title: string;
  body: string;
  photo_path: string | null;
  photo_credit: string | null;
}

export interface Story {
  id: string;
  slug: string;
  headline: string;
  hook: string | null;
  champion_id: string | null;
  team_id: string | null;
  cover_path: string | null;
  cover_credit: string | null;
  featured_on: string | null;
  status: 'draft' | 'published';
  author_name: string | null;
  champion?: Champion | null;
  team?: Team | null;
  stops?: Stop[];
}

export interface Cheer {
  id: string;
  name: string;
  city: string | null;
  message: string;
  created_at: string;
  tagged_champion_id: string | null;
}
