const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
test('global reset keeps every DELETE and UPDATE compatible with the API safeupdate guard',()=>{
 for(const file of ['admin-progress-reset.sql','fix-admin-reset-safeupdate.sql']){
  const sql=fs.readFileSync(path.join(__dirname,'../database',file),'utf8').replace(/--[^\n]*/g,'');
  const statements=[...sql.matchAll(/^\s*(?:delete\s+from|update)\b[\s\S]*?;/gmi)].map(m=>m[0]);
  assert.equal(statements.length,5,file);
  for(const statement of statements)assert.match(statement,/\bwhere\b/i,statement);
  assert.doesNotMatch(sql,/safeupdate\.enabled\s*(?:=|to)\s*['"]?(?:off|false|0)/i);
 }
});
