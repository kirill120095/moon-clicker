const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const strip=source=>source.replace(/^import\s[\s\S]*?from\s+['"][^'"]+['"];?\s*/gm,'').replace(/\bexport\s+/g,'');

function setup(){
 const context={structuredClone,console,Date,Math:Object.create(Math)};
 vm.createContext(context);
 vm.runInContext(['constants.js','config.js','rules.js'].map(file=>strip(fs.readFileSync(path.join(__dirname,'../supabase/functions/game-actions',file),'utf8'))).join('\n'),context);
 return code=>vm.runInContext(code,context);
}

test('lunar dust grows with the defeated moon level and stays very slow at the start',()=>{
 const run=setup();
 for(const [level,gain] of [[1,.0001],[20,.0089],[100,.0952],[300,.4125],[1000,1.2251]]){
  run("var s=freshState();s.currentLevel="+level+";s.playerData.click_damage=1e15;s=applyAction(s,'click',{count:1},100000)");
  assert.equal(run('s.moonKills'),1);
  assert.equal(run('s.lunarLuck.progress'),gain);
  assert.equal(run('s.currentLevel'),level+1);
 }
});

test('twenty kills at level one retain fractional progress across requests',()=>{
 const run=setup();
 run("var s=freshState();s.levelLocked=true;s.playerData.click_damage=1e9;s=applyAction(s,'click',{count:18},100000);s=applyAction(s,'click',{count:2},100200)");
 assert.equal(run('s.moonKills'),20);
 assert.equal(run('s.lunarLuck.progress'),.002);
 assert.equal(run("applyAction(s,'load',{},100201).lunarLuck.progress"),.002);
});

test('existing dust, progress and claim count survive the formula change',()=>{
 const run=setup();
 run("var s=freshState();s.lunarLuck={progress:99.99,dust:5,fragments:10,claims:2,windowKills:10};s=applyAction(s,'load',{},100000)");
 assert.equal(run('s.lunarLuck.dust'),7);
 assert.equal(run('s.lunarLuck.progress'),99.99);
 assert.throws(()=>run("applyAction(s,'claimLunarLuck',{},100001)"),/не заполнена/);
 run("s.currentLevel=100;s.playerData.click_damage=1e9;s=applyAction(s,'click',{count:1},100001)");
 assert.equal(run('s.lunarLuck.progress'),100.0852);
 run("s=applyAction(s,'claimLunarLuck',{},100002)");
 assert.equal(run('s.lunarLuck.dust'),8);
 assert.equal(run('s.lunarLuck.progress'),.0852);
 assert.equal(run('s.inventory.items.length'),1);
});

test('dust keeps accumulating after the first reward and a claim pays all completed cycles',()=>{
 const run=setup();
 run("var s=freshState();s.currentLevel=100;s.levelLocked=true;s.playerData.click_damage=1e15;s.lunarLuck={progress:599.9,dust:5,claims:2};s=applyAction(s,'click',{count:2},100000);s=applyAction(s,'load',{},100001)");
 assert.equal(run('s.lunarLuck.progress'),600.0904);
 assert.equal(run('s.lunarLuck.dust'),5);
 run("s=applyAction(s,'claimLunarLuck',{},100002)");
 assert.equal(run('s.lunarLuck.dust'),11);
 assert.equal(run('s.lunarLuck.progress'),.0904);
 assert.equal(run('s.lunarLuck.claims'),8);
 assert.equal(run("s.inventory.items.map(item=>item.type).join(',')"),'moonstone,orbit');
 assert.throws(()=>run("applyAction(s,'claimLunarLuck',{},100003)"),/не заполнена/);
});
