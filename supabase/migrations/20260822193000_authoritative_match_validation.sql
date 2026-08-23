create table if not exists public.multiplayer_matches (
  match_id uuid primary key,
  room_code text not null check (char_length(room_code) = 6),
  song_id text not null,
  difficulty text not null check (difficulty in ('EASY','NORMAL','HARD')),
  server_start_at timestamptz not null,
  expected_end_at timestamptz not null,
  chart_source_commit text not null,
  chart_note_count integer not null check (chart_note_count > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.multiplayer_participants (
  match_id uuid not null references public.multiplayer_matches(match_id) on delete cascade,
  player_id uuid not null,
  display_name text not null check (char_length(display_name) between 1 and 18),
  token_hash text not null check (char_length(token_hash) = 64),
  joined_at timestamptz not null default now(),
  primary key (match_id, player_id)
);

create index if not exists multiplayer_participants_player_idx
  on public.multiplayer_participants (player_id, joined_at desc);
create index if not exists multiplayer_matches_created_idx
  on public.multiplayer_matches (created_at desc);

alter table public.multiplayer_results
  add column if not exists chart_source_commit text,
  add column if not exists chart_note_count integer,
  add column if not exists validated_hold_count integer not null default 0,
  add column if not exists event_digest text;

alter table public.multiplayer_matches enable row level security;
alter table public.multiplayer_participants enable row level security;
revoke all on table public.multiplayer_matches from anon, authenticated;
revoke all on table public.multiplayer_participants from anon, authenticated;
grant all on table public.multiplayer_matches to service_role;
grant all on table public.multiplayer_participants to service_role;

comment on table public.multiplayer_matches is
  'Server-created RhythmTap multiplayer match metadata, start time, and pinned authoritative chart version.';
comment on table public.multiplayer_participants is
  'Server-issued per-match participant credentials. Token hashes never leave the Edge Function.';
comment on column public.multiplayer_results.event_digest is
  'SHA-256 digest of the normalized judgement stream used for authoritative result validation.';
