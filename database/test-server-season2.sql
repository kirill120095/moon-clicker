begin;
do $test$
declare uid uuid:=gen_random_uuid(); rid uuid:=gen_random_uuid(); r jsonb; s jsonb;
begin
 insert into auth.users(id,email) values(uid,'sql-season-test-'||uid::text||'@example.invalid');
 s:=jsonb_build_object('currentLevel',1,'moonHP',1000,'clickCount',0,'totalSecondsPlayed',0,
 'playerData',jsonb_build_object('username','sql-'||uid::text,'shards',0,'click_damage',10,'click_damage_level',0));
 r:=public.game_commit(uid,rid,0,s,jsonb_build_object('state',s));
 if (select revision from private.game_saves where user_id=uid)<>1 then raise exception 'Initial revision failed';end if;
 r:=public.game_commit(uid,rid,0,s,jsonb_build_object('state',s));
 if (select revision from private.game_saves where user_id=uid)<>1 then raise exception 'Duplicate committed twice';end if;
 begin
  perform public.game_commit(uid,gen_random_uuid(),99,s,'{}'::jsonb);
  raise exception 'Stale revision accepted';
 exception when serialization_failure then null; end;
 perform set_config('request.jwt.claim.sub',uid::text,true);
 execute 'set local role authenticated';
 begin
  update public.players set shards=999999 where id=uid;
  raise exception 'Direct currency update allowed';
 exception when insufficient_privilege then null; end;
 begin
  perform public.game_commit(uid,gen_random_uuid(),1,s,'{}'::jsonb);
  raise exception 'Client commit RPC allowed';
 exception when insufficient_privilege then null; end;
 execute 'reset role';
end $test$;
rollback;