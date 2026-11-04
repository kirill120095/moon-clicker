// One small lazily generated repeating texture; at most two quality variants.
const tiles=new Map();
export function renderStarfield(container,count=300){
 if(!container)return;
 const low=document.documentElement.classList.contains('low-power'),size=low?128:256,density=Math.min(low?12:40,Math.max(1,Math.round(count/8))),key=size+':'+density;
 let url=tiles.get(key);
 if(!url){
  const canvas=document.createElement('canvas');canvas.width=size;canvas.height=size;
  const ctx=canvas.getContext('2d');if(!ctx)return;
  for(let i=0;i<density;i++){const x=(i*73.31)%size,y=(i*121.73)%size,r=i%7===0?1:.55;ctx.fillStyle='rgba(220,235,255,'+(i%3===0?.65:.28)+')';ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
  url=canvas.toDataURL('image/png');if(tiles.size>=2)tiles.delete(tiles.keys().next().value);tiles.set(key,url);
 }
 container.replaceChildren();container.style.backgroundImage='url("'+url+'")';container.style.backgroundRepeat='repeat';container.style.backgroundSize=size+'px '+size+'px';
}
export function starfieldCacheSize(){return tiles.size;}
