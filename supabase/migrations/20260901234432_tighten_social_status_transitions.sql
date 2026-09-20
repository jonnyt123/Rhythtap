drop policy if exists "Friend participants can update status" on public.player_friend_requests;
create policy "Friend addressee can respond" on public.player_friend_requests for update to authenticated
using ((select auth.uid())=addressee_id and status='pending')
with check ((select auth.uid())=addressee_id and status in ('accepted','declined'));
create policy "Friend requester can cancel" on public.player_friend_requests for update to authenticated
using ((select auth.uid())=requester_id and status='pending')
with check ((select auth.uid())=requester_id and status='cancelled');

drop policy if exists "Invite participants can update" on public.battle_invites;
create policy "Invite recipient can respond" on public.battle_invites for update to authenticated
using ((select auth.uid())=recipient_id and status='pending' and expires_at>now())
with check ((select auth.uid())=recipient_id and status in ('accepted','declined'));
create policy "Invite sender can cancel" on public.battle_invites for update to authenticated
using ((select auth.uid())=sender_id and status='pending')
with check ((select auth.uid())=sender_id and status='cancelled');