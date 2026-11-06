const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../src/modules/ui/renderer.js'),'utf8');
test('profile DOM is reused when only combat or casino values change',()=>{
 assert.match(src,/profileContent\.dataset\.structureKey===structureKey/);
 assert.match(src,/updateLiveCombatProfile\(\);\s*return;/);
 const signature=src.slice(src.indexOf('const structureKey=JSON.stringify'),src.indexOf('if(profileContent.dataset.structureKey===structureKey'));
 assert.doesNotMatch(signature,/wheelEconomy|totalSecondsPlayed|shards|critDamage|finalDamage|clickCount/);
});
test('critical multiplier is shown as × consistently on first and subsequent renders',()=>{
 assert.match(src,/finalCritMultiplier=.*toLocaleString/);
 assert.match(src,/\$\{finalCritMultiplier\}×/);
 assert.doesNotMatch(src,/finalCritDamage\}%/);
 assert.match(src,/critDamage:formatNumber\(s\.critDamage\).*×/);
});
test('casino, shards, time and boss kills update without replacing cards',()=>{
 for(const field of ['casinoLost','casinoWon','shards','playTime','bossKills','slots'])assert.match(src,new RegExp('data-live-stat="'+field+'"'));
 assert.match(src,/const values=\{bossKills:/);
});
