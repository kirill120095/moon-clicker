begin;
do $test$
declare a uuid; b uuid; n integer; before_level integer;
begin
  select id into a from public.players order by id limit 1;
  select id into b from public.players where id <> a order by id limit 1;
  if a is null or b is null then raise exception 'Need two existing players for isolation test'; end if;
  execute 'set local role anon';
  begin
    perform email from public.players limit 1;
    raise exception 'FAIL: anon can read players';
  exception when insufficient_privilege then null; end;
  perform username,level,total_clicks from public.leaderboard limit 1;
  begin
    perform player_id from public.leaderboard limit 1;
    raise exception 'FAIL: anon can read internal ID';
  exception when insufficient_privilege then null; end;
  execute 'reset role';
  perform set_config('request.jwt.claim.sub',a::text,true);
  execute 'set local role authenticated';
  select count(*) into n from public.players;
  if n <> 1 then raise exception 'FAIL: authenticated sees % rows',n; end if;
  update public.players set level=level where id=b;
  get diagnostics n=row_count;
  if n <> 0 then raise exception 'FAIL: other player updated'; end if;
  select level into before_level from public.players where id=a;
  update public.players set level=coalesce(level,1)+1 where id=a;
  get diagnostics n=row_count;
  if n <> 1 then raise exception 'FAIL: own update failed'; end if;
  begin
    update public.leaderboard set level=999999;
    raise exception 'FAIL: direct leaderboard writes allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform 1 from public.players where id=b;
    if found then raise exception 'FAIL: other private row visible'; end if;
  end;
  execute 'reset role';
  if not exists(select 1 from public.leaderboard where player_id=a and level=coalesce(before_level,1)+1)
  then raise exception 'FAIL: trigger did not sync leaderboard'; end if;
end $test$;
rollback;