# Season 2 balance review

Critical problems found in the previous version:

- The first damage purchase increased base damage from 10 to 110: an eleven-fold jump.
- Level 100 boss HP was approximately 5.1 billion, exceeding the old signed 32-bit moon_hp column.
- Cosmic moon cost 50 million shards while earlier progression could stall at bosses.

Changes:

- Damage upgrades add 20: the first upgrade is 10 to 30.
- Upgrade cost growth is 1.22 instead of 1.35.
- HP growth per level is 1.08 instead of 1.15; the first boss still has a 30-second timer.
- Progress counters use bigint. Current content is capped at level 200, where farming remains available.
- Moon costs: Blood 1,600; Ice 6,000; Shadow 18,000; Fire 50,000; Electric 140,000; Gold 400,000; Cosmic 1,500,000.
- Moon unlock requirements are enforced both in the shop and on the server.

A baseline simulation at five clicks per second, spending only on base damage, reached a boss wall around level 40. It deliberately omits farming, moon upgrades and synergies. The UI now explains rollback and level lock so players can earn upgrades before retrying a boss.

This is a calculated initial tuning, not a claim that every late-game build has been playtested. Combat has random critical hits, and moon combinations need continued playtesting.

Additional regression fixes: fire stacks now count stacks rather than capping raw clicks; the level-10 safety threshold uses stack units; guaranteed shadow first-strike critical hits remain guaranteed; background sync no longer keeps an idle combo alive.
