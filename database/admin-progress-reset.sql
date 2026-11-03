-- Owner-only global progress reset. Account identities and radio data are preserved.
create table private.game_admins(user_id uuid primary key references auth.users(id) on delete cascade);
alter table private.game_admins enable row level security;
revoke all on private.game_admins from public,anon,authenticated;
insert into private.game_admins(user_id) select p.id from public.players p join private.radio_admins a on a.user_id=p.id where p.username='kirill120095';
do $$ begin if (select count(*) from private.game_admins)<>1 then raise exception 'Expected exactly one game owner';end if;end $$;

create table private.game_admin_resets(
 request_id uuid primary key,
 admin_id uuid not null references auth.users(id),
 result jsonb not null,
 created_at timestamptz not null default now()
);
alter table private.game_admin_resets enable row level security;
revoke all on private.game_admin_resets from public,anon,authenticated;

create function public.is_game_admin() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(
  select 1 from private.game_admins a join auth.users u on u.id=a.user_id
  join auth.sessions s on s.user_id=u.id
  where a.user_id=(select auth.uid()) and s.id::text=(select auth.jwt()->>'session_id')
  and (s.not_after is null or s.not_after>now()) and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now())
 );
$$;
revoke all on function public.is_game_admin() from public,anon,authenticated;
grant execute on function public.is_game_admin() to authenticated;

create function public.admin_reset_all_progress(p_request uuid,p_confirmation text) returns jsonb
language plpgsql security definer set search_path='' as $$
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
 -- The normal trigger preserves records with GREATEST; reset them explicitly.
 update public.leaderboard set level=1,max_level=1,total_clicks=0 where player_id is not null;
 delete from public.clicks where id is not null;
 result:=jsonb_build_object('players_reset',reset_count,'reset_at',clock_timestamp());
 insert into private.game_admin_resets(request_id,admin_id,result) values(p_request,(select auth.uid()),result);
 return result;
end; $$;
revoke all on function public.admin_reset_all_progress(uuid,text) from public,anon,authenticated;
grant execute on function public.admin_reset_all_progress(uuid,text) to authenticated;
notify pgrst,'reload schema';
