alter table public.multiplayer_results
  add column if not exists perfect_count integer not null default 0 check (perfect_count >= 0);

alter table public.player_progress_events
  add column if not exists source_match_id uuid references public.multiplayer_matches(match_id) on delete set null;

create unique index if not exists player_progress_events_user_match_unique
  on public.player_progress_events (user_id, source_match_id)
  where source_match_id is not null;

create or replace function public.keep_verified_multiplayer_result_immutable()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.match_id is not distinct from old.match_id
     and new.room_code is not distinct from old.room_code
     and new.player_id is not distinct from old.player_id
     and new.display_name is not distinct from old.display_name
     and new.song_id is not distinct from old.song_id
     and new.difficulty is not distinct from old.difficulty
     and new.score is not distinct from old.score
     and new.accuracy is not distinct from old.accuracy
     and new.max_combo is not distinct from old.max_combo
     and new.event_count is not distinct from old.event_count
     and new.validation_version is not distinct from old.validation_version
     and new.chart_source_commit is not distinct from old.chart_source_commit
     and new.chart_note_count is not distinct from old.chart_note_count
     and new.validated_hold_count is not distinct from old.validated_hold_count
     and new.event_digest is not distinct from old.event_digest
     and new.perfect_count is not distinct from old.perfect_count then
    new.created_at := old.created_at;
    return new;
  end if;
  raise exception 'Verified multiplayer result is immutable';
end;
$$;

create or replace function public.record_validated_multiplayer_progress(
  p_user_id uuid,
  p_match_id uuid
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
  validated public.multiplayer_results%rowtype;
  prior public.player_progress_events%rowtype;
  multiplier numeric;
  base_award integer;
  bonus integer := 0;
  award integer;
  plays_today integer;
  updated_profile public.player_profiles%rowtype;
begin
  if p_user_id is null or p_match_id is null then
    raise exception 'Authentication and match are required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_match_id::text, 0));

  select * into validated
  from public.multiplayer_results
  where player_id = p_user_id
    and match_id = p_match_id
    and validation_version = 3;

  if validated.match_id is null then
    raise exception 'Verified multiplayer result not found';
  end if;

  select * into prior
  from public.player_progress_events
  where user_id = p_user_id and source_match_id = p_match_id
  limit 1;

  if prior.id is not null then
    select * into updated_profile from public.player_profiles where user_id = p_user_id;
    if updated_profile.user_id is null then raise exception 'Player profile not found'; end if;
    return query select updated_profile.xp, updated_profile.level, updated_profile.songs_completed,
      updated_profile.perfect_hits, updated_profile.best_combo, prior.xp_awarded, prior.daily_bonus;
    return;
  end if;

  if validated.song_id not in (
    'voltage','afterglow','gravity','sickness','never-left','fly-eagle',
    'my-immortal','crazy-train','kill-you','kryptonite','through-fire-flames'
  ) then
    raise exception 'Only official songs award account XP';
  end if;

  select count(*)::integer into plays_today
  from public.player_progress_events
  where user_id = p_user_id and created_at >= date_trunc('day', now());

  if plays_today = 1 then bonus := 100; end if;

  multiplier := case validated.difficulty when 'EASY' then 1 when 'NORMAL' then 1.4 else 1.9 end;
  base_award := greatest(25, round((validated.accuracy * 1.8 + validated.score::numeric / 850) * multiplier)::integer);
  base_award := least(base_award, 1500);
  award := base_award + bonus;

  insert into public.player_progress_events (
    user_id, song_id, difficulty, score, accuracy, max_combo, perfect_hits,
    xp_awarded, daily_bonus, source_match_id
  ) values (
    p_user_id, validated.song_id, validated.difficulty, validated.score, validated.accuracy,
    validated.max_combo, validated.perfect_count, award, bonus, p_match_id
  );

  update public.player_profiles p
  set xp = p.xp + award,
      level = floor(sqrt((p.xp + award)::numeric / 350))::integer + 1,
      songs_completed = p.songs_completed + 1,
      perfect_hits = p.perfect_hits + validated.perfect_count,
      best_combo = greatest(p.best_combo, validated.max_combo)
  where p.user_id = p_user_id
  returning p.* into updated_profile;

  if updated_profile.user_id is null then raise exception 'Player profile not found'; end if;

  insert into public.player_song_scores (
    user_id, song_id, difficulty, high_score, best_accuracy, best_combo, plays
  ) values (
    p_user_id, validated.song_id, validated.difficulty, validated.score, validated.accuracy, validated.max_combo, 1
  )
  on conflict (user_id, song_id, difficulty) do update
  set high_score = greatest(public.player_song_scores.high_score, excluded.high_score),
      best_accuracy = greatest(public.player_song_scores.best_accuracy, excluded.best_accuracy),
      best_combo = greatest(public.player_song_scores.best_combo, excluded.best_combo),
      plays = public.player_song_scores.plays + 1,
      updated_at = now();

  return query select updated_profile.xp, updated_profile.level, updated_profile.songs_completed,
    updated_profile.perfect_hits, updated_profile.best_combo, award, bonus;
end;
$$;

revoke all on function public.record_validated_multiplayer_progress(uuid,uuid) from public, anon, authenticated;
grant execute on function public.record_validated_multiplayer_progress(uuid,uuid) to service_role;
