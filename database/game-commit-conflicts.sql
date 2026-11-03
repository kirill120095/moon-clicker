-- A revision mismatch is an expected concurrency result, not a Data API 5xx.
create function public.game_commit_safe(p_user uuid,p_session uuid,p_request uuid,p_expected bigint,p_state jsonb,p_response jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from auth.sessions s join auth.users u on u.id=s.user_id where s.id=p_session and s.user_id=p_user and (s.not_after is null or s.not_after>now()) and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now())) then raise exception using errcode='28000',message='Invalid session';end if;
 begin
  return public.game_commit(p_user,p_request,p_expected,p_state,p_response);
 exception when serialization_failure then
  return jsonb_build_object('conflict',true);
 end;
end; $$;
revoke all on function public.game_commit_safe(uuid,uuid,uuid,bigint,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.game_commit_safe(uuid,uuid,uuid,bigint,jsonb,jsonb) to service_role;
notify pgrst,'reload schema';
