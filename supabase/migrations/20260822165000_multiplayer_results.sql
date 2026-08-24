create table if not exists public.multiplayer_results (
  id bigint generated always as identity primary key,
  match_id uuid not null,
  room_code text not null check (char_length(room_code) = 6),
  player_id uuid not null,
  display_name text not null check (char_length(display_name) between 1 and 18),
  song_id text not null,
  difficulty text not null check (difficulty in ('EASY','NORMAL','HARD')),
  score integer not null check (score >= 0),
  accuracy numeric(6,3) not null check (accuracy between 0 and 100),
  max_combo integer not null check (max_combo >= 0),
  event_count integer not null check (event_count >= 0),
  validation_version integer not null default 1,
  created_at timestamptz not null default now(),
  unique (match_id, player_id)
);

create index if not exists multiplayer_results_player_created_idx
  on public.multiplayer_results (player_id, created_at desc);
create index if not exists multiplayer_results_match_idx
  on public.multiplayer_results (match_id);

alter table public.multiplayer_results enable row level security;
revoke all on table public.multiplayer_results from anon, authenticated;
grant all on table public.multiplayer_results to service_role;

comment on table public.multiplayer_results is
  'Server-recomputed RhythmTap multiplayer results. Browser clients cannot write this table directly.';
