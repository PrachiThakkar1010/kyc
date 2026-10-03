-- =====================================================================
-- KYC – Know Your Champions: database schema
-- Run this ONCE in Supabase: Dashboard → SQL Editor → New query → Run.
-- Then run seed.sql to load the medals.
-- =====================================================================

-- ---------- Types ----------
create type public.medal_kind      as enum ('gold', 'silver', 'bronze');
create type public.stop_kind       as enum ('origin', 'turning_point', 'setback', 'breakthrough', 'podium');
create type public.story_status    as enum ('draft', 'published');
create type public.cheer_status    as enum ('visible', 'pending', 'hidden');
create type public.feedback_kind   as enum ('correction', 'tip', 'suggestion', 'other');
create type public.feedback_status as enum ('new', 'resolved');
create type public.writer_role     as enum ('admin', 'writer');

-- ---------- Writers (linked to Supabase Auth users) ----------
create table public.profiles (
  id                   uuid primary key references auth.users (id) on delete cascade,
  display_name         text not null,
  email                text,
  role                 public.writer_role not null default 'writer',
  active               boolean not null default true,
  must_change_password boolean not null default true,
  created_at           timestamptz not null default now()
);

-- ---------- Champions and teams ----------
create table public.champions (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  name         text not null,
  sport        text not null,
  state        text,
  hometown     text,
  bio          text,
  photo_path   text,
  photo_credit text,
  created_at   timestamptz not null default now()
);

create table public.teams (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  name         text not null,
  sport        text not null,
  bio          text,
  photo_path   text,
  photo_credit text,
  created_at   timestamptz not null default now()
);

create table public.team_members (
  team_id     uuid not null references public.teams (id) on delete cascade,
  champion_id uuid not null references public.champions (id) on delete cascade,
  note        text,                       -- a short profile of the player
  position    int not null default 0,
  primary key (team_id, champion_id)
);

-- A medal belongs to ONE champion (individual events) or ONE team.
create table public.medals (
  id          uuid primary key default gen_random_uuid(),
  medal       public.medal_kind not null,
  sport       text not null,
  event       text not null,
  won_on      date,
  champion_id uuid references public.champions (id) on delete cascade,
  team_id     uuid references public.teams (id) on delete cascade,
  created_at  timestamptz not null default now(),
  constraint medal_has_one_winner check ((champion_id is null) <> (team_id is null))
);

-- ---------- Stories and journey stops ----------
create table public.stories (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  headline     text not null,              -- e.g. "Gold, on her birthday."
  hook         text,                       -- one or two lines under the headline
  champion_id  uuid references public.champions (id) on delete cascade,
  team_id      uuid references public.teams (id) on delete cascade,
  cover_path   text,
  cover_credit text,
  featured_on  date,                       -- the day it is Story of the Day
  status       public.story_status not null default 'draft',
  author_id    uuid references public.profiles (id) on delete set null,
  author_name  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint story_has_one_subject check ((champion_id is null) <> (team_id is null))
);

-- Only one published story per day.
create unique index stories_one_per_day on public.stories (featured_on) where status = 'published';

create table public.story_stops (
  id           uuid primary key default gen_random_uuid(),
  story_id     uuid not null references public.stories (id) on delete cascade,
  position     int not null,
  kind         public.stop_kind not null,
  label        text,                       -- short word under the road, e.g. "Golaghat"
  place        text,                       -- e.g. "Tokyo 2020 Olympics"
  title        text not null,
  body         text not null default '',
  photo_path   text,
  photo_credit text
);
create index story_stops_story on public.story_stops (story_id, position);

-- ---------- Viewer feedback ----------
create table public.reactions (
  story_id   uuid not null references public.stories (id) on delete cascade,
  kind       text not null check (kind in ('proud', 'inspired', 'respect')),
  device     text not null,
  created_at timestamptz not null default now(),
  primary key (story_id, kind, device)
);

create table public.cheers (
  id                  uuid primary key default gen_random_uuid(),
  champion_id         uuid references public.champions (id) on delete cascade,
  team_id             uuid references public.teams (id) on delete cascade,
  tagged_champion_id  uuid references public.champions (id) on delete set null,
  name                text not null check (char_length(name) between 1 and 60),
  city                text check (char_length(city) <= 60),
  message             text not null check (char_length(message) between 1 and 280),
  status              public.cheer_status not null default 'visible',
  flag_reason         text,
  report_count        int not null default 0,
  device              text not null,
  created_at          timestamptz not null default now(),
  constraint cheer_has_one_subject check ((champion_id is null) <> (team_id is null))
);
create index cheers_champion on public.cheers (champion_id, created_at desc);
create index cheers_team on public.cheers (team_id, created_at desc);
create index cheers_device on public.cheers (device, created_at desc);

create table public.cheer_reports (
  cheer_id   uuid not null references public.cheers (id) on delete cascade,
  device     text not null,
  created_at timestamptz not null default now(),
  primary key (cheer_id, device)
);

create table public.feedback (
  id         uuid primary key default gen_random_uuid(),
  kind       public.feedback_kind not null default 'other',
  message    text not null check (char_length(message) between 1 and 2000),
  email      text,
  page_path  text,
  status     public.feedback_status not null default 'new',
  created_at timestamptz not null default now()
);

-- ---------- Small editable settings ----------
create table public.settings (
  key   text primary key,
  value text not null
);
insert into public.settings (key, value) values
  ('tally_as_of', '2 October'),
  ('tally_note', 'Fifth on the medal table. The Games end on 4 October, so more names are still to come.');

