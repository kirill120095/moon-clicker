const http=require('node:http'),fs=require('node:fs'),vm=require('node:vm'),v8=require('node:v8'),{performance}=require('node:perf_hooks');
const base=process.argv[2],output=process.argv[3];
if(!/^http:\/\/127\.0\.0\.1:\d+\/$/.test(base))throw Error('Local benchmark endpoint required');
http.get(base+'logic-bundle',res=>{let code='';res.on('data',chunk=>code+=chunk);res.on('end',()=>{
 const context={structuredClone,console,Date,Math:Object.create(Math)};vm.createContext(context);vm.runInContext(code,context);
 vm.runInContext("var s=freshState('LowMemoryLab');s.currentLevel=1000;s.runMaxLevel=1000;s.maxLevel=1000;s.ownedMoons=Object.keys(MOON_TYPES);s.moonLevels=Object.fromEntries(s.ownedMoons.map(id=>[id,10]));s.activeMoons=['cosmic','fire','electric','clone'];s.cloneTargets=['cosmic','fire'];s.maxSlots=4;s.ufoLevel=5;s.ufoCount=9;s.prestige.upgrades={reactor:10,echo:10,critical:30};",context);
 const samples=[],tick=new vm.Script("s=applyAction(s,'click',{count:18},now)");if(global.gc)global.gc();const heapBefore=v8.getHeapStatistics().used_heap_size,started=performance.now();
 for(let i=0;i<20000;i++){context.now=100000+i*1100;tick.runInContext(context);if(i%1000===0)samples.push({action:i,heapBytes:v8.getHeapStatistics().used_heap_size,rssBytes:process.memoryUsage().rss});}
 if(global.gc)global.gc();const result={actions:20000,heapBeforeBytes:heapBefore,heapAfterBytes:v8.getHeapStatistics().used_heap_size,countedClicks:vm.runInContext('s.clickCount',context),durationMs:performance.now()-started,heapLimitBytes:v8.getHeapStatistics().heap_size_limit,heapPeakBytes:Math.max(...samples.map(s=>s.heapBytes)),rssPeakBytes:Math.max(...samples.map(s=>s.rssBytes)),samples};
 fs.writeFileSync(output,JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 });}).on('error',error=>{console.error(error.message);process.exitCode=1;});
