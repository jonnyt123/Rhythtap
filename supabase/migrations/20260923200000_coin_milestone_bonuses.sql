begin;

alter table public.player_progress_events
  add column if not exists coin_base_awarded integer not null default 0,
  add column if not exists coin_bonus_awarded integer not null default 0,
  add column if not exists first_clear_bonus integer not null default 0,
  add column if not exists s_rank_bonus integer not null default 0,
  add column if not exists full_combo_bonus integer not null default 0,
  add column if not exists miss_hits integer not null default 0,
  add column if not exists bonus_eligible boolean not null default false;

create table if not exists public.player_song_coin_milestones (
  user_id uuid not null references public.player_profiles(user_id) on delete cascade,
  song_id text not null references public.song_store_catalog(song_id) on delete cascade,
  difficulty text not null check (difficulty in ('ANY','EASY','NORMAL','HARD')),
  milestone text not null check (milestone in ('first-clear','s-rank','full-combo')),
  coin_awarded integer not null check (coin_awarded > 0),
  earned_at timestamptz not null default now(),
  primary key (user_id, song_id, difficulty, milestone)
);

create index if not exists player_song_coin_milestones_user_idx
  on public.player_song_coin_milestones(user_id, earned_at desc);

alter table public.player_song_coin_milestones enable row level security;
revoke all on public.player_song_coin_milestones from anon, authenticated;
grant select on public.player_song_coin_milestones to authenticated;

drop policy if exists "Players can view their coin milestones" on public.player_song_coin_milestones;
create policy "Players can view their coin milestones"
on public.player_song_coin_milestones for select to authenticated
using (auth.uid() = user_id);

create or replace function public.apply_progress_coin_award()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  base_award integer := 0;
  bonus_award integer := 0;
  milestone_award integer;
begin
  new.coin_base_awarded := 0;
  new.coin_bonus_awarded := 0;
  new.first_clear_bonus := 0;
  new.s_rank_bonus := 0;
  new.full_combo_bonus := 0;

  if new.xp_awarded <= 0 then
    new.coin_awarded := 0;
    return new;
  end if;

  base_award := least(100, greatest(25, round(new.xp_awarded::numeric / 15)::integer));
  new.coin_base_awarded := base_award;

  if new.bonus_eligible then
    milestone_award := null;
    insert into public.player_song_coin_milestones(user_id,song_id,difficulty,milestone,coin_awarded)
    values(new.user_id,new.song_id,'ANY','first-clear',15)
    on conflict do nothing
    returning coin_awarded into milestone_award;
    if milestone_award is not null then
      new.first_clear_bonus := milestone_award;
      bonus_award := bonus_award + milestone_award;
    end if;

    if new.accuracy >= 95 then
      milestone_award := null;
      insert into public.player_song_coin_milestones(user_id,song_id,difficulty,milestone,coin_awarded)
      values(new.user_id,new.song_id,new.difficulty,'s-rank',10)
      on conflict do nothing
      returning coin_awarded into milestone_award;
      if milestone_award is not null then
        new.s_rank_bonus := milestone_award;
        bonus_award := bonus_award + milestone_award;
      end if;
    end if;

    if new.miss_hits = 0 and new.max_combo > 0 then
      milestone_award := null;
      insert into public.player_song_coin_milestones(user_id,song_id,difficulty,milestone,coin_awarded)
      values(new.user_id,new.song_id,new.difficulty,'full-combo',15)
      on conflict do nothing
      returning coin_awarded into milestone_award;
      if milestone_award is not null then
        new.full_combo_bonus := milestone_award;
        bonus_award := bonus_award + milestone_award;
      end if;
    end if;
  end if;

  new.coin_bonus_awarded := bonus_award;
  new.coin_awarded := base_award + bonus_award;

  update public.player_profiles
  set coins = coins + new.coin_awarded
  where user_id = new.user_id;

  if not found then
    raise exception 'Player profile not found';
  end if;

  return new;
end;
$$;

revoke all on function public.apply_progress_coin_award() from public, anon, authenticated;

