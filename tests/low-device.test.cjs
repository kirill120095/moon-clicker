const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const strip=s=>s.replace(/^import\s[\s\S]*?from\s+['"][^'"]+['"];?\s*/gm,'').replace(/\bexport\s+/g,'');
const source=p=>strip(fs.readFileSync(path.join(__dirname,'..',p),'utf8')).replace(/default \{/g,'const moduleDefault = {');
test('render queue coalesces repeated work by key and cancellation releases retained callbacks',()=>{
 const frames=[],cancelled=[],c={requestAnimationFrame:fn=>{frames.push(fn);return frames.length;},cancelAnimationFrame:id=>cancelled.push(id),console};vm.createContext(c);vm.runInContext(source('src/utils/performance.js'),c);
 vm.runInContext("var calls=0;for(var i=0;i<1000;i++)uiScheduler.schedule(()=>{calls++;},0,'hud');",c);
 assert.equal(vm.runInContext('uiScheduler._queue.length',c),1);frames.shift()();assert.equal(vm.runInContext('calls',c),1);assert.equal(vm.runInContext('uiScheduler._byKey.size',c),0);
 vm.runInContext("uiScheduler.schedule(()=>{},0,'hud');uiScheduler.cancel()",c);assert.equal(vm.runInContext('uiScheduler._queue.length+uiScheduler._byKey.size',c),0);assert.ok(cancelled.length);
});
test('automatic low-memory selection respects a manual quality choice',()=>{
 const c={};vm.createContext(c);vm.runInContext(source('src/utils/device-budget.js'),c);
 assert.equal(vm.runInContext("chooseLowPower('auto',1,8)",c),true);assert.equal(vm.runInContext("chooseLowPower('auto',8,2)",c),true);
 assert.equal(vm.runInContext("chooseLowPower('auto',8,8)",c),false);assert.equal(vm.runInContext("chooseLowPower('full',1,1)",c),false);assert.equal(vm.runInContext("chooseLowPower('low',8,8)",c),true);
});
test('star textures are lazy, small and bounded to two entries without animated DOM stars',()=>{
 let builds=0,low=false;const sizes=[],container={style:{},replaceChildren(){}};const c={document:{documentElement:{classList:{contains:()=>low}},createElement:()=>{const canvas={getContext:()=>({beginPath(){},arc(){},fill(){}}),toDataURL(){builds++;sizes.push(canvas.width);return 'data:image/png;base64,'+builds;}};return canvas;}}};vm.createContext(c);vm.runInContext(source('src/modules/ui/starfield.js'),c);
 assert.equal(builds,0);c.root=container;vm.runInContext('renderStarfield(null);renderStarfield(root,300);renderStarfield(root,300)',c);assert.equal(builds,1);assert.equal(sizes[0],256);
 low=true;vm.runInContext('renderStarfield(root,300)',c);assert.equal(sizes[1],128);for(let n=1;n<100;n++)vm.runInContext('renderStarfield(root,'+n+')',c);assert.ok(vm.runInContext('starfieldCacheSize()',c)<=2);
});
test('reduced device mode skips particle and UFO raster work',()=>{
 let nodes=0;const c={document:{hidden:false,documentElement:{classList:{contains:name=>name==='low-power'}},body:{classList:{contains:()=>false}},createElement:()=>{nodes++;}},performance:{now:()=>100},formatNumber:String};vm.createContext(c);vm.runInContext(source('src/modules/ui/animations.js'),c);
 vm.runInContext("animations.createParticles(null,{x:10,y:10,count:50});animations.createShockwave(10,10);animations.playUfoShot(0)",c);assert.equal(nodes,0);
});
test('effect updates preserve existing cards when counters or timers change',()=>{
 const fields={'.buff-bonus':{textContent:''},'.buff-stacks':{textContent:''},'.buff-timer':{textContent:'',classList:{toggle(){}}},'.buff-progress-bar':{style:{}}},card={classList:{toggle(){}},querySelector:s=>fields[s]};
 let paints=0;const root={childElementCount:1,classList:{add(){},remove(){},contains:()=>false},style:{},querySelector:()=>card,querySelectorAll:()=>[],set innerHTML(v){paints++;this.html=v;},get innerHTML(){return this.html||'';}};
 const buff={id:'fire',name:'Fire',icon:'F',bonus:'+1%',value:1,maxStacks:100,progress:1,progressMax:100,isActive:true,timeLeft:10};
 const c={window:{_activeBuffs:[buff]},document:{getElementById:()=>root},setTimeout(){},console,formatNumber:String};vm.createContext(c);vm.runInContext(source('src/modules/ui/renderer.js'),c);
 vm.runInContext('updateBuffsDisplay()',c);assert.equal(paints,1);buff.bonus='+2%';buff.value=2;buff.progress=2;buff.timeLeft=9;vm.runInContext('updateBuffsDisplay()',c);
 assert.equal(paints,1);assert.equal(fields['.buff-bonus'].textContent,'+2%');assert.equal(fields['.buff-stacks'].textContent,'2/100');assert.equal(fields['.buff-timer'].textContent,'9с');assert.equal(fields['.buff-progress-bar'].style.transform,'scaleX(0.02)');
});
