-- Full progress resets; applied to Supabase on 2026-11-06.
-- Individual reset is identified by the authenticated request UUID in state.resetId.
-- Global reset preserves authentication identities; neither routine runs during deployment.

CREATE OR REPLACE FUNCTION public.admin_reset_all_progress(p_request uuid, p_confirmation text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare cached jsonb; reset_count bigint; result jsonb;
begin
 if not public.is_game_admin() then raise exception using errcode='42501',message='Только владелец игры может сбросить общий прогресс';end if;
 if p_request is null or p_confirmation is distinct from 'СБРОСИТЬ ВЕСЬ ПРОГРЕСС' then raise exception 'Необходимо точное подтверждение полного сброса';end if;
 perform pg_advisory_xact_lock(hashtextextended('moon-clicker-global-reset',0));
 select r.result into cached from private.game_admin_resets r where r.request_id=p_request and r.admin_id=(select auth.uid());
 if cached is not null then return cached;end if;
 lock table private.game_requests,private.game_saves,public.players,public.leaderboard,public.clicks in exclusive mode;
 -- A higher revision invalidates all old signed state snapshots.
 delete from private.game_requests where user_id is not null;
 update private.game_saves s set state=jsonb_set(
  jsonb_set('{"runMaxLevel":1,"prestige":{"coins":0,"claimedCoinSteps":0,"ascensions":0,"upgrades":{}},"moonSerial":1,"maxLevel":1,"ufoCount":0,"ufoLevel":0,"ufoComboRelay":false,"lastComboAt":0,"ufoLastShotAt":0,"effects":[],"currentLevel":1,"moonHP":1000,"maxHP":1000,"clickCount":0,"totalSecondsPlayed":0,"playerData":{"username":"","shards":0,"click_damage":10,"click_damage_level":0},"activeMoon":"normal","activeMoons":["normal"],"ownedMoons":["normal"],"moonLevels":{"normal":1},"maxSlots":1,"bossKills":0,"levelLocked":false,"testMode":false,"quests":{},"achievements":{},"runtime":{},"tokens":12,"lastActionAt":0,"bossDeadline":null,"lastQuestDay":""}'::jsonb,'{playerData,username}',coalesce(to_jsonb(s.state#>>'{playerData,username}'),to_jsonb('Игрок'::text))),
  '{moonSerial}',to_jsonb(coalesce((s.state->>'moonSerial')::bigint,1)+1))||jsonb_build_object('resetId',p_request::text),
  revision=revision+1,updated_at=now() where s.user_id is not null;
 get diagnostics reset_count=row_count;
 update public.players set total_clicks=0,first_click_at=null,last_click_at=null,session_count=0,total_seconds_played=0,current_session_start=null,
 level=1,max_level=1,moon_hp=1000,shards=0,click_damage=10,click_damage_level=0,updated_at=now() where id is not null;
 update public.players set device_type=null,browser=null,browser_version=null,os=null,os_version=null,screen_width=null,screen_height=null,color_depth=null,language=null,timezone=null,country=null,city=null,region=null,postal=null,ip=null,referrer=null,user_agent=null where id is not null;
 -- The normal trigger preserves records with GREATEST; reset them explicitly.
 update public.leaderboard set level=1,max_level=1,total_clicks=0 where player_id is not null;
 delete from public.clicks where id is not null;
 result:=jsonb_build_object('players_reset',reset_count,'reset_at',clock_timestamp());
 insert into private.game_admin_resets(request_id,admin_id,result) values(p_request,(select auth.uid()),result);
 return result;
end; $function$
;

CREATE OR REPLACE FUNCTION public.game_commit(p_user uuid, p_request uuid, p_expected bigint, p_state jsonb, p_response jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
 max_level=case when p_state->>'resetId'=p_request::text then excluded.max_level else greatest(public.players.max_level,excluded.max_level) end,moon_hp=excluded.moon_hp,shards=excluded.shards,click_damage=excluded.click_damage,click_damage_level=excluded.click_damage_level,updated_at=now();
 if p_state->>'resetId'=p_request::text then
  update public.players set first_click_at=null,last_click_at=null,session_count=0,current_session_start=null where id=p_user;
  update public.leaderboard set level=1,max_level=1,total_clicks=0 where player_id=p_user;
  delete from public.clicks where player_id=p_user;
 end if;
 insert into private.game_requests(user_id,request_id,response) values(p_user,p_request,p_response-'state');
 if (hashtextextended(p_request::text,0)&63)=0 then perform private.prune_game_history();end if;
 return p_response;
end; $function$
;
