create or replace function public.get_visible_player_pro_badges(p_user_ids uuid[])
returns table(user_id uuid, pro_badge boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select p.user_id,
         coalesce(e.pro_enabled, false) as pro_badge
  from public.player_profiles p
  left join public.player_billing_entitlements e
    on e.user_id = p.user_id
   and e.environment = 'live'
  where p.user_id = any(coalesce(p_user_ids, array[]::uuid[]))
    and (p.is_public or p.user_id = (select auth.uid()));
$$;

revoke all on function public.get_visible_player_pro_badges(uuid[]) from public;
grant execute on function public.get_visible_player_pro_badges(uuid[]) to anon, authenticated;
