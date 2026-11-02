create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table public.leaderboard (
  player_id uuid primary key references public.players(id) on delete cascade,
  username text,
  level integer not null default 1,
  total_clicks integer not null default 0
);
alter table public.leaderboard enable row level security;
revoke all on table public.leaderboard from public, anon, authenticated;
grant select (username, level, total_clicks) on public.leaderboard to anon, authenticated;
create policy leaderboard_public_read on public.leaderboard for select to anon, authenticated using (true);
create index leaderboard_ranking_idx on public.leaderboard (level desc, total_clicks desc);

create function private.sync_leaderboard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.leaderboard(player_id, username, level, total_clicks)
  values(new.id, new.username, coalesce(new.level,1), coalesce(new.total_clicks,0))
  on conflict(player_id) do update set
    username=excluded.username, level=excluded.level, total_clicks=excluded.total_clicks;
  return new;
end;
$$;
revoke all on function private.sync_leaderboard() from public, anon, authenticated;
create trigger players_sync_leaderboard after insert or update of username, level, total_clicks
on public.players for each row execute function private.sync_leaderboard();
insert into public.leaderboard(player_id,username,level,total_clicks)
select id,username,coalesce(level,1),coalesce(total_clicks,0) from public.players;

drop policy "Allow anonymous select username and email" on public.players;
alter policy "Пользователи видят только себя" on public.players to authenticated using ((select auth.uid()) = id);
alter policy "Пользователи обновляют только себ" on public.players to authenticated
using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
alter policy "Пользователи вставляют только себ" on public.players to authenticated with check ((select auth.uid()) = id);
revoke all on table public.players from public, anon, authenticated;
grant select, insert, update on public.players to authenticated;
alter policy "Пользователи видят свои клики" on public.clicks to authenticated using ((select auth.uid()) = player_id);
alter policy "Пользователи вставляют свои клики" on public.clicks to authenticated with check ((select auth.uid()) = player_id);
revoke all on table public.clicks from public, anon, authenticated;
grant select, insert on public.clicks to authenticated;
notify pgrst, 'reload schema';