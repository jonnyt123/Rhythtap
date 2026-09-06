create index if not exists player_progress_events_source_match_idx
  on public.player_progress_events (source_match_id)
  where source_match_id is not null;

create index if not exists player_song_scores_leaderboard_idx
  on public.player_song_scores (song_id, difficulty, chart_version, high_score desc);
