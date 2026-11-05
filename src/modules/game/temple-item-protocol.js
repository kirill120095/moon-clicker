import { TEMPLE_PAYLINES, TEMPLE_STAKES, validateTempleGrid, templeLineCandidates } from './temple-rules.js';

// Contract proposal for Contour's future server adapter. NOT a deployed endpoint.
export const TEMPLE_PROTOCOL_VERSION = 1;
export const TEMPLE_ACCOUNT_RELEASE = Object.freeze({
  enabled:false, ownerAuthUserId:null, projectRef:null, rulesVersion:null, rewardMappingVersion:null, registeredItemDefinitionIds:null
});
const uuid = value => typeof value==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const integer = value => Number.isSafeInteger(value) && value >= 0;
const text = value => typeof value==='string' && value.length>0 && value.length<=128;
const emptyBonus = () => ({remaining:0,triggerStake:null});

export function templeReleaseBlockReason(release, binding, transport) {
  if (release?.enabled !== true) return 'RELEASE_DISABLED';
  if (!uuid(release.ownerAuthUserId)) return 'VERIFIED_AUTH_UUID_REQUIRED';
  if (!text(release.projectRef) || !text(release.rulesVersion) || !text(release.rewardMappingVersion)) return 'VERIFIED_TARGET_AND_ITEM_MAPPING_REQUIRED';
  if (!Array.isArray(release.registeredItemDefinitionIds) || !release.registeredItemDefinitionIds.length || !release.registeredItemDefinitionIds.every(text) || release.registeredItemDefinitionIds.some(id=>['demo_relic','demo_lunar_relic'].includes(id))) return 'REGISTERED_ITEM_TYPES_REQUIRED';
  if (!binding || !uuid(binding.subjectId) || binding.subjectId !== release.ownerAuthUserId) return 'ACCOUNT_NOT_ALLOWED';
  if (binding.projectRef !== release.projectRef) return 'WRONG_PROJECT';
  if (typeof transport?.spin !== 'function') return 'SERVER_TRANSPORT_NOT_BOUND';
  return null;
}

export function buildTempleItemRequest(input) {
  const allowed=['requestId','mode','totalStake','expectedStateVersion','expectedInventoryVersion'];
  if (!input || Object.keys(input).some(key=>!allowed.includes(key))) throw Error('Request cannot contain client outcomes, identities or rewards');
  if (!uuid(input.requestId) || !['paid','free'].includes(input.mode) || !TEMPLE_STAKES.includes(input.totalStake) || !integer(input.expectedStateVersion) || !integer(input.expectedInventoryVersion)) throw Error('Invalid item-spin request');
  return Object.freeze({protocolVersion:1,type:'temple.spin',...input});
}

function validateItems(items, award, release) {
  if (!Array.isArray(items) || items.length>1000) throw Error('Invalid item list; paginate large inventories');
  const ids=new Set();
  return items.map(item=>{
    const key=award?'awardId':'instanceId';
    if (!item || !text(item[key]) || ids.has(item[key]) || !text(item.itemDefinitionId) || !Number.isSafeInteger(item.quantity) || item.quantity<1 || item.quantity>1_000_000) throw Error('Invalid or duplicate item receipt');
    if(['demo_relic','demo_lunar_relic'].includes(item.itemDefinitionId)||!release.registeredItemDefinitionIds?.includes(item.itemDefinitionId))throw Error('Test/null/unregistered item type is forbidden in live mode');
    if(item.level!==undefined&&(!Number.isSafeInteger(item.level)||item.level<1))throw Error('Invalid item level');
    ids.add(item[key]);
    if (item.displayName!==undefined && (typeof item.displayName!=='string'||item.displayName.length>100)) throw Error('Invalid item display name');
    // No invented effects, rarity, merging, ascension or asset URLs in this slice.
    return {[key]:item[key],itemDefinitionId:item.itemDefinitionId,quantity:item.quantity,...(item.level!==undefined?{level:item.level}:{}),...(item.displayName?{displayName:item.displayName}:{})};
  });
}
function validateBonus(bonus) {
  if (bonus===undefined) return emptyBonus();
  if (!bonus || !Number.isInteger(bonus.remaining) || bonus.remaining<0 || bonus.remaining>10 ||
      (bonus.remaining===0 ? bonus.triggerStake!==null : !TEMPLE_STAKES.includes(bonus.triggerStake))) throw Error('Invalid authoritative bonus state');
  return {...bonus};
}

