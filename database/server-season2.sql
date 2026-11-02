drop trigger players_sync_leaderboard on public.players;
alter table public.players alter column moon_hp type bigint;
alter table public.players alter column total_clicks type bigint;
alter table public.players alter column shards type bigint;
alter table public.leaderboard alter column total_clicks type bigint;
create trigger players_sync_leaderboard after insert or update of username,level,total_clicks on public.players for each row execute function private.sync_leaderboard();
create table private.game_saves (
 user_id uuid primary key references auth.users(id) on delete cascade,
 state jsonb not null,
 revision bigint not null default 1,
 updated_at timestamptz not null default now()
);
create table private.game_requests (
 user_id uuid references auth.users(id) on delete cascade,
 request_id uuid not null,
 response jsonb not null,
 created_at timestamptz not null default now(),
 primary key(user_id,request_id)
);
alter table private.game_saves enable row level security;
alter table private.game_requests enable row level security;
revoke all on private.game_saves,private.game_requests from public,anon,authenticated;
grant usage on schema private to service_role;
grant all on private.game_saves,private.game_requests to service_role;

create function public.game_load(p_user uuid,p_request uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare s private.game_saves%rowtype; cached jsonb;
begin

 select response into cached from private.game_requests where user_id=p_user and request_id=p_request;
 if cached is not null then return jsonb_build_object('cached',cached);end if;
 select * into s from private.game_saves where user_id=p_user;
 return jsonb_build_object('state',s.state,'revision',coalesce(s.revision,0));
end $$;
revoke all on function public.game_load(uuid,uuid) from public,anon,authenticated;
grant execute on function public.game_load(uuid,uuid) to service_role;

create function public.game_commit(p_user uuid,p_request uuid,p_expected bigint,p_state jsonb,p_response jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare cached jsonb; affected integer;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));

 select response into cached from private.game_requests where user_id=p_user and request_id=p_request;
 if cached is not null then return cached; end if;
 if p_expected=0 then
  insert into private.game_saves(user_id,state) values(p_user,p_state) on conflict do nothing;
 else
  update private.game_saves set state=p_state,revision=revision+1,updated_at=now()
  where user_id=p_user and revision=p_expected;
 end if;
 get diagnostics affected=row_count;
 if affected<>1 then raise exception using errcode='40001',message='Revision conflict'; end if;
 insert into public.players(id,username,total_clicks,total_seconds_played,level,moon_hp,shards,click_damage,click_damage_level,updated_at)
 values(p_user,p_state#>>'{playerData,username}',(p_state->>'clickCount')::bigint,
 (p_state->>'totalSecondsPlayed')::double precision,(p_state->>'currentLevel')::integer,
 (p_state->>'moonHP')::bigint,(p_state#>>'{playerData,shards}')::bigint,
 (p_state#>>'{playerData,click_damage}')::integer,(p_state#>>'{playerData,click_damage_level}')::integer,now())
 on conflict(id) do update set username=excluded.username,total_clicks=excluded.total_clicks,
 total_seconds_played=excluded.total_seconds_played,level=excluded.level,moon_hp=excluded.moon_hp,
 shards=excluded.shards,click_damage=excluded.click_damage,click_damage_level=excluded.click_damage_level,updated_at=now();
 insert into private.game_requests(user_id,request_id,response) values(p_user,p_request,p_response);
 delete from private.game_requests where user_id=p_user and created_at<now()-interval '1 day';
 return p_response;
end $$;
revoke all on function public.game_commit(uuid,uuid,bigint,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.game_commit(uuid,uuid,bigint,jsonb,jsonb) to service_role;
revoke insert,update,delete,truncate on public.players from anon,authenticated;
revoke insert,update,delete,truncate on public.clicks from anon,authenticated;
notify pgrst,'reload schema';
grant select, insert, update on public.players to service_role;
