// Isolated preview of the REAL index + client modules. Never contacts Supabase.
// node tools/slots/preview.cjs -> http://127.0.0.1:8766
// node tools/slots/preview.cjs --output /path/preview.html -> portable self-contained HTML
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const http = require('node:http');
const root = path.resolve(__dirname, '../..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const strip = s => s.replace(/^import\s[\s\S]*?from\s+['"][^'"]+['"];?\s*/gm, '').replace(/\bexport\s+/g, '');
const c = { structuredClone, console, Date, Math };
vm.createContext(c);
vm.runInContext(['constants.js', 'config.js', 'rules.js'].map(p => strip(read('supabase/functions/game-actions/' + p))).join('\n'), c);
const fixture = vm.runInContext("var f=freshState('SlotsPreview');f.playerData.shards=4321;applyAction(f,'load',{},Date.now());", c);

const mockNetwork = `
const FIXTURE=${JSON.stringify(fixture)};
const KEY='moon-slots-preview-game-v1';
const user={id:'00000000-0000-4000-8000-000000000001',user_metadata:{username:'SlotsPreview'}};
let loaded=structuredClone(FIXTURE),revision=0;
try{const saved=JSON.parse(localStorage.getItem(KEY));if(saved?.playerData&&saved?.ownedMoons)loaded=saved;}catch{}
function save(){try{localStorage.setItem(KEY,JSON.stringify(loaded));}catch{}}
save();
const client={rpc:async()=>({data:false}),from:()=>({select:()=>({order:()=>({limit:async()=>({data:[]})})})})};
export const initSupabase=async()=>client;
export const handleDatabaseError=e=>e.message;
export const db={
 getSession:async()=>({session:{user}}),
 action:async(action,payload={})=>{
  window.__previewActions=(window.__previewActions||[]);window.__previewActions.push(action);
  if(window.__previewActions.length>100)window.__previewActions.shift();
  if(action!=='load'&&action!=='sync'&&action!=='click')throw Error('Изолированное превью: серверные покупки и колесо здесь отключены. Слоты работают на демо-фишках.');
  if(action==='click'){loaded.clickCount+=payload.count||1;loaded.playerData.shards+=payload.count||1;save();}
  return {state:structuredClone(loaded),serverNow:Date.now(),revision:++revision};
 },
 getLeaderboard:async()=>[],getPlayer:async()=>({}),getLeaders:async()=>[],signOut:async()=>{}
};`;
function walk(dir) {
  return fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? walk(dir + '/' + e.name) : e.name.endsWith('.js') ? [dir + '/' + e.name] : []);
}
const imports = {};
for (const file of walk('src')) {
  let source = file === 'src/modules/network/supabase.js' ? mockNetwork
    : file === 'src/modules/ui/radio.js' ? 'export const radio={connect:async()=>{},disconnect(){}};' : read(file);
  // Resolve actual module specifiers (also safeImport's literal path arguments).
  source = source.replace(/(['"])(\.\.?\/[^'"\n]+\.js)(\?[^'"\n]*)?\1/g,
    (_, quote, relative) => quote + 'moon-preview/' + path.posix.normalize(path.posix.join(path.posix.dirname(file), relative)) + quote);
  imports['moon-preview/' + file] = 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
}
let html = read('index.html')
  .replace(/<script type="importmap">[\s\S]*?<\/script>/, '')
  .replace(/<script[^>]*src="[^"]+"[^>]*><\/script>/g, '')
  .replace(/<link[^>]*href="https:[^>]*>/g, '')
  .replace(/<link rel="stylesheet" href="([^?]+)(?:\?[^"]*)?">/g, (_, file) => '<style>\n' + read(file) + '\n</style>')
  .replace(/<title>.*?<\/title>/, '<title>Moon Clicker · Фортуна · изолированный прототип</title>')
  .replace('</head>', `<meta http-equiv="Content-Security-Policy" content="default-src 'self' data: blob:; script-src 'unsafe-inline' data:; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'; font-src 'none'">
<style>.slots-preview-label{position:fixed;top:0;left:0;width:100%;height:40px;z-index:9999;padding:4px 12px;display:grid;place-items:center;text-align:center;background:#19334b;color:#d5f4ff;font:10px/1.5 sans-serif;pointer-events:none}.panel{top:40px!important;height:calc(100dvh - 40px)!important}.mission-header{top:55px!important}.audio-dock{top:55px!important}</style></head>`)
  .replace('</body>', `<div class="slots-preview-label">ИЗОЛИРОВАННЫЙ ПРОТОТИП · без аккаунта и сервера · основная игра на сайте не изменена</div>
<script type="importmap">${JSON.stringify({ imports }).replace(/</g, '\\u003c')}</script>
<script type="module">
import 'moon-preview/src/index.js';
const show=()=>{if(!document.querySelector('.demo-slots'))return false;window.togglePanel('shopPanel');window.switchShopTab('fortune');for(const control of document.querySelectorAll('.fortune-form input,.fortune-form button'))control.disabled=true;document.querySelector('.fortune-odds').textContent='Существующее серверное колесо сохранено. В этом изолированном превью оно отключено; попробуй демо-слоты выше.';return true;};
if(!show()){const observer=new MutationObserver(()=>{if(show())observer.disconnect();});observer.observe(document.body,{childList:true,subtree:true});setTimeout(()=>observer.disconnect(),15000);}
</script><script>window.__previewHTML=document.documentElement.outerHTML;</script></body>`);
const outputIndex = process.argv.indexOf('--output');
if (outputIndex !== -1) {
  const output = path.resolve(process.argv[outputIndex + 1]);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, html);
  console.log('Built isolated preview: ' + output);
} else {
  http.createServer((req, res) => {
    if (req.url !== '/' && req.url !== '/index.html') { res.writeHead(404); res.end(); return; }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(html);
  }).listen(8766, '127.0.0.1', () => console.log('Isolated slots preview: http://127.0.0.1:8766/ (no Supabase, no real accounts)'));
}
