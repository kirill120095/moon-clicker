create index game_requests_expiry_idx on private.game_requests(created_at);
create function private.prune_game_history() returns void
language plpgsql security invoker set search_path='' as $$
begin
 delete from private.game_requests where ctid in (select ctid from private.game_requests where created_at<now()-interval '1 day' order by created_at limit 500 for update skip locked);
 delete from private.game_diagnostics where ctid in (select ctid from private.game_diagnostics where created_at<now()-interval '7 days' order by created_at limit 500 for update skip locked);
end; $$;
revoke all on function private.prune_game_history() from public,anon,authenticated;
grant execute on function private.prune_game_history() to service_role;
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
 if (hashtextextended(p_request::text,0)&63)=0 then perform private.prune_game_history();end if;
 return p_response;
end; $$;

notify pgrst,'reload schema';
