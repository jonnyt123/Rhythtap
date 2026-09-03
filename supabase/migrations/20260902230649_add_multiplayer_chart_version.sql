alter table public.multiplayer_matches
 add column if not exists chart_version integer not null default 3;

alter table public.multiplayer_matches
 drop constraint if exists multiplayer_matches_chart_version_check;

alter table public.multiplayer_matches
 add constraint multiplayer_matches_chart_version_check
 check (chart_version in (3,4));
