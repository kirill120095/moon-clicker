const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('player reset rebuilds entire state without keeping prestige or max level',()=>{
 const edge=read('supabase/functions/game-actions/index.ts');
 const reset=edge.slice(edge.indexOf("if(body.action==='reset'){"),edge.indexOf("if(body.action==='spinWheel')trusted.wheelIndex"));
 assert.match(reset,/state=freshState\(/);
 assert.match(reset,/state\.resetId=body\.request_id/);
 assert.doesNotMatch(reset,/state\.prestige=prestige|state\.maxLevel=maxLevel|state\.runMaxLevel=runMaxLevel/);
});
test('reset dialog warns that permanent prestige and all stats are lost',()=>{
 const html=read('index.html');
 assert.match(html,/Все уровни, ресурсы, статистика, казино, достижения, престиж и вечные улучшения будут сброшены/);
 assert.doesNotMatch(html,/Вечный престиж и аккаунт сохранятся/);
});
