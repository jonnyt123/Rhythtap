-- Allow the service-role validate-match insert trigger to claim each ranked match once.
-- Keep the trigger as invoker security; grant only the private objects it actually needs.
grant usage on schema private to service_role;
grant select, insert on table private.ranked_match_awards to service_role;
