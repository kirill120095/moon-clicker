-- Keep the idempotency ledger, without duplicating the full save on every action.
create function private.game_request_response(p_user uuid,p_request uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare cached jsonb;s private.game_saves%rowtype;
begin
 select response into cached from private.game_requests where user_id=p_user and request_id=p_request;
 if cached is null then return null;end if;
 select * into s from private.game_saves where user_id=p_user;
 if not found then return null;end if;
 return (cached-'state')||jsonb_build_object('state',s.state||jsonb_build_object('effects','[]'::jsonb),'revision',s.revision,'serverNow',floor(extract(epoch from clock_timestamp())*1000)::bigint);
end; $$;
revoke all on function private.game_request_response(uuid,uuid) from public,anon,authenticated;
grant execute on function private.game_request_response(uuid,uuid) to service_role;

create or replace function public.game_load(p_user uuid,p_request uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare s private.game_saves%rowtype;cached jsonb;
begin
 cached:=private.game_request_response(p_user,p_request);
 if cached is not null then return jsonb_build_object('cached',cached);end if;
 select * into s from private.game_saves where user_id=p_user;
 return jsonb_build_object('state',s.state,'revision',coalesce(s.revision,0));
end; $$;
create or replace function public.game_commit(p_user uuid,p_request uuid,p_expected bigint,p_state jsonb,p_response jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare cached jsonb;affected integer;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 cached:=private.game_request_response(p_user,p_request);
 if cached is not null then return cached;end if;
 if p_expected=0 then
  insert into private.game_saves(user_id,state) values(p_user,p_state) on conflict do nothing;
 else
  update private.game_saves set state=p_state,revision=revision+1,updated_at=now() where user_id=p_user and revision=p_expected;
 end if;
 get diagnostics affected=row_count;
 if affected<>1 then raise exception using errcode='40001',message='Revision conflict';end if;
 insert into public.players(id,username,total_clicks,total_seconds_played,level,max_level,moon_hp,shards,click_damage,click_damage_level,updated_at)
 values(p_user,p_state#>>'{playerData,username}',(p_state->>'clickCount')::bigint,(p_state->>'totalSecondsPlayed')::double precision,(p_state->>'currentLevel')::bigint,
 greatest(coalesce((p_state->>'maxLevel')::bigint,1),(p_state->>'currentLevel')::bigint),(p_state->>'moonHP')::bigint,(p_state#>>'{playerData,shards}')::bigint,
 (p_state#>>'{playerData,click_damage}')::bigint,(p_state#>>'{playerData,click_damage_level}')::bigint,now())
 on conflict(id) do update set username=excluded.username,total_clicks=excluded.total_clicks,total_seconds_played=excluded.total_seconds_played,level=excluded.level,
 max_level=greatest(public.players.max_level,excluded.max_level),moon_hp=excluded.moon_hp,shards=excluded.shards,click_damage=excluded.click_damage,click_damage_level=excluded.click_damage_level,updated_at=now();
 insert into private.game_requests(user_id,request_id,response) values(p_user,p_request,p_response-'state');
 delete from private.game_requests where user_id=p_user and created_at<now()-interval '1 day';
 return p_response;
end; $$;
-- Existing cached snapshots are replaced by small receipts; player saves are untouched.
update private.game_requests set response=response-'state' where response?'state';
create index game_diagnostics_dedupe_idx on private.game_diagnostics(user_id,action,code,created_at desc);
create or replace function public.game_record_diagnostic(p_user uuid,p_request uuid,p_action text,p_code text,p_message text,p_level text) returns void
language plpgsql security invoker set search_path='' as $$
begin
 if p_code<>'OK' and exists(select 1 from private.game_diagnostics where user_id=p_user and action=left(p_action,40) and code=left(p_code,40) and created_at>now()-interval '30 seconds') then return;end if;
 insert into private.game_diagnostics(user_id,request_id,action,code,message,level)
 values(p_user,p_request,left(coalesce(p_action,'unknown'),40),left(coalesce(p_code,'UNKNOWN'),40),left(coalesce(p_message,''),300),case when p_level in ('info','warn','error') then p_level else 'error' end);
 delete from private.game_diagnostics where created_at<now()-interval '7 days';
end; $$;
notify pgrst,'reload schema';
