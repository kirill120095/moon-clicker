import { TEMPLE_ORDINARY, TEMPLE_STAKES } from './temple-rules.js';

// GD candidate for the explicitly TEST-only slice. Never a live equipment ID.
export const DEMO_RELIC_ID = 'demo_lunar_relic';
export const DEMO_RELIC_NAME = 'Реликвия храма · ДЕМО';
export function bestTempleItemLine(lineWins) {
  if (!Array.isArray(lineWins)) throw Error('Line results required');
  return [...lineWins].sort((a,b) => b.count-a.count || a.lineId-b.lineId ||
    TEMPLE_ORDINARY.indexOf(a.symbol)-TEMPLE_ORDINARY.indexOf(b.symbol))[0] || null;
}
const levels = Object.freeze({3:1,4:2,5:3});
export const TEMPLE_DEMO_ITEM_MAPPING = Object.freeze({
  id:'comet-lunar-demo-best-line-v1', provisional:true, itemTypeId:null,
  demoItemTypeId:DEMO_RELIC_ID,maxBatchesPerSpin:1,maxItemsPerSpin:10,
  // Same ordinal scores for all ordinary symbols: WILD ranks by chain/level,
  // never by the legacy cash table. Five WILD select the first ordinary tie.
  scoreTable:Object.freeze(Object.fromEntries([
    ...TEMPLE_ORDINARY.map(id=>[id,levels]),['wild',Object.freeze({3:0,4:0,5:0})]
  ])),
  resolveItems({lineWins,totalStake}) {
    if (!TEMPLE_STAKES.includes(totalStake)) throw Error('Unsupported test stake');
    const best=bestTempleItemLine(lineWins);
    if (!best) return [];
    if (![3,4,5].includes(best.count)) throw Error('Unsupported item chain');
    return [{itemDefinitionId:DEMO_RELIC_ID,displayName:DEMO_RELIC_NAME,
      level:best.count-2,quantity:totalStake/10,sourceLineId:best.lineId}];
  }
});
