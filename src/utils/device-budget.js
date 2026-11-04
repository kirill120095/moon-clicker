const KEY='moon_performance_mode';
export function chooseLowPower(mode,memory,cores){return mode==='low'||mode!=='full'&&((memory>0&&memory<=2)||(cores>0&&cores<=2));}
export function setPerformanceMode(mode='auto'){
 if(!['auto','full','low'].includes(mode))mode='auto';
 const low=chooseLowPower(mode,navigator.deviceMemory||0,navigator.hardwareConcurrency||0);
 document.documentElement.classList.toggle('low-power',low);
 const select=document.getElementById('performanceMode');if(select)select.value=mode;
 try{localStorage.setItem(KEY,mode);}catch{}
 window.dispatchEvent(new CustomEvent('moon-performance-change',{detail:{lowPower:low}}));
 return low;
}
export function installPerformanceMode(){
 let mode='auto';try{mode=localStorage.getItem(KEY)||mode;}catch{}
 setPerformanceMode(mode);
 document.getElementById('performanceMode')?.addEventListener('change',event=>setPerformanceMode(event.target.value));
}
