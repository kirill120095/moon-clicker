const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../src/modules/ui/wheel.js'),'utf8');
test('fortune wheel has varied dark humor only during spin',()=>{
 const lines=source.match(/export const WHEEL_DARK_HUMOR_LINES = Object\.freeze\(\[([\s\S]*?)\]\);/);
 assert.ok(lines,'missing phrase pool');
 assert.ok((lines[1].match(/^ '/gm)||[]).length>=12,'need variety');
 assert.match(source,/WHEEL_DARK_HUMOR_LINES\[Math\.floor\(Math\.random\(\)\*WHEEL_DARK_HUMOR_LINES\.length\)\]/);
 assert.match(source,/this\.message\('Судьба уже в движении…',WHEEL_DARK_HUMOR_LINES/);
 assert.match(source,/this\.message\(bankrupt\?'БАНКРОТСТВО'/,'results remain explicit');
});
