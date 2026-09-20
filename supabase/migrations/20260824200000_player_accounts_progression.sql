create table if not exists public.player_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (username ~ '^[A-Za-z0-9_]{3,20}$'),
  display_name text not null default 'Player' check (char_length(display_name) between 1 and 32),
  bio text not null default '' check (char_length(bio) <= 160),
  accent text not null default 'cyan' check (accent in ('cyan','violet','pink','lime','gold')),
  is_public boolean not null default true,
  xp bigint not null default 0 check (xp >= 0),
  level integer not null default 1 check (level >= 1),
  songs_completed integer not null default 0 check (songs_completed >= 0),
  perfect_hits bigint not null default 0 check (perfect_hits >= 0),
  best_combo integer not null default 0 check (best_combo >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists player_profiles_username_lower_idx
  on public.player_profiles (lower(username));
create index if not exists player_profiles_public_level_idx
  on public.player_profiles (is_public, level desc, xp desc);

create table if not exists public.player_song_scores (
  user_id uuid not null references public.player_profiles(user_id) on delete cascade,
  song_id text not null,
  difficulty text not null check (difficulty in ('EASY','NORMAL','HARD')),
  high_score bigint not null default 0 check (high_score >= 0),
  best_accuracy numeric(6,3) not null default 0 check (best_accuracy between 0 and 100),
  best_combo integer not null default 0 check (best_combo >= 0),
  plays integer not null default 0 check (plays >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, song_id, difficulty)
);

create index if not exists player_song_scores_user_score_idx
  on public.player_song_scores (user_id, high_score desc);

create table if not exists public.player_progress_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.player_profiles(user_id) on delete cascade,
  song_id text not null,
  difficulty text not null check (difficulty in ('EASY','NORMAL','HARD')),
  score bigint not null,
  accuracy numeric(6,3) not null,
  max_combo integer not null,
  perfect_hits integer not null,
  xp_awarded integer not null,
  daily_bonus integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists player_progress_events_user_created_idx
  on public.player_progress_events (user_id, created_at desc);

alter table public.player_profiles enable row level security;
alter table public.player_song_scores enable row level security;
alter table public.player_progress_events enable row level security;

revoke all on public.player_profiles from anon, authenticated;
revoke all on public.player_song_scores from anon, authenticated;
revoke all on public.player_progress_events from anon, authenticated;

grant select on public.player_profiles to anon, authenticated;
grant select on public.player_song_scores to anon, authenticated;
grant select on public.player_progress_events to authenticated;
grant update (username, display_name, bio, accent, is_public) on public.player_profiles to authenticated;

create policy "Public profiles are viewable"
on public.player_profiles for select
using (is_public or auth.uid() = user_id);

create policy "Players can edit public profile fields"
on public.player_profiles for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Public song scores are viewable"
on public.player_song_scores for select
using (
  exists (
    select 1 from public.player_profiles p
    where p.user_id = player_song_scores.user_id
      and (p.is_public or p.user_id = auth.uid())
  )
);

create policy "Players can view their progression events"
on public.player_progress_events for select to authenticated
using (auth.uid() = user_id);

create or replace function public.touch_player_profile_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists player_profiles_touch_updated_at on public.player_profiles;
create trigger player_profiles_touch_updated_at
before update on public.player_profiles
for each row execute function public.touch_player_profile_updated_at();

create or replace function public.handle_new_player_account()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  desired_username text;
  fallback_username text;
  chosen_username text;
begin
  desired_username := lower(regexp_replace(coalesce(new.raw_user_meta_data->>'username',''), '[^A-Za-z0-9_]', '', 'g'));
  fallback_username := 'player_' || substring(replace(new.id::text, '-', '') from 1 for 8);

  if char_length(desired_username) < 3 or char_length(desired_username) > 20 then
    desired_username := fallback_username;
  end if;

  if exists (select 1 from public.player_profiles where lower(username) = lower(desired_username)) then
    chosen_username := fallback_username;
  else
    chosen_username := desired_username;
  end if;

  insert into public.player_profiles (user_id, username, display_name)
  values (
    new.id,
    chosen_username,
    left(coalesce(nullif(new.raw_user_meta_data->>'display_name',''), chosen_username), 32)
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_player_profile on auth.users;
create trigger on_auth_user_created_player_profile
after insert on auth.users
for each row execute function public.handle_new_player_account();

create or replace function public.record_player_game(
  p_song_id text,
  p_difficulty text,
  p_score bigint,
  p_accuracy numeric,
  p_max_combo integer,
  p_perfect_hits integer
)
returns table (
  xp bigint,
  level integer,
  songs_completed integer,
  perfect_hits bigint,
  best_combo integer,
  xp_awarded integer,
  daily_bonus integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  multiplier numeric;
  base_award integer;
  bonus integer := 0;
  award integer;
  plays_today integer;
  updated_profile public.player_profiles%rowtype;
begin
  if uid is null then
    raise exception 'Authentication required';
  end if;

  if p_song_id not in ('voltage','afterglow','gravity','sickness','never-left','fly-eagle') then
    raise exception 'Only official songs award account XP';
  end if;

  if p_difficulty not in ('EASY','NORMAL','HARD') then
    raise exception 'Invalid difficulty';
  end if;

  if p_score < 0 or p_score > 5000000
     or p_accuracy < 0 or p_accuracy > 100
     or p_max_combo < 0 or p_max_combo > 20000
     or p_perfect_hits < 0 or p_perfect_hits > 20000 then
    raise exception 'Invalid result';
  end if;

  if exists (
    select 1 from public.player_progress_events
    where user_id = uid and created_at > now() - interval '15 seconds'
  ) then
    raise exception 'Progress update too soon';
  end if;

  select count(*)::integer into plays_today
  from public.player_progress_events
  where user_id = uid and created_at >= date_trunc('day', now());

  if plays_today = 1 then
    bonus := 100;
  end if;

  multiplier := case p_difficulty when 'EASY' then 1 when 'NORMAL' then 1.4 else 1.9 end;
  base_award := greatest(25, round((p_accuracy * 1.8 + p_score::numeric / 850) * multiplier)::integer);
  base_award := least(base_award, 1500);
  award := base_award + bonus;

  insert into public.player_progress_events (
    user_id, song_id, difficulty, score, accuracy, max_combo, perfect_hits, xp_awarded, daily_bonus
  ) values (
    uid, p_song_id, p_difficulty, p_score, p_accuracy, p_max_combo, p_perfect_hits, award, bonus
  );

  update public.player_profiles p
  set xp = p.xp + award,
      level = floor(sqrt((p.xp + award)::numeric / 350))::integer + 1,
      songs_completed = p.songs_completed + 1,
      perfect_hits = p.perfect_hits + p_perfect_hits,
      best_combo = greatest(p.best_combo, p_max_combo)
  where p.user_id = uid
  returning p.* into updated_profile;

  if updated_profile.user_id is null then
    raise exception 'Player profile not found';
  end if;

  insert into public.player_song_scores (
    user_id, song_id, difficulty, high_score, best_accuracy, best_combo, plays
  ) values (
    uid, p_song_id, p_difficulty, p_score, p_accuracy, p_max_combo, 1
  )
  on conflict (user_id, song_id, difficulty) do update
  set high_score = greatest(public.player_song_scores.high_score, excluded.high_score),
      best_accuracy = greatest(public.player_song_scores.best_accuracy, excluded.best_accuracy),
      best_combo = greatest(public.player_song_scores.best_combo, excluded.best_combo),
      plays = public.player_song_scores.plays + 1,
      updated_at = now();

  return query select
    updated_profile.xp,
    updated_profile.level,
    updated_profile.songs_completed,
    updated_profile.perfect_hits,
    updated_profile.best_combo,
    award,
    bonus;
end;
$$;

revoke all on function public.record_player_game(text,text,bigint,numeric,integer,integer) from public, anon;
grant execute on function public.record_player_game(text,text,bigint,numeric,integer,integer) to authenticated;
