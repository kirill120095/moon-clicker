const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('auto-click shares normal keyboard click handler and audio',()=>{const s=read('src/modules/game/secure-game.js');const step=s.slice(s.indexOf('function autoClickStep(){'),s.indexOf('gameEngine.activateAutoClick='));assert.match(step,/gameEngine\.handleClick/);assert.match(s,/audio\.click\(\)/);assert.doesNotMatch(step,/dispatchEvent|MouseEvent|KeyboardEvent/);});
test('automatic clicks poll fast enough to reach the game rate cap while batching server requests',()=>{const s=read('src/modules/game/secure-game.js');const interval=Number(s.match(/setInterval\(autoClickStep,(\d+)\)/)?.[1]);assert.ok(interval>0&&interval<=1000/18+1);assert.match(s,/AUTO_CLICK_BATCH_MS=300/);assert.match(s,/if\(!clickFlight&&!flushTimer\)/);});
test('damage popup positions spread across multiple lanes and stay inside viewport',()=>{const s=read('src/modules/ui/animations.js');assert.match(s,/this\._damageSequence\+\+/);assert.match(s,/Math\.cos\(angle\)\*radius/);assert.match(s,/Math\.sin\(angle\)\*radius/);assert.match(s,/Math\.max\(42,Math\.min\(viewWidth-42/);});
test('moon reward replaces the previous label below the moon and expires',()=>{
 const source=read('src/modules/ui/animations.js'),css=read('css/neon.css');
 assert.match(source,/this\._moonRewardPopup\?\.remove\(\)/);
 assert.match(source,/label\.style\.top=\(rect\.bottom\+8\)/);
 assert.match(source,/this\._moonRewardTimer=setTimeout/);
 assert.match(css,/\.moon-reward-popup\{[^}]*position:fixed/);
});
test('game and animation modules have cache-busting import URLs',()=>{const s=read('index.html');assert.match(s,/secure-game\.js\?v=[\w-]+"/);assert.match(s,/animations\.js\?v=[\w-]+"/);});

test('auto-click damage popups are paced and queue size bounded',()=>{const s=read('src/modules/game/secure-game.js');assert.match(s,/MAX_DAMAGE_VISUAL_QUEUE=12/);assert.match(s,/damageVisualTimer=setInterval/);assert.match(s,/damageVisualQueue\.shift\(\)/);assert.match(s,/queueDamageVisual\(/);assert.match(s,/clearDamageVisuals\(\)/);});
