begin;

alter table public.player_profiles
  add column if not exists coins bigint not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'player_profiles_coins_nonnegative'
      and conrelid = 'public.player_profiles'::regclass
  ) then
    alter table public.player_profiles
      add constraint player_profiles_coins_nonnegative check (coins >= 0);
  end if;
end
$$;

-- Preserve the value players previously saw as "XP Credits" when the real
-- spendable currency is introduced. This runs once as part of this migration.
update public.player_profiles
set coins = floor(xp::numeric / 10)::bigint
where coins = 0 and xp > 0;

alter table public.player_progress_events
  add column if not exists coin_awarded integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'player_progress_events_coin_awarded_nonnegative'
      and conrelid = 'public.player_progress_events'::regclass
  ) then
    alter table public.player_progress_events
      add constraint player_progress_events_coin_awarded_nonnegative check (coin_awarded >= 0);
  end if;
end
$$;

create table if not exists public.song_store_catalog (
  song_id text primary key,
  price integer not null check (price >= 0),
  starter boolean not null default false,
  legacy_unlock_level integer not null default 1 check (legacy_unlock_level >= 1),
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.song_store_catalog (song_id, price, starter, legacy_unlock_level, active)
values
  ('voltage',0,true,1,true),
  ('sickness',0,true,1,true),
  ('never-left',0,true,1,true),
  ('fly-eagle',0,true,1,true),
  ('afterglow',250,false,2,true),
  ('my-immortal',350,false,2,true),
  ('crazy-train',400,false,2,true),
  ('kryptonite',450,false,2,true),
  ('kill-you',650,false,3,true),
  ('gravity',800,false,4,true),
  ('through-fire-flames',1200,false,5,true)
on conflict (song_id) do update
set price = excluded.price,
    starter = excluded.starter,
    legacy_unlock_level = excluded.legacy_unlock_level,
    active = excluded.active,
    updated_at = now();

create table if not exists public.player_song_unlocks (
  user_id uuid not null references public.player_profiles(user_id) on delete cascade,
  song_id text not null references public.song_store_catalog(song_id) on delete cascade,
  purchased_for integer not null default 0 check (purchased_for >= 0),
  source text not null default 'store' check (source in ('starter','legacy-level','store')),
  unlocked_at timestamptz not null default now(),
  primary key (user_id, song_id)
);

create index if not exists player_song_unlocks_user_idx
  on public.player_song_unlocks (user_id, unlocked_at desc);

-- Grandfather songs that were already available under the old level gate.
insert into public.player_song_unlocks (user_id, song_id, purchased_for, source)
select p.user_id,
       c.song_id,
       0,
       case when c.starter then 'starter' else 'legacy-level' end
from public.player_profiles p
cross join public.song_store_catalog c
where c.active
  and (c.starter or p.level >= c.legacy_unlock_level)
on conflict (user_id, song_id) do nothing;

alter table public.song_store_catalog enable row level security;
alter table public.player_song_unlocks enable row level security;

revoke all on public.song_store_catalog from anon, authenticated;
revoke all on public.player_song_unlocks from anon, authenticated;
grant select on public.song_store_catalog to anon, authenticated;
grant select on public.player_song_unlocks to authenticated;

drop policy if exists "Active song store catalog is viewable" on public.song_store_catalog;
create policy "Active song store catalog is viewable"
on public.song_store_catalog for select
using (active);

drop policy if exists "Players can view their song unlocks" on public.player_song_unlocks;
create policy "Players can view their song unlocks"
on public.player_song_unlocks for select to authenticated
using (auth.uid() = user_id);

create or replace function public.apply_progress_coin_award()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  award integer;
begin
  if new.xp_awarded <= 0 then
    new.coin_awarded := 0;
    return new;
  end if;

  award := least(100, greatest(25, round(new.xp_awarded::numeric / 15)::integer));
  new.coin_awarded := award;

  update public.player_profiles
  set coins = coins + award
  where user_id = new.user_id;

  if not found then
    raise exception 'Player profile not found';
  end if;

  return new;
end;
$$;

revoke all on function public.apply_progress_coin_award() from public, anon, authenticated;

drop trigger if exists player_progress_events_award_coins on public.player_progress_events;
create trigger player_progress_events_award_coins
before insert on public.player_progress_events
for each row execute function public.apply_progress_coin_award();

create or replace function public.purchase_song_unlock(p_song_id text)
returns table (
  coin_balance bigint,
  purchased_song_id text,
  price_paid integer,
  purchased boolean,
  already_owned boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  offer public.song_store_catalog%rowtype;
  balance bigint;
begin
  if uid is null then
    raise exception 'Authentication required';
  end if;

  select * into offer
  from public.song_store_catalog
  where song_id = p_song_id and active
  limit 1;

  if offer.song_id is null then
    raise exception 'Track is not available in the RhythmTap Store';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('song-store:' || uid::text, 0));

  select p.coins into balance
  from public.player_profiles p
  where p.user_id = uid
  for update;

  if balance is null then
    raise exception 'Player profile not found';
  end if;

  if offer.starter or exists (
    select 1 from public.player_song_unlocks u
    where u.user_id = uid and u.song_id = offer.song_id
  ) then
    return query select balance, offer.song_id, 0, false, true;
    return;
  end if;

  if balance < offer.price then
    raise exception 'Not enough coins';
  end if;

  update public.player_profiles p
  set coins = p.coins - offer.price
  where p.user_id = uid
  returning p.coins into balance;

  insert into public.player_song_unlocks (user_id, song_id, purchased_for, source)
  values (uid, offer.song_id, offer.price, 'store')
  on conflict (user_id, song_id) do nothing;

  return query select balance, offer.song_id, offer.price, true, false;
end;
$$;

revoke all on function public.purchase_song_unlock(text) from public, anon;
grant execute on function public.purchase_song_unlock(text) to authenticated;

commit;
