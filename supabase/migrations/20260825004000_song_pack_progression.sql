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

  if p_song_id not in (
    'voltage','afterglow','gravity','sickness','never-left','fly-eagle',
    'my-immortal','crazy-train','kill-you','kryptonite','through-fire-flames'
  ) then
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
