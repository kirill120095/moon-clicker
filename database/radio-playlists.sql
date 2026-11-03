
create table public.radio_playlists(
 id uuid primary key default gen_random_uuid(),
 title text not null check(length(title) between 1 and 120),
 tracks jsonb not null default '[]'::jsonb check(jsonb_typeof(tracks)='array'),
 updated_at timestamptz not null default now()
);
alter table public.radio_playlists enable row level security;
revoke all on public.radio_playlists from public,anon,authenticated;
grant select on public.radio_playlists to authenticated;
create policy radio_playlists_owner_read on public.radio_playlists for select to authenticated using((select public.is_radio_admin()));
alter table public.game_radio add column playlist_id uuid references public.radio_playlists(id) on delete set null,
 add column schedule jsonb not null default '[]'::jsonb,
 add column track_index integer not null default 0,
 add column repeat_track boolean not null default false,
 add column repeat_playlist boolean not null default true;

create function public.radio_playlist_save(p_id uuid,p_title text,p_tracks jsonb) returns public.radio_playlists
language plpgsql security definer set search_path='' as $$
declare result public.radio_playlists; item jsonb; v_title text:=btrim(coalesce(p_title,''));
begin
 if not public.is_radio_admin() then raise exception 'Only the radio administrator can edit playlists';end if;
 if length(v_title)<1 or length(v_title)>120 or p_tracks is null or jsonb_typeof(p_tracks)<>'array' then raise exception 'Invalid playlist';end if;
 for item in select value from jsonb_array_elements(p_tracks) loop
  if jsonb_typeof(item)<>'object' or coalesce(item->>'title','')='' or length(item->>'title')>255
   or jsonb_typeof(item->'duration') is distinct from 'number' or (item->>'duration')::numeric<=0
   or not exists(select 1 from storage.objects where bucket_id='game-radio' and name=item->>'path')
  then raise exception 'Invalid playlist track';end if;
 end loop;
 if p_id is null then
  insert into public.radio_playlists(title,tracks) values(v_title,p_tracks) returning * into result;
 else
  update public.radio_playlists set title=v_title,tracks=p_tracks,updated_at=now() where id=p_id returning * into result;
  if not found then raise exception 'Playlist not found';end if;
 end if;
 return result;
end; $$;

create function public.radio_playlist_delete(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not public.is_radio_admin() then raise exception 'Only the radio administrator can delete playlists';end if;
 perform 1 from public.game_radio where id=1 for update;
 update public.game_radio set playlist_id=null,schedule='[]'::jsonb,track_path=null,title='',started_at=clock_timestamp(),version=version+1 where id=1 and playlist_id=p_id;
 delete from public.radio_playlists where id=p_id;
end; $$;

create function public.radio_control(p_action text,p_playlist uuid default null,p_index integer default 0,p_offset double precision default 0,p_repeat_track boolean default null,p_repeat_playlist boolean default null,p_expected bigint default null) returns public.game_radio
language plpgsql security definer set search_path='' as $$
declare r public.game_radio; tracks jsonb; item jsonb;
begin
 if not public.is_radio_admin() then raise exception 'Only the radio administrator can control playback';end if;
 select * into r from public.game_radio where id=1 for update;
 if p_expected is not null and p_expected<>r.version then raise exception 'Radio changed. Refresh and try again';end if;
 if p_action='stop' then
  update public.game_radio set track_path=null,title='',playlist_id=null,schedule='[]'::jsonb,started_at=clock_timestamp(),version=version+1 where id=1 returning * into r;return r;
 elsif p_action='play' then
  select p.tracks into tracks from public.radio_playlists p where p.id=p_playlist;
 elsif p_action in ('seek','mode') then
  tracks:=r.schedule;p_playlist:=r.playlist_id;
 else raise exception 'Unknown radio action';
 end if;
 if tracks is null or p_index is null or p_index<0 or p_index>=jsonb_array_length(tracks) then raise exception 'Choose a nonempty playlist';end if;
 item:=tracks->p_index;
 if p_offset is null or not(p_offset>=0 and p_offset<(item->>'duration')::double precision) then raise exception 'Invalid track position';end if;
 update public.game_radio set playlist_id=p_playlist,schedule=tracks,track_index=p_index,
  track_path=item->>'path',title=item->>'title',started_at=clock_timestamp()-make_interval(secs=>p_offset),
  repeat_track=coalesce(p_repeat_track,r.repeat_track),repeat_playlist=coalesce(p_repeat_playlist,r.repeat_playlist),version=version+1
 where id=1 returning * into r;
 return r;
end; $$;
-- Older clients may still publish a single track; clear the playlist snapshot atomically.
create or replace function public.radio_publish(p_path text,p_title text) returns public.game_radio
language plpgsql security definer set search_path='' as $$
declare result public.game_radio;
begin
 if not public.is_radio_admin() then raise exception 'Only the radio administrator can publish';end if;
 if p_path is not null and not exists(select 1 from storage.objects where bucket_id='game-radio' and name=p_path) then raise exception 'Track not found';end if;
 update public.game_radio set track_path=p_path,title=left(coalesce(p_title,''),120),playlist_id=null,schedule='[]'::jsonb,track_index=0,started_at=clock_timestamp(),version=version+1 where id=1 returning * into result;
 return result;
end; $$;
revoke all on function public.radio_playlist_save(uuid,text,jsonb),public.radio_playlist_delete(uuid),public.radio_control(text,uuid,integer,double precision,boolean,boolean,bigint) from public,anon,authenticated;
grant execute on function public.radio_playlist_save(uuid,text,jsonb),public.radio_playlist_delete(uuid),public.radio_control(text,uuid,integer,double precision,boolean,boolean,bigint) to authenticated;
notify pgrst,'reload schema';

create table public.radio_library(
 path text primary key,
 title text not null check(length(title) between 1 and 255),
 duration double precision not null check(duration>0 and duration<'Infinity'::double precision)
);
alter table public.radio_library enable row level security;
revoke all on public.radio_library from public,anon,authenticated;
grant select on public.radio_library to authenticated;
create policy radio_library_owner_read on public.radio_library for select to authenticated using((select public.is_radio_admin()));
create function public.radio_track_save(p_path text,p_title text,p_duration double precision) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not public.is_radio_admin() then raise exception 'Only the radio administrator can edit tracks';end if;
 if not exists(select 1 from storage.objects where bucket_id='game-radio' and name=p_path) then raise exception 'Track not found';end if;
 insert into public.radio_library(path,title,duration) values(p_path,p_title,p_duration)
 on conflict(path) do update set title=excluded.title,duration=excluded.duration;
end; $$;
revoke all on function public.radio_track_save(text,text,double precision) from public,anon,authenticated;
grant execute on function public.radio_track_save(text,text,double precision) to authenticated;
notify pgrst,'reload schema';
