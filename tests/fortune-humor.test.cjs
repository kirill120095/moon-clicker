const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../src/modules/ui/moon-wheel-v2.js'),'utf8');
test('the roulette animation does not reveal the outcome until it lands',()=>{
 const lines=source.match(/export const WHEEL_DARK_HUMOR_LINES = Object\.freeze\(\[([\s\S]*?)\]\);/);
 assert.ok(lines,'missing phrase pool');
 assert.equal((lines[1].match(/^  "|^"/gm)||[]).length,18,'17 original phrases plus new special phrase');
 assert.match(source,/"Смерть в нищете"/);
 assert.match(source,/const totalWeight=WHEEL_DARK_HUMOR_LINES\.length\+3/);
 assert.match(source,/export function randomWheelHeadline\(random=Math\.random\(\)\)/);
 assert.ok(source.indexOf('await this.track(this.rotor.animate')<source.indexOf('this.root.dataset.outcome=result.sector'));
 assert.match(source,/indicator\.textContent='ВЫПАЛО: '\+outcomeLabel/);
});
