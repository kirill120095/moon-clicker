const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('received SVG is used once with ten symbols and15 cells, not emoji/art reinvention',async()=>{
 const runtime=await import('../src/modules/ui/lunar-temple-runtime.mjs');
 const {FORTUNE_SLOTS_HTML:html}=await import('../src/modules/ui/fortune-slots-template.js');
 assert.equal((html.match(/data-lt-cell data-col=/g)||[]).length,15);assert.equal((html.match(/<symbol id="lt-icon-/g)||[]).length,10);assert.equal((html.match(/data-lunar-temple /g)||[]).length,1);
 assert.ok(html.includes(runtime.LUNAR_SVG));assert.ok(html.includes(runtime.LUNAR_ARCHITECTURE));assert.match(html,/data-mt-bag-panel/);assert.match(html,/data-mt-reset-dialog/);
});
test('presentation has no wallet/RNG/network and reveal keeps2500ms including reduced mode',()=>{
 const runtime=read('src/modules/ui/lunar-temple-runtime.mjs'),view=read('src/modules/ui/fortune-slots-view.js');
 assert.doesNotMatch(runtime,/Math\.random|localStorage|\bfetch\s*\(|TempleWallet/);
 assert.match(runtime,/delay\(c===0\?1300:300,token\)/);assert.doesNotMatch(runtime,/paint\(settled\)/);
 assert.match(runtime,/reduce\(\(n,item\)=>n\+item\.quantity,0\)/);assert.match(runtime,/s\.lineWins\[index%s\.lineWins\.length\]/);
 assert.match(view,/get destroyed\(\)/);assert.match(read('src/modules/ui/slots.js'),/this\.view\?\.destroyed/);
});
test('wide layout is opt-in only and live/demo labels are separate',()=>{
 const runtime=read('src/modules/ui/lunar-temple-runtime.mjs'),controller=read('src/modules/ui/slots.js');
 assert.match(read('src/modules/game/temple-config.js'),/TEMPLE_DEFAULT_DEMO = false/);
 assert.match(runtime,/#shopPanel\.lt-fortune-wide/);assert.match(controller,/this\.setWide\(true\)/);assert.match(controller,/this\.setWide\(false\)/);
 assert.match(runtime,/s\.mode==='live'\?'ОСКОЛКИ':'ТЕСТОВЫЕ ФИШКИ'/);
 assert.doesNotMatch(read('css/slots.css'),/\.fortune-|\.panel\s*\{/);
});
