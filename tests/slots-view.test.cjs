const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
const view=read('src/modules/ui/fortune-slots-view.js'),controller=read('src/modules/ui/slots.js'),css=read('css/slots.css');

test('presentation adapter owns no RNG, wallet, storage or network and cannot settle rewards',()=>{
 assert.doesNotMatch(view,/\bimport\b|\bMath\.random\b|\blocalStorage\b|\bfetch\s*\(|\bdb\.|\bstate\.|\bDemoSlotBalance\b/);
 for(const hook of ['render(snapshot)','begin(snapshot)','reveal(snapshot)','setPaytable(values','cancel()','destroy()'])assert.ok(view.includes(hook),hook);
 assert.doesNotMatch(view,/settled\s*=|paint\(settled\)/);
 assert.match(controller,/this\.view\.cancel\(\);[\s\S]*this\.renderCurrent\(\)/);
});

test('view fragment renders exactly seven visual positions and controller replaces old UI',()=>{
 const raw=read('src/modules/ui/fortune-slots-template.js');
 const html=JSON.parse(raw.match(/export const FORTUNE_SLOTS_HTML = ([\s\S]+);\n$/)[1]);
 assert.equal((html.match(/data-mc-reel /g)||[]).length,7);
 assert.equal((html.match(/data-mc-slots /g)||[]).length,1);
 assert.doesNotMatch(html,/demo-slots|onclick|<script|<iframe/);
 assert.ok(html.includes('data-mc-storage'));assert.match(controller,/parent\.prepend\(this\.root\)/);
 assert.match(controller,/id: String\(id\), icon: symbol\.icon, label: symbol\.name/);
});

test('new styles remain scoped and distinguish group B by more than colour',()=>{
 assert.doesNotMatch(css,/\.fortune-|#shopPanel|#fortuneTabContent|\.panel\s*\{|^body\s*\{|^button\s*\{/m);
 assert.match(css,/data-group="2"[\s\S]*border-style: dashed/);
 assert.match(css,/@media \(prefers-reduced-motion: reduce\)/);
 assert.match(css,/@container mc-slots \(max-width: 260px\)/);
 assert.match(view,/index === 0 \? 'А' : 'Б'/);
 assert.match(view,/cell\.dataset\.group = String\(index \+ 1\)/);
});
