create table if not exists public.player_tour_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  gig_id text not null,
  stars smallint not null default 0 check (stars between 0 and 3),
  best_score bigint not null default 0 check (best_score >= 0),
  best_accuracy numeric not null default 0 check (best_accuracy between 0 and 100),
  best_difficulty text not null default 'EASY' check (best_difficulty in ('EASY','NORMAL','HARD')),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id,gig_id)
);
alter table public.player_tour_progress enable row level security;
grant select,insert,update on public.player_tour_progress to authenticated;
drop policy if exists "Players manage own tour progress" on public.player_tour_progress;
create policy "Players manage own tour progress" on public.player_tour_progress for all to authenticated
using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);

create table if not exists public.player_friend_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.player_profiles(user_id) on delete cascade,
  addressee_id uuid not null references public.player_profiles(user_id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requester_id<>addressee_id)
);
create unique index if not exists player_friend_request_pair_unique on public.player_friend_requests (least(requester_id,addressee_id),greatest(requester_id,addressee_id));
create index if not exists player_friend_requests_requester_idx on public.player_friend_requests(requester_id,status);
create index if not exists player_friend_requests_addressee_idx on public.player_friend_requests(addressee_id,status);
alter table public.player_friend_requests enable row level security;
revoke all on public.player_friend_requests from anon,authenticated;
grant select,insert,delete on public.player_friend_requests to authenticated;
grant update(status,updated_at) on public.player_friend_requests to authenticated;
drop policy if exists "Friend participants can view" on public.player_friend_requests;
create policy "Friend participants can view" on public.player_friend_requests for select to authenticated using ((select auth.uid()) in (requester_id,addressee_id));
drop policy if exists "Players can request friendship" on public.player_friend_requests;
create policy "Players can request friendship" on public.player_friend_requests for insert to authenticated with check ((select auth.uid())=requester_id and status='pending');
drop policy if exists "Friend participants can update status" on public.player_friend_requests;
create policy "Friend participants can update status" on public.player_friend_requests for update to authenticated using ((select auth.uid()) in (requester_id,addressee_id)) with check ((select auth.uid()) in (requester_id,addressee_id));
drop policy if exists "Friend participants can delete" on public.player_friend_requests;
create policy "Friend participants can delete" on public.player_friend_requests for delete to authenticated using ((select auth.uid()) in (requester_id,addressee_id));