create or replace function public.record_validated_player_game_v2(
  p_user_id uuid,
  p_song_id text,
  p_difficulty text,
  p_score bigint,
  p_accuracy numeric,
  p_max_combo integer,
  p_perfect_hits integer,
  p_chart_version integer,
  p_run_id uuid,
  p_miss_hits integer
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
  multiplier numeric;
  base_award integer;
  bonus integer := 0;
  award integer;
  plays_today integer;
  score_chart_version integer;
  updated_profile public.player_profiles%rowtype;
  prior public.player_progress_events%rowtype;
begin
  if p_user_id is null or p_run_id is null then raise exception 'Authentication and run id are required'; end if;
  if p_song_id not in (
    'voltage','afterglow','gravity','sickness','never-left','fly-eagle',
    'my-immortal','crazy-train','kill-you','kryptonite','through-fire-flames'
  ) then raise exception 'Only official songs award account XP'; end if;
  if p_difficulty not in ('EASY','NORMAL','HARD') then raise exception 'Invalid difficulty'; end if;
  if p_chart_version not in (3,4,5) then raise exception 'Invalid chart version'; end if;
  if p_score < 0 or p_score > 100000000
     or p_accuracy < 0 or p_accuracy > 100
     or p_max_combo < 0 or p_max_combo > 50000
     or p_perfect_hits < 0 or p_perfect_hits > 50000
     or p_miss_hits < 0 or p_miss_hits > 50000 then
    raise exception 'Invalid validated result';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_run_id::text, 0));

  select * into prior
  from public.player_progress_events
  where user_id = p_user_id and source_run_id = p_run_id
  limit 1;

  if prior.id is not null then
    select * into updated_profile from public.player_profiles where user_id = p_user_id;
    if updated_profile.user_id is null then raise exception 'Player profile not found'; end if;
    return query select updated_profile.xp, updated_profile.level, updated_profile.songs_completed,
      updated_profile.perfect_hits, updated_profile.best_combo, prior.xp_awarded, prior.daily_bonus;
    return;
  end if;

  if exists (
    select 1 from public.player_progress_events
    where user_id = p_user_id and created_at > now() - interval '15 seconds'
  ) then raise exception 'Progress update too soon'; end if;

  select count(*)::integer into plays_today
  from public.player_progress_events
  where user_id = p_user_id and created_at >= date_trunc('day', now());
  if plays_today = 1 then bonus := 100; end if;

  multiplier := case p_difficulty when 'EASY' then 1 when 'NORMAL' then 1.4 else 1.9 end;
  base_award := greatest(25, round((p_accuracy * 1.8 + p_score::numeric / 850) * multiplier)::integer);
  base_award := least(base_award, 1500);
  award := base_award + bonus;
  score_chart_version := case when p_difficulty = 'HARD' then p_chart_version else 4 end;

  insert into public.player_progress_events (
    user_id, song_id, difficulty, score, accuracy, max_combo, perfect_hits,
    xp_awarded, daily_bonus, source_run_id, miss_hits, bonus_eligible
  ) values (
    p_user_id, p_song_id, p_difficulty, p_score, p_accuracy, p_max_combo, p_perfect_hits,
    award, bonus, p_run_id, p_miss_hits, true
  );

  update public.player_profiles p
  set xp = p.xp + award,
      level = floor(sqrt((p.xp + award)::numeric / 350))::integer + 1,
      songs_completed = p.songs_completed + 1,
      perfect_hits = p.perfect_hits + p_perfect_hits,
      best_combo = greatest(p.best_combo, p_max_combo)
  where p.user_id = p_user_id
  returning p.* into updated_profile;
  if updated_profile.user_id is null then raise exception 'Player profile not found'; end if;

  insert into public.player_song_scores (
    user_id, song_id, difficulty, chart_version, high_score, best_accuracy, best_combo, plays
  ) values (
    p_user_id, p_song_id, p_difficulty, score_chart_version, p_score, p_accuracy, p_max_combo, 1
  )
  on conflict (user_id, song_id, difficulty, chart_version) do update
  set high_score = greatest(public.player_song_scores.high_score, excluded.high_score),
      best_accuracy = greatest(public.player_song_scores.best_accuracy, excluded.best_accuracy),
      best_combo = greatest(public.player_song_scores.best_combo, excluded.best_combo),
      plays = public.player_song_scores.plays + 1,
      updated_at = now();

  return query select updated_profile.xp, updated_profile.level, updated_profile.songs_completed,
    updated_profile.perfect_hits, updated_profile.best_combo, award, bonus;
end;
$$;

revoke all on function public.record_validated_player_game_v2(uuid,text,text,bigint,numeric,integer,integer,integer,uuid,integer) from public, anon, authenticated;
grant execute on function public.record_validated_player_game_v2(uuid,text,text,bigint,numeric,integer,integer,integer,uuid,integer) to service_role;

commit;
