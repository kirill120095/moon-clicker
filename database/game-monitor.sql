create table private.game_diagnostics(
 id bigint generated always as identity primary key,
 created_at timestamptz not null default now(),
 user_id uuid references auth.users(id) on delete set null,
 request_id uuid,action text not null,code text not null,message text not null,level text not null
);
alter table private.game_diagnostics enable row level security;
revoke all on private.game_diagnostics from public,anon,authenticated;
create index game_diagnostics_created_idx on private.game_diagnostics(created_at desc);
create index game_diagnostics_user_idx on private.game_diagnostics(user_id);
create function public.game_record_diagnostic(p_user uuid,p_request uuid,p_action text,p_code text,p_message text,p_level text) returns void
language plpgsql security invoker set search_path='' as $$
begin
 insert into private.game_diagnostics(user_id,request_id,action,code,message,level)
 values(p_user,p_request,left(coalesce(p_action,'unknown'),40),left(coalesce(p_code,'UNKNOWN'),40),left(coalesce(p_message,''),300),case when p_level in ('info','warn','error') then p_level else 'error' end);
 delete from private.game_diagnostics where created_at<now()-interval '7 days';
end; $$;
revoke all on function public.game_record_diagnostic(uuid,uuid,text,text,text,text) from public,anon,authenticated;
grant all on private.game_diagnostics to service_role;
grant usage,select on sequence private.game_diagnostics_id_seq to service_role;
grant execute on function public.game_record_diagnostic(uuid,uuid,text,text,text,text) to service_role;
create function public.get_game_monitor(p_limit integer default 100) returns jsonb
language plpgsql security definer set search_path='' as $$
declare events jsonb;stats jsonb;
begin
 if not public.is_game_admin() then raise exception using errcode='42501',message='Мониторинг доступен только владельцу игры';end if;
 select coalesce(jsonb_agg(to_jsonb(t) order by t.id desc),'[]'::jsonb) into events from
 (select id,created_at,request_id,action,code,message,level from private.game_diagnostics order by id desc limit least(200,greatest(1,coalesce(p_limit,100)))) t;
 select jsonb_build_object('errors_24h',count(*) filter(where level='error'),'successful_loads_24h',count(*) filter(where action='load' and code='OK'),'last_event',max(created_at)) into stats from private.game_diagnostics where created_at>now()-interval '1 day';
 return jsonb_build_object('events',events,'stats',stats,'server_now',clock_timestamp());
end; $$;
revoke all on function public.get_game_monitor(integer) from public,anon,authenticated;
grant execute on function public.get_game_monitor(integer) to authenticated;
notify pgrst,'reload schema';