-- =====================================================================
-- Automatic behaviour
-- =====================================================================

-- Keep stories.updated_at fresh.
create function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger stories_touch before update on public.stories
for each row execute function public.touch_updated_at();

-- When 3 different visitors report a cheer, hide it until a writer reviews it.
create function public.handle_cheer_report() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.cheers
     set report_count = report_count + 1,
         status = case when report_count + 1 >= 3 and status = 'visible' then 'pending'::public.cheer_status else status end,
         flag_reason = case when report_count + 1 >= 3 and status = 'visible' then 'Reported by visitors' else flag_reason end
   where id = new.cheer_id;
  return new;
end $$;

create trigger cheer_reported after insert on public.cheer_reports
for each row execute function public.handle_cheer_report();

-- Today's date in India, used to hide stories scheduled for later.
create function public.today_ist() returns date
language sql stable as $$
  select (now() at time zone 'Asia/Kolkata')::date
$$;

-- Is the logged-in user an active writer / admin?
create function public.is_writer() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active)
$$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active and role = 'admin')
$$;

-- Reaction totals for one story (visitors never see the raw device list).
create function public.reaction_counts(p_story uuid)
returns table (kind text, total bigint)
language sql stable security definer set search_path = public as $$
  select kind, count(*) from public.reactions where story_id = p_story group by kind
$$;

-- =====================================================================
-- Security: Row Level Security
-- Visitors can only READ public content. Everything visitors submit
-- (reactions, cheers, reports, feedback) goes through the website's
-- server, which checks it first.
-- =====================================================================
alter table public.profiles      enable row level security;
alter table public.champions     enable row level security;
alter table public.teams         enable row level security;
alter table public.team_members  enable row level security;
alter table public.medals        enable row level security;
alter table public.stories       enable row level security;
alter table public.story_stops   enable row level security;
alter table public.reactions     enable row level security;
alter table public.cheers        enable row level security;
alter table public.cheer_reports enable row level security;
alter table public.feedback      enable row level security;
alter table public.settings      enable row level security;

-- Public reference data: everyone reads, writers edit.
create policy "read champions"  on public.champions    for select using (true);
create policy "edit champions"  on public.champions    for all to authenticated using (public.is_writer()) with check (public.is_writer());
create policy "read teams"      on public.teams        for select using (true);
create policy "edit teams"      on public.teams        for all to authenticated using (public.is_writer()) with check (public.is_writer());
create policy "read members"    on public.team_members for select using (true);
create policy "edit members"    on public.team_members for all to authenticated using (public.is_writer()) with check (public.is_writer());
create policy "read medals"     on public.medals       for select using (true);
create policy "edit medals"     on public.medals       for all to authenticated using (public.is_writer()) with check (public.is_writer());
create policy "read settings"   on public.settings     for select using (true);
create policy "edit settings"   on public.settings     for all to authenticated using (public.is_writer()) with check (public.is_writer());

-- Stories: visitors see published stories whose day has come; writers see all.
create policy "read stories" on public.stories for select
  using ((status = 'published' and featured_on is not null and featured_on <= public.today_ist()) or public.is_writer());
create policy "edit stories" on public.stories for all to authenticated
  using (public.is_writer()) with check (public.is_writer());

create policy "read stops" on public.story_stops for select
  using (exists (select 1 from public.stories s where s.id = story_id));
create policy "edit stops" on public.story_stops for all to authenticated
  using (public.is_writer()) with check (public.is_writer());

-- Cheers: visitors see visible ones; writers see and moderate all.
create policy "read cheers" on public.cheers for select using (status = 'visible' or public.is_writer());
create policy "moderate cheers" on public.cheers for update to authenticated using (public.is_writer()) with check (public.is_writer());
create policy "delete cheers" on public.cheers for delete to authenticated using (public.is_writer());

create policy "writers read reports"   on public.cheer_reports for select to authenticated using (public.is_writer());
create policy "writers read reactions" on public.reactions     for select to authenticated using (public.is_writer());

-- Private feedback: writers only.
create policy "writers read feedback"   on public.feedback for select to authenticated using (public.is_writer());
create policy "writers update feedback" on public.feedback for update to authenticated using (public.is_writer()) with check (public.is_writer());
create policy "writers delete feedback" on public.feedback for delete to authenticated using (public.is_writer());

-- Profiles: you see your own; the admin sees everyone.
create policy "read own profile" on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());

-- Explicit table permissions (RLS above still decides which rows).
grant select on public.champions, public.teams, public.team_members, public.medals,
                public.stories, public.story_stops, public.cheers, public.settings to anon, authenticated;
grant insert, update, delete on public.champions, public.teams, public.team_members, public.medals,
                public.stories, public.story_stops, public.settings to authenticated;
grant update, delete on public.cheers to authenticated;
grant select on public.cheer_reports, public.reactions, public.profiles to authenticated;
grant select, update, delete on public.feedback to authenticated;
grant execute on function public.reaction_counts(uuid), public.today_ist(),
                 public.is_writer(), public.is_admin() to anon, authenticated;

-- =====================================================================
-- Photo storage
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

create policy "writers upload photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and public.is_writer());
create policy "writers update photos" on storage.objects for update to authenticated
  using (bucket_id = 'photos' and public.is_writer());
create policy "writers delete photos" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and public.is_writer());
