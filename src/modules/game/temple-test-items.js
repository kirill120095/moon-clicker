import { TEMPLE_STAKES, TEMPLE_FREE_SPINS, createTempleGeometry, templeGridFromStops, scoreTempleGrid } from './temple-rules.js';
import { TEMPLE_CANDIDATE_GEOMETRY } from './temple-candidate-geometry.js';

// Separate local TEST inventory. Never reads account state, old demo money,
// credentials or network. The actual item mapping is injected, not invented here.
export const TEMPLE_TEST_ITEMS_KEY='moonclicker.lunarTempleItemsDemo.v1';
const emptyBonus=()=>({remaining:0,triggerStake:null});
const integer=n=>Number.isSafeInteger(n)&&n>=0;
const stackKey=item=>JSON.stringify([item.itemDefinitionId,item.level??1]);
const id=v=>typeof v==='string'&&v.length>0&&v.length<=128;
const validBonus=b=>b&&Number.isInteger(b.remaining)&&b.remaining>=0&&b.remaining<=10&&(b.remaining===0?b.triggerStake===null:TEMPLE_STAKES.includes(b.triggerStake));
function cloneItems(items){
 if(!Array.isArray(items)||items.length>10000)throw Error('Invalid test inventory');
 const seen=new Set();return items.map(item=>{
  if(!item||!id(item.itemDefinitionId)||seen.has(stackKey(item))||!Number.isSafeInteger(item.quantity)||item.quantity<1)throw Error('Invalid test inventory stack');
  const level=item.level??1;if(!Number.isInteger(level)||level<1||level>3)throw Error('Invalid test item level');
  seen.add(stackKey(item));
  if(item.displayName!==undefined&&(typeof item.displayName!=='string'||item.displayName.length>100))throw Error('Invalid test item name');
  return {instanceId:'test:'+item.itemDefinitionId+':L'+level,itemDefinitionId:item.itemDefinitionId,level,quantity:item.quantity,...(item.displayName?{displayName:item.displayName}:{})};
 });
}
export function validateTestItemMapping(mapping){
 if(mapping===null)return null;
 if(!mapping||!id(mapping.id)||typeof mapping.resolveItems!=='function'||!mapping.scoreTable||typeof mapping.scoreTable!=='object')throw Error('Inject a versioned candidate scoreTable + pure resolveItems adapter');
 return mapping;
}
export class TempleTestItems {
 constructor({geometry=TEMPLE_CANDIDATE_GEOMETRY,mapping=null,storage,rng=()=>Math.random(),fixtures={},allowFixtures=false}={}){
  this.kind='test-items';this.testMode=true;this.geometry=createTempleGeometry(geometry);this.mapping=validateTestItemMapping(mapping);
  this.storage=storage;this.persistent=Boolean(storage);this.rng=rng;this.fixtures=Object.freeze(Object.fromEntries(Object.entries(fixtures).map(([name,stops])=>[name,Object.freeze([...stops])])));this.allowFixtures=allowFixtures===true;
  this.readOnly=false;this.busy=false;this.balance=1000;this.stake=10;this.bonus=emptyBonus();this.inventoryItems=[];this.inventoryVersion=0;this.sequence=0;this.last=null;this.lastDrops=[];this.mappingChanged=false;this.lastError=null;
  this.reload();
 }
 get canSpin(){return Boolean(this.mapping)&&!this.busy&&!this.readOnly&&(this.bonus.remaining>0||this.balance>=this.stake);}
 get blockReason(){return this.readOnly?'UNSUPPORTED_TEST_SAVE':this.mapping?'': 'TEST_ITEM_MAPPING_PENDING';}
 reload(){
  if(!this.persistent)return;
  let raw;try{raw=this.storage.getItem(TEMPLE_TEST_ITEMS_KEY)}catch{this.persistent=false;return}
  if(raw===null){this.readOnly=false;return;}
  try{
   const s=JSON.parse(raw);
   if(s?.version!==1){this.readOnly=true;this.lastError='UNSUPPORTED_TEST_SAVE';return;}
   this.readOnly=false;
   if(!integer(s.balance)||!integer(s.inventoryVersion)||!integer(s.sequence))throw Error('Invalid test save');
   this.balance=s.balance;this.stake=TEMPLE_STAKES.includes(s.stake)?s.stake:10;this.inventoryItems=cloneItems(s.inventoryItems);this.inventoryVersion=s.inventoryVersion;this.sequence=s.sequence;
   this.bonus=emptyBonus();this.last=null;this.lastDrops=[];
   this.mappingChanged=s.geometryId!==this.geometry.id||s.mappingId!==(this.mapping?.id||null);
   if(this.mappingChanged||!this.mapping)return; // Preserve collection, never transform old rewards.
   if(validBonus(s.bonus))this.bonus={...s.bonus};
   if(s.last){
    const last=s.last,grid=templeGridFromStops(this.geometry,last.stops);
    if(!id(last.requestId)||last.sequence!==this.sequence||last.after!==this.balance||!TEMPLE_STAKES.includes(last.totalStake)||!['paid','free'].includes(last.mode)||last.debit!==(last.mode==='free'?0:last.totalStake)||last.before-last.debit!==last.after||!validBonus(last.bonusAfter)||JSON.stringify(last.bonusAfter)!==JSON.stringify(this.bonus))throw Error('Invalid test receipt');
    const awards=cloneItems(last.awardedItems).map((item,i)=>({...item,awardId:`test-award:${last.sequence}:${i}`,sourceLineIds:[...(last.awardedItems[i].sourceLineIds||[])]}));
    if(awards.some(a=>(this.inventoryItems.find(i=>stackKey(i)===stackKey(a))?.quantity||0)<a.quantity))throw Error('Receipt missing from test inventory');
    const scored=scoreTempleGrid(grid,this.mapping.scoreTable);
    const rewardedLineIds=[...new Set(awards.flatMap(a=>a.sourceLineIds))];
    if(rewardedLineIds.some(lineId=>!scored.lineWins.some(line=>line.lineId===lineId)))throw Error('Invalid receipt line');
    this.last={...last,...scored,grid,awardedItems:awards,rewardedLineIds};this.lastDrops=awards;
   }
  }catch{
   // Never overwrite unknown/corrupt data on a failed read.
   this.readOnly=true;this.lastError='UNSUPPORTED_TEST_SAVE';
  }
 }
 save(){
  if(!this.persistent||this.readOnly)return;
  try{this.storage.setItem(TEMPLE_TEST_ITEMS_KEY,JSON.stringify({version:1,geometryId:this.geometry.id,mappingId:this.mapping?.id||null,balance:this.balance,stake:this.stake,bonus:this.bonus,inventoryItems:this.inventoryItems,inventoryVersion:this.inventoryVersion,sequence:this.sequence,last:this.last}));}
  catch{this.persistent=false;}
 }
 setStake(stake){
  if(!TEMPLE_STAKES.includes(stake))throw Error('Unsupported test stake');
  if(this.busy||this.readOnly)return false;this.reload();if(this.readOnly)return false;if(this.bonus.remaining)return false;
  this.stake=stake;this.save();return true;
 }
 spin({mode,requestId,fixtureId}={}){
  if(this.busy)return null;this.busy=true;
  try{
   this.reload();if(this.readOnly)return null;this.lastError=null;
   if(!this.mapping){this.lastError='TEST_ITEM_MAPPING_PENDING';return null;}
   mode??=this.bonus.remaining?'free':'paid';
   if(!['paid','free'].includes(mode)||(mode==='free')!==(this.bonus.remaining>0)){this.lastError='WRONG_SPIN_MODE';return null;}
   if(requestId!==undefined&&!id(requestId))throw Error('Invalid test requestId');
   if(requestId&&requestId===this.last?.requestId){this.lastError='DUPLICATE_TEST_SPIN';return null;}
   const stake=mode==='free'?this.bonus.triggerStake:this.stake,debit=mode==='free'?0:stake;
   if(this.balance<debit){this.lastError='INSUFFICIENT_TEST_CHIPS';return null;}
   let stops,source={kind:'random'};
   if(fixtureId!==undefined){
    if(!this.allowFixtures||!Object.hasOwn(this.fixtures,fixtureId))throw Error('Explicit registered QA fixture required');
    stops=[...this.fixtures[fixtureId]];source={kind:'fixture',id:fixtureId};
   }else stops=this.geometry.reelStrips.map(strip=>{const u=this.rng();if(!Number.isFinite(u)||u<0||u>=1)throw Error('Invalid test RNG');return Math.floor(u*strip.length)});
   const grid=templeGridFromStops(this.geometry,stops),scored=scoreTempleGrid(grid,this.mapping.scoreTable);
   const sequence=this.sequence+1;if(!Number.isSafeInteger(sequence))throw Error('Test sequence exhausted');
   // Mapper returns item IDs and exact quantities only. No cash, effects or RNG here.
   const raw=this.mapping.resolveItems(structuredClone({...scored,totalStake:stake,mode}));
   if(!Array.isArray(raw)||raw.length>1000||(this.mapping.maxBatchesPerSpin!==undefined&&raw.length>this.mapping.maxBatchesPerSpin))throw Error('Item mapping must synchronously return an item array');
   const aggregate=new Map();
   for(const award of raw){
    if(!award||!id(award.itemDefinitionId)||!Number.isSafeInteger(award.quantity)||award.quantity<1||Object.keys(award).some(k=>!['itemDefinitionId','quantity','displayName','level','sourceLineId'].includes(k)))throw Error('Invalid test award; no cash/effect fields');
    if(award.sourceLineId!==undefined&&!scored.lineWins.some(line=>line.lineId===award.sourceLineId))throw Error('Award must refer to a matching line');
    const key=stackKey(award),old=aggregate.get(key),quantity=(old?.quantity||0)+award.quantity;
    if(!Number.isSafeInteger(quantity))throw Error('Test quantity overflow');
    aggregate.set(key,{...award,quantity,sourceLineIds:[...new Set([...(old?.sourceLineIds||[]),...(award.sourceLineId===undefined?[]:[award.sourceLineId])])]});
   }
   const entries=[...aggregate.values()];
   const awardedItems=cloneItems(entries).map((item,i)=>({...item,awardId:`test-award:${sequence}:${i}`,sourceLineIds:entries[i].sourceLineIds}));
   if(this.mapping.maxItemsPerSpin!==undefined&&awardedItems.reduce((n,item)=>n+item.quantity,0)>this.mapping.maxItemsPerSpin)throw Error('Test item cap exceeded');
   const rewardedLineIds=[...new Set(awardedItems.flatMap(item=>item.sourceLineIds))];
   const inventory=cloneItems(this.inventoryItems);
   for(const award of awardedItems){const item=inventory.find(i=>stackKey(i)===stackKey(award));if(item){const q=item.quantity+award.quantity;if(!Number.isSafeInteger(q))throw Error('Test inventory overflow');item.quantity=q;}else inventory.push({instanceId:award.instanceId,itemDefinitionId:award.itemDefinitionId,level:award.level,quantity:award.quantity,...(award.displayName?{displayName:award.displayName}:{})});}
   const scatterCount=grid.flat().filter(id=>id==='scatter').length;
   const awardedFree=mode==='paid'&&scatterCount>=3?TEMPLE_FREE_SPINS:0;
   const bonusBefore={...this.bonus},bonusAfter=mode==='free'?(this.bonus.remaining>1?{remaining:this.bonus.remaining-1,triggerStake:this.bonus.triggerStake}:emptyBonus()):awardedFree?{remaining:awardedFree,triggerStake:stake}:emptyBonus();
   const after=this.balance-debit,inventoryVersion=this.inventoryVersion+(awardedItems.length?1:0);
   const result={...scored,requestId:requestId||'test-spin-'+sequence,sequence,source,mode,totalStake:stake,debit,before:this.balance,after,stops:[...stops],bonusBefore,bonusAfter,freeSpinsAwarded:awardedFree,scatterCount,awardedItems,rewardedLineIds,inventoryVersion,mappingId:this.mapping.id,geometryId:this.geometry.id};
   // ONE atomic local save commits test debit, all items and free counter before animation.
   this.balance=after;this.inventoryItems=inventory;this.inventoryVersion=inventoryVersion;this.bonus=bonusAfter;this.sequence=sequence;this.last=result;this.lastDrops=awardedItems;this.mappingChanged=false;this.save();return structuredClone(result);
  }finally{this.busy=false;}
 }
 reset(){
  if(this.busy||this.readOnly)return false;this.balance=1000;this.stake=10;this.inventoryItems=[];this.inventoryVersion=0;this.sequence=0;this.bonus=emptyBonus();this.last=null;this.lastDrops=[];this.mappingChanged=false;this.lastError=null;this.save();return true;
 }
}
