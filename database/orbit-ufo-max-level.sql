-- Preserve current level separately from the best level ever reached.
alter table public.players add column max_level integer not null default 1;
alter table public.leaderboard add column max_level integer not null default 1;
-- Recover all known reached levels, including recent rollbacks in cached responses.
with known as (
 select id as user_id, greatest(level,1) as reached from public.players
 union all select user_id, greatest(coalesce((state->>'maxLevel')::integer,1),(state->>'currentLevel')::integer) from private.game_saves
 union all select user_id, greatest(coalesce((response#>>'{state,maxLevel}')::integer,1),coalesce((response#>>'{state,currentLevel}')::integer,1)) from private.game_requests
), maxima as (select user_id,max(reached) as reached from known group by user_id)
update public.players p set max_level=m.reached from maxima m where m.user_id=p.id;
update private.game_saves s set state=jsonb_set(s.state,'{maxLevel}',to_jsonb(p.max_level)),revision=s.revision+1 from public.players p where p.id=s.user_id;

create or replace function private.sync_leaderboard() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 insert into public.leaderboard(player_id,username,level,max_level,total_clicks)
 values(new.id,new.username,new.level,new.max_level,new.total_clicks)
 on conflict(player_id) do update set username=excluded.username,level=excluded.level,
 max_level=greatest(public.leaderboard.max_level,excluded.max_level),total_clicks=excluded.total_clicks;
 return new;
end; $$;
revoke all on function private.sync_leaderboard() from public,anon,authenticated;
drop trigger players_sync_leaderboard on public.players;
create trigger players_sync_leaderboard after insert or update of username,level,max_level,total_clicks on public.players for each row execute function private.sync_leaderboard();
update public.leaderboard l set max_level=p.max_level from public.players p where p.id=l.player_id;
grant select(max_level) on public.leaderboard to anon,authenticated;
create index leaderboard_max_ranking_idx on public.leaderboard(max_level desc,total_clicks desc);

create or replace function public.game_commit(p_user uuid,p_request uuid,p_expected bigint,p_state jsonb,p_response jsonb) returns jsonb
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
 insert into public.players(id,username,total_clicks,total_seconds_played,level,max_level,moon_hp,shards,click_damage,click_damage_level,updated_at)
 values(p_user,p_state#>>'{playerData,username}',(p_state->>'clickCount')::bigint,
 (p_state->>'totalSecondsPlayed')::double precision,(p_state->>'currentLevel')::integer,
 greatest(coalesce((p_state->>'maxLevel')::integer,1),(p_state->>'currentLevel')::integer),
 (p_state->>'moonHP')::bigint,(p_state#>>'{playerData,shards}')::bigint,
 (p_state#>>'{playerData,click_damage}')::integer,(p_state#>>'{playerData,click_damage_level}')::integer,now())
 on conflict(id) do update set username=excluded.username,total_clicks=excluded.total_clicks,
 total_seconds_played=excluded.total_seconds_played,level=excluded.level,max_level=greatest(public.players.max_level,excluded.max_level),moon_hp=excluded.moon_hp,
 shards=excluded.shards,click_damage=excluded.click_damage,click_damage_level=excluded.click_damage_level,updated_at=now();
 insert into private.game_requests(user_id,request_id,response) values(p_user,p_request,p_response);
 delete from private.game_requests where user_id=p_user and created_at<now()-interval '1 day';
 return p_response;
end $$;

notify pgrst,'reload schema';