export function validateTempleAccountState(raw, release) {
  if (!raw || raw.protocolVersion!==1 || raw.subjectId!==release.ownerAuthUserId || !uuid(raw.subjectId)) throw Error('Wrong protocol or account subject');
  if (!integer(raw.stateVersion)||!integer(raw.inventoryVersion)||!integer(raw.shardsBalance)) throw Error('Invalid authoritative versions or shards balance');
  if (raw.rulesVersion!==release.rulesVersion || raw.rewardMappingVersion!==release.rewardMappingVersion) throw Error('Unapproved rules/reward mapping version');
  return {protocolVersion:1,subjectId:raw.subjectId,stateVersion:raw.stateVersion,inventoryVersion:raw.inventoryVersion,
    shardsBalance:raw.shardsBalance,rulesVersion:raw.rulesVersion,rewardMappingVersion:raw.rewardMappingVersion,
    bonus:validateBonus(raw.bonus),inventoryItems:raw.inventoryItems===undefined?null:validateItems(raw.inventoryItems,false,release)};
}

export function validateTempleItemResponse(raw, request, release) {
  if (['gross','payout','creditedGross','net','shardsReward'].some(key=>Object.hasOwn(raw||{},key))) throw Error('Cash outcome is not an item reward response');
  const state=validateTempleAccountState(raw,release);
  if (raw.requestId!==request.requestId || raw.mode!==request.mode || raw.totalStake!==request.totalStake || raw.gridOrder!=='column-major') throw Error('Request/result mismatch or non-column-major grid');
  validateTempleGrid(raw.grid); // Strict five outer columns × three inner rows; no transpose.
  if (!integer(raw.shardsDebited) || raw.shardsDebited!==(request.mode==='free'?0:request.totalStake)) throw Error('Unexpected authoritative debit');
  if (!Array.isArray(raw.lineWins) || raw.lineWins.length>10) throw Error('Invalid line results');
  const used=new Set();
  const lineWins=raw.lineWins.map(line=>{
    if (!line || !Number.isInteger(line.lineId) || line.lineId<1 || line.lineId>10 || used.has(line.lineId) || ['gross','payout','multiplier'].some(key=>Object.hasOwn(line,key))) throw Error('Invalid duplicate/cash line result');
    used.add(line.lineId);const rows=TEMPLE_PAYLINES[line.lineId-1];
    const candidates=templeLineCandidates(rows.map((row,reel)=>raw.grid[reel][row]));
    if (!candidates.some(c=>c.symbol===line.symbol&&c.count===line.count)) throw Error('Line result does not match actual left-prefix/WILD grid');
    if (line.score!==undefined&&!integer(line.score)) throw Error('Invalid unitless line score');
    return {lineId:line.lineId,symbol:line.symbol,count:line.count,rows:[...rows],positions:rows.slice(0,line.count).map((row,reel)=>({reel,row})),...(line.score!==undefined?{score:line.score}:{})};
  });
  const awardedItems=validateItems(raw.awardedItems,true,release);
  if(state.stateVersion<=request.expectedStateVersion || state.inventoryVersion<request.expectedInventoryVersion ||
    (awardedItems.length>0 && state.inventoryVersion<=request.expectedInventoryVersion)) throw Error('Server versions did not advance atomically');
  return {...state,requestId:raw.requestId,mode:raw.mode,totalStake:raw.totalStake,shardsDebited:raw.shardsDebited,
    gridOrder:'column-major',grid:raw.grid.map(column=>[...column]),lineWins,awardedItems};
}
