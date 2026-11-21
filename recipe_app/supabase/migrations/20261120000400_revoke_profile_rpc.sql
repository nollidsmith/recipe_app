-- The trigger function must not be exposed as a PostgREST RPC. PostgreSQL
-- grants EXECUTE to PUBLIC by default when a function is created.
revoke execute on function public.handle_new_user_profile() from public, anon, authenticated;