create table if not exists public.battle_invites (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.player_profiles(user_id) on delete cascade,
  recipient_id uuid not null references public.player_profiles(user_id) on delete cascade,
  room_code text not null check (room_code ~ '^[A-Z0-9]{6}$'),
  status text not null default 'pending' check (status in ('pending','accepted','declined','cancelled','expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now()+interval '10 minutes'),
  updated_at timestamptz not null default now(),
  check (sender_id<>recipient_id)
);
create index if not exists battle_invites_recipient_idx on public.battle_invites(recipient_id,status,created_at desc);
create index if not exists battle_invites_sender_idx on public.battle_invites(sender_id,status,created_at desc);
alter table public.battle_invites enable row level security;
revoke all on public.battle_invites from anon,authenticated;
grant select,insert,delete on public.battle_invites to authenticated;
grant update(status,updated_at) on public.battle_invites to authenticated;
drop policy if exists "Invite participants can view" on public.battle_invites;
create policy "Invite participants can view" on public.battle_invites for select to authenticated using ((select auth.uid()) in (sender_id,recipient_id));
drop policy if exists "Players can send battle invites" on public.battle_invites;
create policy "Players can send battle invites" on public.battle_invites for insert to authenticated with check ((select auth.uid())=sender_id and status='pending' and expires_at<=now()+interval '15 minutes');
drop policy if exists "Invite participants can update" on public.battle_invites;
create policy "Invite participants can update" on public.battle_invites for update to authenticated using ((select auth.uid()) in (sender_id,recipient_id)) with check ((select auth.uid()) in (sender_id,recipient_id));
drop policy if exists "Invite participants can delete" on public.battle_invites;
create policy "Invite participants can delete" on public.battle_invites for delete to authenticated using ((select auth.uid()) in (sender_id,recipient_id));

create table if not exists public.player_ranked_stats (
  user_id uuid primary key references public.player_profiles(user_id) on delete cascade,
  rating integer not null default 1000 check (rating>=0),
  wins integer not null default 0 check (wins>=0),
  losses integer not null default 0 check (losses>=0),
  draws integer not null default 0 check (draws>=0),
  matches_played integer not null default 0 check (matches_played>=0),
  best_rating integer not null default 1000 check (best_rating>=0),
  updated_at timestamptz not null default now()
);
alter table public.player_ranked_stats enable row level security;
grant select on public.player_ranked_stats to anon,authenticated;
drop policy if exists "Public ranked stats are viewable" on public.player_ranked_stats;
create policy "Public ranked stats are viewable" on public.player_ranked_stats for select to public using (exists(select 1 from public.player_profiles p where p.user_id=player_ranked_stats.user_id and (p.is_public or p.user_id=(select auth.uid()))));

create schema if not exists private;
revoke all on schema private from public,anon,authenticated;
create table if not exists private.ranked_match_awards (
  match_id uuid primary key,
  processed_at timestamptz not null default now()
);

create or replace function private.process_ranked_match_result()
returns trigger
language plpgsql
set search_path=''
as $$
declare
  v_claim uuid;
  v_count integer;
  r record;
  v_opponent_score integer;
  v_delta integer;
  v_win integer;
  v_loss integer;
  v_draw integer;
begin
  select count(*) into v_count from public.multiplayer_results where match_id=new.match_id and validation_version is not null and event_digest is not null;
  if v_count<2 then return new; end if;
  insert into private.ranked_match_awards(match_id) values(new.match_id) on conflict do nothing returning match_id into v_claim;
  if v_claim is null then return new; end if;
  for r in select player_id,score from public.multiplayer_results where match_id=new.match_id and validation_version is not null and event_digest is not null order by id asc limit 2 loop
    select score into v_opponent_score from public.multiplayer_results where match_id=new.match_id and player_id<>r.player_id and validation_version is not null and event_digest is not null order by id asc limit 1;
    if v_opponent_score is null then continue; end if;
    if r.score>v_opponent_score then v_delta:=25;v_win:=1;v_loss:=0;v_draw:=0;
    elsif r.score<v_opponent_score then v_delta:=-18;v_win:=0;v_loss:=1;v_draw:=0;
    else v_delta:=2;v_win:=0;v_loss:=0;v_draw:=1; end if;
    insert into public.player_ranked_stats(user_id,rating,wins,losses,draws,matches_played,best_rating,updated_at)
    values(r.player_id,greatest(0,1000+v_delta),v_win,v_loss,v_draw,1,greatest(1000,1000+v_delta),now())
    on conflict(user_id) do update set
      rating=greatest(0,public.player_ranked_stats.rating+v_delta),
      wins=public.player_ranked_stats.wins+v_win,
      losses=public.player_ranked_stats.losses+v_loss,
      draws=public.player_ranked_stats.draws+v_draw,
      matches_played=public.player_ranked_stats.matches_played+1,
      best_rating=greatest(public.player_ranked_stats.best_rating,greatest(0,public.player_ranked_stats.rating+v_delta)),
      updated_at=now();
  end loop;
  return new;
end
$$;
drop trigger if exists process_ranked_match_result_trigger on public.multiplayer_results;
create trigger process_ranked_match_result_trigger after insert on public.multiplayer_results for each row execute function private.process_ranked_match_result();

with paired as (
  select a.match_id,a.player_id,a.score,b.score opponent_score
  from public.multiplayer_results a
  join public.multiplayer_results b on b.match_id=a.match_id and b.player_id<>a.player_id
  where a.validation_version is not null and a.event_digest is not null and b.validation_version is not null and b.event_digest is not null
), agg as (
  select player_id,
    count(*) filter(where score>opponent_score)::int wins,
    count(*) filter(where score<opponent_score)::int losses,
    count(*) filter(where score=opponent_score)::int draws,
    count(*)::int played
  from paired group by player_id
)
insert into public.player_ranked_stats(user_id,rating,wins,losses,draws,matches_played,best_rating,updated_at)
select player_id,greatest(0,1000+wins*25-losses*18+draws*2),wins,losses,draws,played,greatest(1000,1000+wins*25-losses*18+draws*2),now() from agg
on conflict(user_id) do update set rating=excluded.rating,wins=excluded.wins,losses=excluded.losses,draws=excluded.draws,matches_played=excluded.matches_played,best_rating=greatest(public.player_ranked_stats.best_rating,excluded.best_rating),updated_at=now();
insert into private.ranked_match_awards(match_id)
select distinct match_id from public.multiplayer_results where validation_version is not null and event_digest is not null
on conflict do nothing;

drop policy if exists "RhythmTap social presence read" on realtime.messages;
create policy "RhythmTap social presence read" on realtime.messages for select to authenticated using ((select realtime.topic())='rhythtap:social-presence-v1' and realtime.messages.extension='presence');
drop policy if exists "RhythmTap social presence write" on realtime.messages;
create policy "RhythmTap social presence write" on realtime.messages for insert to authenticated with check ((select realtime.topic())='rhythtap:social-presence-v1' and realtime.messages.extension='presence');