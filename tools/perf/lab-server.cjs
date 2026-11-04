// Local-only renderer benchmark. No Supabase access or real accounts.
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),vm=require('node:vm'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),refIndex=process.argv.indexOf('--ref'),ref=refIndex<0?null:process.argv[refIndex+1];
if(ref&&!/^[0-9a-f]{40}$/i.test(ref))throw Error('--ref must be a full commit SHA');
const read=p=>ref?execFileSync('git',['show',ref+':'+p],{cwd:root,encoding:'utf8'}):fs.readFileSync(path.join(root,p),'utf8');
const strip=s=>s.replace(/^import\s[\s\S]*?from\s+['"][^'"]+['"];?\s*/gm,'').replace(/\bexport\s+/g,'');
const logic=['constants.js','config.js','rules.js'].map(p=>strip(read('supabase/functions/game-actions/'+p))).join('\n'),context={structuredClone,console,Date,Math:Object.create(Math)};
vm.createContext(context);vm.runInContext(logic,context);
const fixture=vm.runInContext("var f=freshState('PerformanceLab');f.currentLevel=1000;f.maxLevel=1000;f.runMaxLevel=1000;f.playerData.shards=100000000;f.playerData.click_damage=200;f.playerData.click_damage_level=50;f.ownedMoons=Object.keys(MOON_TYPES);f.moonLevels=Object.fromEntries(f.ownedMoons.map(id=>[id,10]));f.activeMoons=['cosmic','fire','electric','clone'];f.activeMoon='clone';f.cloneTargets=['cosmic','fire'];f.maxSlots=4;f.ufoLevel=5;f.ufoCount=9;f.ufoComboRelay=true;f.moonKills=10000;f.prestige.upgrades={reactor:10,treasury:10,fleet:10,clock:10,echo:10,critical:30,archive:10,orbit:1};f.prestige.coins=1000;applyAction(f,'load',{},Date.now());",context);
const mockNetwork="import { fixture } from '/fixture.js';\nlet revision=0,loaded=structuredClone(fixture),lastUfo=0;\nconst client={rpc:async()=>({data:false}),from:()=>({select:()=>({order:()=>({limit:async()=>({data:[]})})})})};\nexport const initSupabase=async()=>client;\nexport const handleDatabaseError=e=>e.message;\nexport const db={\n getSession:async()=>({session:{user:{id:'00000000-0000-4000-8000-000000000001',user_metadata:{username:'PerformanceLab'}}}}),\n action:async(action,payload={})=>{\n  window.__perfRequests=(window.__perfRequests||0)+1;\n  await new Promise(r=>setTimeout(r,80));\n  const now=Date.now(),count=action==='click'?(payload.count||1):0;\n  loaded.clickCount+=count;loaded.runClickCount+=count;loaded.playerData.shards+=count*10;\n  loaded.runtime._fireStacks=(loaded.runtime._fireStacks||30)+count;\n  loaded.runtime._comboClicks=(loaded.runtime._comboClicks||0)+count;\n  loaded.lastClickAt=now;loaded.lastComboAt=now;loaded.lastAutoClickAt=now;\n  loaded.moonHP=loaded.maxHP*(.3+.7*(1-(loaded.clickCount%100)/100));\n  loaded.ufoNextShotAt=now+150;loaded.effects=Array.from({length:count},()=>({damage:loaded.finalDamage,isCrit:true,source:'manual'}));\n  if(now-lastUfo>250){lastUfo=now;loaded.effects.push(...Array.from({length:4},(_,i)=>({damage:loaded.ufoDamage,isCrit:i%2===0,source:'ufo',ufoIndex:i})));} \n  return {state:structuredClone(loaded),serverNow:now,revision:++revision};\n },\n getLeaderboard:async()=>[],getPlayer:async()=>({}),getLeaders:async()=>[],signOut:async()=>{}\n};";
const results=[];
const server=http.createServer(async(req,res)=>{
 const u=new URL(req.url,'http://localhost'),p=u.pathname.slice(1);
 if(p==='result'&&req.method==='POST'){let body='';for await(const chunk of req){body+=chunk;if(body.length>65536){res.writeHead(413);res.end();return;}}results.push(JSON.parse(body));if(results.length>10)results.shift();console.log(JSON.stringify(results.at(-1)));res.end('ok');return;}
 if(p==='logic-bundle'){res.setHeader('Content-Type','text/plain');res.end(logic);return;}
 if(p==='fixture.js'){res.setHeader('Content-Type','text/javascript');res.end('export const fixture='+JSON.stringify(fixture));return;}
 if(p==='bench.js'){res.setHeader('Content-Type','text/javascript');res.end(fs.readFileSync(path.join(__dirname,'stress-browser.js'),'utf8'));return;}
 let source;
 if(p==='src/modules/network/supabase.js')source=mockNetwork;
 else if(p==='src/modules/ui/radio.js')source='export const radio={connect:async()=>{},disconnect(){}};';
 else{
  const key=p||'index.html';if(!/^(?:src\/|css\/|index\.html$)/.test(key)||key.includes('..')||!/\.(?:js|css|html)$/.test(key)){res.writeHead(404);res.end();return;}
  try{source=read(key);}catch{res.writeHead(404);res.end();return;}
 }
 if(!p||p==='index.html'){
  source=source.replace('<html lang="ru">','<html lang="ru" data-build="'+(ref||'working-tree')+'">').replace('<title>Лунный Кликер</title>','<title>MoonPerf · virtual test funds</title>').replace(/<link[^>]*https:\/\/fonts[^>]*>/g,'').replace(/<script[^>]*src="https:[^>]*><\/script>/g,'')
   .replace('</body>','<aside id="benchTools" style="position:fixed;bottom:0;left:0;z-index:99999;background:#050a15ed;color:#fff;padding:8px;width:280px;font:11px monospace"><button id="benchStart">Start 45 s stress benchmark</button><pre id="benchStatus" style="max-height:150px;overflow:auto">Isolated test · no real accounts</pre></aside><script type="module" src="/bench.js"></script></body>');
  res.setHeader('Content-Type','text/html');
 }else res.setHeader('Content-Type',p.endsWith('.css')?'text/css':'text/javascript');
 res.setHeader('Cache-Control','no-store');res.end(source);
});
server.listen(8765,'127.0.0.1',()=>console.log('Local test lab: http://127.0.0.1:8765/ (virtual funds only)'));
module.exports={server,results};
