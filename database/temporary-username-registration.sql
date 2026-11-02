-- Temporary username-only signup. Execute once; keep the RPC server-only.
create table private.username_signup_limits (
 key_hash text primary key check (length(key_hash)=64),
 window_started timestamptz not null default now(),
 attempts integer not null default 1
);
alter table private.username_signup_limits enable row level security;
revoke all on private.username_signup_limits from public, anon, authenticated;
grant select, insert, update, delete on private.username_signup_limits to service_role;
create index username_signup_limits_window_idx on private.username_signup_limits(window_started);
create function public.username_signup_attempt(p_key_hash text) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare n integer;
begin
 if p_key_hash !~ '^[0-9a-f]{64}$' then return false; end if;
 delete from private.username_signup_limits where window_started < now()-interval '1 day';
 insert into private.username_signup_limits as limits(key_hash) values(p_key_hash)
 on conflict(key_hash) do update set
 attempts=case when limits.window_started < now()-interval '15 minutes' then 1 else limits.attempts+1 end,
 window_started=case when limits.window_started < now()-interval '15 minutes' then now() else limits.window_started end
 returning attempts into n;
 return n <= 10;
end; $$;
revoke all on function public.username_signup_attempt(text) from public, anon, authenticated;
grant execute on function public.username_signup_attempt(text) to service_role;