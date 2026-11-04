const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('first-stage view is explicitly a wireframe, not emoji artwork or accepted casino art',()=>{
 const html=read('src/modules/ui/fortune-slots-template.js'),css=read('css/slots.css');
 assert.match(html,/WIREFRAME/);assert.match(html,/НЕ ФИНАЛЬНЫЙ ДИЗАЙН/);assert.match(html,/data-mt-grid/);
 assert.doesNotMatch(html,/data-mc-reel|class="mc-slots"|class="demo-slots"/);
 assert.match(css,/repeat\(5,minmax\(0,1fr\)\)/);assert.match(css,/repeat\(3,1fr\)/);
});
test('matrix view owns no RNG, storage, reward settlement or primary-game state',()=>{
 const view=read('src/modules/ui/fortune-slots-view.js');
 assert.doesNotMatch(view,/Math\.random|localStorage|\bfetch\s*\(|\bdb\.|TempleWallet|\.spin\(/);
 for(const hook of ['render(snapshot)','begin(snapshot)','reveal(snapshot)','selectedFixture()','highlightLine(index)','cancel()','destroy()'])assert.ok(view.includes(hook));
 assert.match(view,/reel===0\?1300:300/);assert.match(view,/createElementNS/);
 assert.doesNotMatch(read('css/slots.css'),/\.fortune-|#shopPanel|#fortuneTabContent|\.panel\s*\{/);
});
test('default production configuration is pending, never synthetic fixture math',async()=>{
 const c=await import('../src/modules/game/temple-config.js');assert.equal(c.TEMPLE_CONFIG,null);assert.equal(c.TEMPLE_TEST_MODE,false);assert.deepEqual(c.TEMPLE_FIXTURES,{});
 assert.doesNotMatch(read('src/modules/game/temple-config.js'),/temple-fixtures\.js/);
});
