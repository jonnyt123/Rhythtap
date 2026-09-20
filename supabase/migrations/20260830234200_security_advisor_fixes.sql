alter function public.touch_player_profile_updated_at() set search_path = public, pg_temp;

revoke all on function public.enforce_multiplayer_participant_limit() from public, anon, authenticated;
revoke all on function public.handle_new_player_account() from public, anon, authenticated;

drop policy if exists "Public profiles are viewable" on public.player_profiles;
create policy "Public profiles are viewable"
on public.player_profiles for select
using (is_public or (select auth.uid()) = user_id);

drop policy if exists "Players can edit public profile fields" on public.player_profiles;
create policy "Players can edit public profile fields"
on public.player_profiles for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Public song scores are viewable" on public.player_song_scores;
create policy "Public song scores are viewable"
on public.player_song_scores for select
using (
  exists (
    select 1 from public.player_profiles p
    where p.user_id = player_song_scores.user_id
      and (p.is_public or p.user_id = (select auth.uid()))
  )
);

drop policy if exists "Players can view their progression events" on public.player_progress_events;
create policy "Players can view their progression events"
on public.player_progress_events for select to authenticated
using ((select auth.uid()) = user_id);
