const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function setup(){
 const context={structuredClone,console,Date,Math:Object.create(Math)};
 vm.createContext(context);
 for(const file of ['constants.js','config.js','rules.js']){
  const source=fs.readFileSync(path.join(__dirname,'../supabase/functions/game-actions',file),'utf8');
  vm.runInContext(source.replace(/^import .*;$/gm,'').replace(/\bexport\s+/g,''),context);
 }
 return code=>vm.runInContext(code,context);
}

test('shop grants a real roll for three dust and preserves funds when inventory is full',()=>{
 const run=setup();
 assert.equal(run("Object.values(ITEM_TYPES).reduce((total,type)=>total+type.good.length,0)"),100);
 assert.equal(run("Object.values(ITEM_TYPES).reduce((total,type)=>total+type.bad.length,0)"),40);
 run("Math.random=()=>0;var s=freshState();s.lunarLuck.dust=3;s=applyAction(s,'buyMoonItem',{},100000);");
 assert.equal(run("s.lunarLuck.dust"),0);
 assert.equal(run("s.inventory.items[0].mods[0].star"),true);
 assert.equal(run("getItemProperties(s.inventory.items[0]).length"),3);
 assert.throws(()=>run("applyAction(s,'buyMoonItem',{},100001)"),/Недостаточно/);
 run("s.lunarLuck.dust=3;while(s.inventory.items.length<20)s.inventory.items.push(makeItem(s.inventory,'moonstone'));");
 assert.throws(()=>run("applyAction(s,'buyMoonItem',{},100002)"),/заполнен/);
 assert.equal(run("s.lunarLuck.dust"),3);
});

test('merge offer persists, transfers a donor star, and consumes only the selected donor',()=>{
 const run=setup();
 run("Math.random=()=>.5;var s=freshState();s.inventory.items=[{id:1,type:'orbit',rarity:1,mods:[{id:1,value:30}]},{id:2,type:'orbit',rarity:1,mods:[{id:5,value:100,star:true}]}];");
 assert.throws(()=>run("applyAction(s,'mergeItems',{id:1,otherId:2,choice:0},100000)"),/предложенных/);
 run("s=applyAction(s,'prepareItemMerge',{id:1,otherId:2},100001);var offer=JSON.stringify(s.inventory.items[0].mergeOffer);");
 assert.equal(run("s.inventory.items.length"),2);
 assert.equal(run("s.inventory.items[0].mergeOffer.choices[0].star"),true);
 assert.equal(run("JSON.stringify(applyAction(s,'prepareItemMerge',{id:1,otherId:2},100002).inventory.items[0].mergeOffer)===offer"),true);
 run("s=applyAction(s,'mergeItems',{id:1,otherId:2,choice:0},100003)");
 assert.equal(run("s.inventory.items.length"),1);
 assert.equal(run("s.inventory.items[0].rarity"),2);
 assert.equal(run("getItemProperties(s.inventory.items[0])[2].value"),150);
});

test('only equipped items on active moons modify actual damage and kill reward',()=>{
 const run=setup();
 run("Math.random=()=>.99;var s=freshState();s.levelLocked=true;s.moonHP=1;s.playerData.click_damage=100;s.inventory.items=[{id:1,type:'moonstone',rarity:1,penalty:{id:0,value:-40}}];s.equipment={normal:[{level:1,itemId:1}]};var boosted=applyAction(s,'click',{count:1},100000);s.equipment={};var base=applyAction(s,'click',{count:1},100000);");
 assert.equal(run("boosted.effects[0].damage"),Math.round(run("base.effects[0].damage")*1.6));
 assert.equal(run("boosted.effects[0].reward"),Math.round(run("base.effects[0].reward")*.6));
});

test('a level-five base accepts a level-one donor and masterworking applies only once',()=>{
 const run=setup();
 run("Math.random=()=>.4;var s=freshState();s.inventory.items=[{id:1,type:'moonstone',rarity:5,keep:true,mods:[{id:2,value:20}]},{id:2,type:'moonstone',rarity:1,mods:[{id:3,value:60}]}];");
 run("s=applyAction(s,'prepareItemMerge',{id:1,otherId:2},100000);s=applyAction(s,'mergeItems',{id:1,otherId:2,choice:0},100001);s=applyAction(s,'masterworkItem',{id:1,mod:3},100002);");
 assert.equal(run("s.inventory.items[0].rarity"),6);
 assert.equal(run("s.inventory.items[0].keep"),true);
 assert.equal(run("getItemProperties(s.inventory.items[0])[2].value"),75);
 assert.throws(()=>run("applyAction(s,'masterworkItem',{id:1,mod:2},100003)"),/обычный баф/);
});

test('boss-time affixes adjust the live timer only while equipped',()=>{
 const run=setup();
 run("Math.random=()=>.99;var s=freshState();s.currentLevel=10;s.bossDuration=30;s.bossDeadline=130000;s.inventory.items=[{id:1,type:'comet',rarity:1,mods:[{id:0,value:12}]}];s.equipment={normal:[{level:1,itemId:null}]};s=applyAction(s,'equipItem',{id:1,moonId:'normal',slotIndex:0},100000);");
 assert.equal(run('s.bossDeadline'),142000);
 run("s=applyAction(s,'unequipItem',{moonId:'normal',slotIndex:0},100001)");
 assert.equal(run('s.bossDeadline'),130000);
});
