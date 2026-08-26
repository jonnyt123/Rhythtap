create or replace function public.record_validated_player_game(
  p_user_id uuid,
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
  multiplier numeric;
  base_award integer;
  bonus integer := 0;
  award integer;
  plays_today integer;
  updated_profile public.player_profiles%rowtype;
begin
  if p_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_song_id not in (
    'voltage','afterglow','gravity','sickness','never-left','fly-eagle',
    'my-immortal','crazy-train','kill-you','kryptonite','through-fire-flames'
  ) then
    raise exception 'Only official songs award account XP';
  end if;

  if p_difficulty not in ('EASY','NORMAL','HARD') then
    raise exception 'Invalid difficulty';
  end if;

  -- The Edge Function computes these values from the canonical chart. Keep only
  -- broad corruption guards here; legitimate dense charts can exceed 5M points.
  if p_score < 0 or p_score > 100000000
     or p_accuracy < 0 or p_accuracy > 100
     or p_max_combo < 0 or p_max_combo > 50000
     or p_perfect_hits < 0 or p_perfect_hits > 50000 then
    raise exception 'Invalid validated result';
  end if;

  if exists (
    select 1 from public.player_progress_events
    where user_id = p_user_id and created_at > now() - interval '15 seconds'
  ) then
    raise exception 'Progress update too soon';
  end if;

  select count(*)::integer into plays_today
  from public.player_progress_events
  where user_id = p_user_id and created_at >= date_trunc('day', now());

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
    p_user_id, p_song_id, p_difficulty, p_score, p_accuracy, p_max_combo, p_perfect_hits, award, bonus
  );

  update public.player_profiles p
  set xp = p.xp + award,
      level = floor(sqrt((p.xp + award)::numeric / 350))::integer + 1,
      songs_completed = p.songs_completed + 1,
      perfect_hits = p.perfect_hits + p_perfect_hits,
      best_combo = greatest(p.best_combo, p_max_combo)
  where p.user_id = p_user_id
  returning p.* into updated_profile;

  if updated_profile.user_id is null then
    raise exception 'Player profile not found';
  end if;

  insert into public.player_song_scores (
    user_id, song_id, difficulty, high_score, best_accuracy, best_combo, plays
  ) values (
    p_user_id, p_song_id, p_difficulty, p_score, p_accuracy, p_max_combo, 1
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

-- Browser clients may no longer submit aggregate scores directly. Only the
-- server-side Edge Function can call the validated progression function.
revoke all on function public.record_player_game(text,text,bigint,numeric,integer,integer) from public, anon, authenticated;
revoke all on function public.record_validated_player_game(uuid,text,text,bigint,numeric,integer,integer) from public, anon, authenticated;
grant execute on function public.record_validated_player_game(uuid,text,text,bigint,numeric,integer,integer) to service_role;

create or replace function public.enforce_multiplayer_participant_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Serialize registrations for one match so two simultaneous joiners cannot
  -- both observe the same available second slot.
  perform pg_advisory_xact_lock(hashtextextended(new.match_id::text, 0));
  if (select count(*) from public.multiplayer_participants where match_id = new.match_id) >= 2 then
    raise exception 'Match already has two players';
  end if;
  return new;
end;
$$;

drop trigger if exists multiplayer_participant_limit_guard on public.multiplayer_participants;
create trigger multiplayer_participant_limit_guard
before insert on public.multiplayer_participants
for each row execute function public.enforce_multiplayer_participant_limit();

create or replace function public.keep_verified_multiplayer_result_immutable()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  -- Network retries are allowed when they reproduce the exact same verified
  -- result. A different event digest or result may not replace history.
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
     and new.event_digest is not distinct from old.event_digest then
    new.created_at := old.created_at;
    return new;
  end if;
  raise exception 'Verified multiplayer result is immutable';
end;
$$;

drop trigger if exists multiplayer_result_immutable_guard on public.multiplayer_results;
create trigger multiplayer_result_immutable_guard
before update on public.multiplayer_results
for each row execute function public.keep_verified_multiplayer_result_immutable();
