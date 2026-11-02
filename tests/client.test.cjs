const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
test('slow connections coalesce clicks instead of building an unbounded request queue',()=>{
 let calls=0;const context={CONSTANTS:{CLICK_BURST:12},gameEngine:{destroy(){}},db:{action(){calls++;return new Promise(()=>{});}},document:{getElementById(){return null;}},state:{},appState:{},animations:{},audio:{},showToast(){},setTimeout(){return 1;},clearTimeout(){},clearInterval(){},performance:{now:()=>10000},console};
 vm.createContext(context);const source=fs.readFileSync(path.join(__dirname,'../src/modules/game/secure-game.js'),'utf8').replace(/^import\s[\s\S]*?from\s+['"][^'"]+['"];?\s*/gm,'');vm.runInContext(source,context);
 vm.runInContext('active=true;pendingClicks=4;flush();pendingClicks=6;flush();flush();',context);assert.equal(calls,1);
});
