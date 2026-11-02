# Moon Clicker · Neon Orbit

Play: https://kirill120095.github.io/moon-clicker/

Vanilla JavaScript modules, GitHub Pages and Supabase. No bundler required.

## Season 2

The authenticated game-actions Edge Function calculates combat, prices, purchases, daily quests and achievements. Browser requests contain actions, never an authoritative balance. Progress and owned moons are stored in private.game_saves. The public players table is an owner-readable projection; leaderboard exposes only username, level and total_clicks.

The database rejects browser writes to progression. Commits use a revision check and request IDs to prevent double rewards and concurrent overwrites. Clicks use a server token bucket: 12 per second, burst 12. This blocks forged progression; it does not prove that a human made each click or eliminate bots operating within the allowed rate.

Audio uses Web Audio synthesis, starts after user interaction, and pauses in hidden tabs. Music and effects have separate device-local volume settings.

## Checks

    node --test tests/*.test.cjs

Database security checks in database/test-server-season2.sql run inside a transaction and roll back fixtures.

Backend source is in supabase/functions/game-actions. Browser and backend balance constants must remain identical; a regression test checks this.

## Deployment

main is published to GitHub Pages. backup/2026-11-02-before-season2 preserves the previous release. Deploy game-actions whenever its source or shared balance rules change. The HTML import map versions all browser modules together.
