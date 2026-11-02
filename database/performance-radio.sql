-- Numeric game progression has no gameplay level cap; use bigint mirrors.
drop trigger players_sync_leaderboard on public.players;
alter table public.players alter column level type bigint,alter column max_level type bigint,alter column click_damage type bigint,alter column click_damage_level type bigint;
alter table public.leaderboard alter column level type bigint,alter column max_level type bigint;
create or replace function private.sync_leaderboard() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and new.username is not distinct from old.username and new.level=old.level and new.max_level=old.max_level and new.total_clicks=old.total_clicks then return new;end if;
 insert into public.leaderboard(player_id,username,level,max_level,total_clicks)
 values(new.id,new.username,new.level,new.max_level,new.total_clicks)
 on conflict(player_id) do update set username=excluded.username,level=excluded.level,max_level=greatest(public.leaderboard.max_level,excluded.max_level),total_clicks=excluded.total_clicks;
 return new;
end; $$;
create trigger players_sync_leaderboard after insert or update of username,level,max_level,total_clicks on public.players for each row execute function private.sync_leaderboard();
create index if not exists game_requests_cleanup_idx on private.game_requests(user_id,created_at);
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
 (p_state->>'totalSecondsPlayed')::double precision,(p_state->>'currentLevel')::bigint,
 greatest(coalesce((p_state->>'maxLevel')::bigint,1),(p_state->>'currentLevel')::bigint),
 (p_state->>'moonHP')::bigint,(p_state#>>'{playerData,shards}')::bigint,
 (p_state#>>'{playerData,click_damage}')::bigint,(p_state#>>'{playerData,click_damage_level}')::bigint,now())
 on conflict(id) do update set username=excluded.username,total_clicks=excluded.total_clicks,
 total_seconds_played=excluded.total_seconds_played,level=excluded.level,max_level=greatest(public.players.max_level,excluded.max_level),moon_hp=excluded.moon_hp,
 shards=excluded.shards,click_damage=excluded.click_damage,click_damage_level=excluded.click_damage_level,updated_at=now();
 insert into private.game_requests(user_id,request_id,response) values(p_user,p_request,p_response);
 delete from private.game_requests where user_id=p_user and created_at<now()-interval '1 day';
 return p_response;
end $$;


-- One hot-path database call validates the live session and atomically commits.
create function public.game_commit_fast(p_user uuid,p_session uuid,p_request uuid,p_expected bigint,p_state jsonb,p_response jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from auth.sessions s join auth.users u on u.id=s.user_id where s.id=p_session and s.user_id=p_user and (s.not_after is null or s.not_after>now()) and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now())) then
  raise exception using errcode='28000',message='Invalid session';
 end if;
 return public.game_commit(p_user,p_request,p_expected,p_state,p_response);
end; $$;
revoke all on function public.game_commit_fast(uuid,uuid,uuid,bigint,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.game_commit_fast(uuid,uuid,uuid,bigint,jsonb,jsonb) to service_role;

create table private.radio_admins(user_id uuid primary key references auth.users(id) on delete cascade);
alter table private.radio_admins enable row level security;
revoke all on private.radio_admins from public,anon,authenticated;
insert into private.radio_admins(user_id) select p.id from public.players p join auth.users u on u.id=p.id where lower(p.username)='kirill120095';
create function public.is_radio_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.radio_admins where user_id=(select auth.uid()));
$$;
revoke all on function public.is_radio_admin() from public,anon;
grant execute on function public.is_radio_admin() to authenticated;
create table public.game_radio(id integer primary key check(id=1),track_path text,title text not null default '',started_at timestamptz not null default now(),version bigint not null default 1);
insert into public.game_radio(id) values(1);
alter table public.game_radio enable row level security;
revoke all on public.game_radio from public,anon,authenticated;
grant select on public.game_radio to anon,authenticated;
create policy radio_listen on public.game_radio for select to anon,authenticated using(true);
create function public.radio_publish(p_path text,p_title text) returns public.game_radio
language plpgsql security definer set search_path='' as $$
declare result public.game_radio;
begin
 if not public.is_radio_admin() then raise exception 'Only the radio administrator can publish';end if;
 if p_path is not null and not exists(select 1 from storage.objects where bucket_id='game-radio' and name=p_path) then raise exception 'Track not found';end if;
 update public.game_radio set track_path=p_path,title=left(coalesce(p_title,''),120),started_at=clock_timestamp(),version=version+1 where id=1 returning * into result;
 return result;
end; $$;
revoke all on function public.radio_publish(text,text) from public,anon;
grant execute on function public.radio_publish(text,text) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('game-radio','game-radio',true,20971520,array['audio/mpeg','audio/mp3','audio/ogg','audio/wav','audio/x-wav','audio/mp4','audio/aac','audio/flac','audio/webm']);
create policy radio_admin_read on storage.objects for select to authenticated using(bucket_id='game-radio' and (select public.is_radio_admin()));
create policy radio_admin_upload on storage.objects for insert to authenticated with check(bucket_id='game-radio' and (select public.is_radio_admin()));
create policy radio_admin_delete on storage.objects for delete to authenticated using(bucket_id='game-radio' and (select public.is_radio_admin()));
alter publication supabase_realtime add table public.game_radio;
notify pgrst,'reload schema';
