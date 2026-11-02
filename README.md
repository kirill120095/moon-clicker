# Moon Clicker

Browser game built with vanilla JavaScript modules and Supabase.

Play: https://kirill120095.github.io/moon-clicker/

## Checks

Run the regression checks with Node.js:

    node --test tests/stability.test.cjs

The checks use an in-memory game environment and do not access production Supabase.

## Data and deployment

GitHub Pages deploys the main branch. The backup/stable branch preserves the version before the stability fixes.

Supabase client setup is in src/modules/network/supabase.js. Only a publishable client key belongs in browser code.

Database schema and RLS policies must be inspected in the connected Supabase project before changing cloud save storage. Owned moons, moon levels, slots, quests and achievements still use browser storage; cross-device synchronization is pending that database migration.
