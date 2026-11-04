import {gameEngine} from '/src/modules/game/game.js';
import {state} from '/src/core/state.js';
const status=document.getElementById('benchStatus'),button=document.getElementById('benchStart');
const stats={},frames=[],memory=[];let mutations=0,nodesPeak=0,raf=0,running=false;
for(const name of ['_calculateAllBonuses','_getActiveBuffs','recalcMoonBonuses']){
 const fn=gameEngine[name];gameEngine[name]=function(...args){const t=performance.now();try{return fn.apply(this,args);}finally{const s=stats[name]||(stats[name]={calls:0,ms:0});s.calls++;s.ms+=performance.now()-t;}};
}
async function run(){
 if(running||!gameEngine._isRunning)return;running=true;button.disabled=true;
 for(const key of Object.keys(stats))delete stats[key];frames.length=0;memory.length=0;mutations=0;window.__perfRequests=0;
 const observer=new MutationObserver(records=>{mutations+=records.filter(r=>!r.target.closest?.('#benchTools')).length;});observer.observe(document.body,{childList:true,subtree:true,attributes:true,characterData:true});
 const long=[];let po;try{po=new PerformanceObserver(list=>long.push(...list.getEntries().map(e=>e.duration)));po.observe({type:'longtask'});}catch{}
 let last=performance.now();const frame=now=>{if(!running)return;frames.push(now-last);last=now;raf=requestAnimationFrame(frame);};raf=requestAnimationFrame(frame);
 const started=performance.now();let phase=-1;
 const sample=setInterval(()=>{nodesPeak=Math.max(nodesPeak,document.querySelectorAll('*').length);if(performance.memory)memory.push(performance.memory.usedJSHeapSize);},1000);
 const clicks=setInterval(()=>{const r=document.getElementById('moonWrapper').getBoundingClientRect();gameEngine.handleClick({clientX:r.x+r.width/2,clientY:r.y+r.height/2});},56);
 const stages=setInterval(()=>{const elapsed=performance.now()-started,next=Math.floor(elapsed/15000);status.textContent='Stress test '+Math.min(45,Math.floor(elapsed/1000))+' / 45 s';
  if(next!==phase){phase=next;window.closeAllPanels();if(next===1){window.togglePanel('shopPanel');window.switchShopTab('moons');}if(next===2){window.togglePanel('profilePanel');window.switchProfileTab('profile');}}
 },250);
 await new Promise(r=>setTimeout(r,45000));running=false;cancelAnimationFrame(raf);clearInterval(sample);clearInterval(clicks);clearInterval(stages);observer.disconnect();po?.disconnect();
 const sorted=[...frames].sort((a,b)=>a-b),heapLast=memory.slice(-5),heapFirst=memory.slice(0,5);
 const result={build:document.documentElement.dataset.build,durationMs:performance.now()-started,frames:frames.length,frameP95Ms:sorted[Math.floor(sorted.length*.95)]||0,framesOver34ms:frames.filter(v=>v>34).length,longTasks:long.length,longTaskTotalMs:long.reduce((a,b)=>a+b,0),heapPeakBytes:memory.length?Math.max(...memory):null,heapStartMean:heapFirst.reduce((a,b)=>a+b,0)/(heapFirst.length||1),heapEndMean:heapLast.reduce((a,b)=>a+b,0)/(heapLast.length||1),domPeak:nodesPeak,domEnd:document.querySelectorAll('*').length,mutations,requests:window.__perfRequests,methods:stats,quality:document.documentElement.classList.contains('low-power')?'low':'full',gpuTiming:'not exposed by page',deviceMemory:navigator.deviceMemory||null};
 status.textContent=JSON.stringify(result,null,2);await fetch('/result',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(result)});button.disabled=false;
}
button.addEventListener('click',run);
if(new URLSearchParams(location.search).has('auto')){const ready=setInterval(()=>{if(gameEngine._isRunning){clearInterval(ready);setTimeout(run,1500);}},100);}
