-- Keep the profile trigger callable by PostgreSQL triggers without exposing it
-- as an unauthenticated or authenticated PostgREST RPC.
revoke execute on function public.handle_new_user_profile() from anon, authenticated;
