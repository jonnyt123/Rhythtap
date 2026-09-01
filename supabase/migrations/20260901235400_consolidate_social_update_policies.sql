drop policy if exists "Friend addressee can respond" on public.player_friend_requests;
drop policy if exists "Friend requester can cancel" on public.player_friend_requests;
create policy "Friend participants can transition pending status"
on public.player_friend_requests
for update
to authenticated
using (
  status='pending'
  and (select auth.uid()) in (requester_id,addressee_id)
)
with check (
  ((select auth.uid())=addressee_id and status in ('accepted','declined'))
  or ((select auth.uid())=requester_id and status='cancelled')
);

drop policy if exists "Invite recipient can respond" on public.battle_invites;
drop policy if exists "Invite sender can cancel" on public.battle_invites;
create policy "Invite participants can transition pending status"
on public.battle_invites
for update
to authenticated
using (
  status='pending'
  and (select auth.uid()) in (sender_id,recipient_id)
)
with check (
  ((select auth.uid())=recipient_id and status in ('accepted','declined') and expires_at>now())
  or ((select auth.uid())=sender_id and status='cancelled')
);