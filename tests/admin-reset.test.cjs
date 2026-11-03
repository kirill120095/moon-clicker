const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function setup(){
 const nodes={},store=new Map(),calls=[];let reloads=0,uuids=0,fail=false,admin=true;
 for(const id of ['gameAdminSettings','globalResetDialog','globalResetPhrase','globalResetError','globalResetTitle','globalResetMessage','globalResetPhraseRow','globalResetNext','globalResetCancel','resetAllProgressBtn']){
  const classes=new Set();nodes[id]={value:'',textContent:'',disabled:false,open:false,classList:{add:v=>classes.add(v),toggle(v,on){if(on)classes.add(v);else classes.delete(v);},contains:v=>classes.has(v)},addEventListener(){},focus(){},showModal(){this.open=true;},close(){this.open=false;}};
 }
 const client={rpc:async(name,args)=>{calls.push({name,args});if(name==='is_game_admin')return {data:admin};return fail?{error:Error('Network failed')}:{data:{players_reset:4}};}};
 const context={ownerMonitor:{connect(){},disconnect(){}},document:{getElementById:id=>nodes[id]},initSupabase:async()=>client,sessionStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},crypto:{randomUUID:()=> 'request-'+(++uuids)},window:{location:{reload(){reloads++;}}},console};
 vm.createContext(context);const source=fs.readFileSync(path.join(__dirname,'../src/modules/ui/admin.js'),'utf8').replace(/^import .*;$/gm,'').replace(/^export /gm,'');vm.runInContext(source,context);
 return {nodes,calls,store,run:code=>vm.runInContext(code,context),reloads:()=>reloads,setFail:v=>{fail=v;},setAdmin:v=>{admin=v;}};
}
test('global reset requires three separate stages and the exact typed confirmation',async()=>{
 const h=setup();await h.run("gameAdmin.connect({id:'owner'})");h.run('gameAdmin.open()');
 assert.equal(h.nodes.globalResetDialog.open,true);assert.match(h.nodes.globalResetTitle.textContent,/1 из 3/);
 await h.run('gameAdmin.advance()');assert.equal(h.nodes.globalResetNext.disabled,true);
 h.nodes.globalResetPhrase.value='сбросить весь прогресс';await h.run('gameAdmin.advance()');assert.equal(h.run('gameAdmin.step'),2);
 h.nodes.globalResetPhrase.value='СБРОСИТЬ ВЕСЬ ПРОГРЕСС';await h.run('gameAdmin.advance()');
 assert.equal(h.run('gameAdmin.step'),3);assert.equal(h.calls.filter(c=>c.name==='admin_reset_all_progress').length,0);
 await h.run('gameAdmin.advance()');assert.equal(h.calls.filter(c=>c.name==='admin_reset_all_progress').length,1);assert.equal(h.reloads(),1);
});
test('ordinary accounts cannot open or submit the admin dialog',async()=>{
 const h=setup();h.setAdmin(false);await h.run("gameAdmin.connect({id:'player'})");h.run('gameAdmin.open()');await h.run('gameAdmin.advance()');
 assert.equal(h.nodes.gameAdminSettings.classList.contains('hidden'),true);assert.equal(h.nodes.globalResetDialog.open,false);assert.equal(h.calls.filter(c=>c.name==='admin_reset_all_progress').length,0);
});
test('a network retry keeps the same request id so it cannot reset twice',async()=>{
 const h=setup();await h.run("gameAdmin.connect({id:'owner'})");h.run('gameAdmin.open()');await h.run('gameAdmin.advance()');h.nodes.globalResetPhrase.value='СБРОСИТЬ ВЕСЬ ПРОГРЕСС';await h.run('gameAdmin.advance()');
 h.setFail(true);await h.run('gameAdmin.advance()');assert.equal(h.reloads(),0);assert.equal(h.nodes.globalResetDialog.open,true);
 h.setFail(false);await h.run('gameAdmin.advance()');const calls=h.calls.filter(c=>c.name==='admin_reset_all_progress');assert.equal(calls.length,2);assert.equal(calls[0].args.p_request,calls[1].args.p_request);assert.equal(h.store.size,0);assert.equal(h.reloads(),1);
});
test('logout removes owner controls and closes the warning dialog',async()=>{
 const h=setup();await h.run("gameAdmin.connect({id:'owner'})");h.run('gameAdmin.open();gameAdmin.disconnect()');assert.equal(h.nodes.globalResetDialog.open,false);assert.equal(h.nodes.gameAdminSettings.classList.contains('hidden'),true);await h.run('gameAdmin.advance()');assert.equal(h.calls.filter(c=>c.name==='admin_reset_all_progress').length,0);
});
test('a stale role response cannot grant controls after logout',async()=>{
 const h=setup();await h.run("var checking=gameAdmin.connect({id:'owner'});gameAdmin.disconnect();checking");assert.equal(h.run('gameAdmin.allowed'),false);assert.equal(h.nodes.gameAdminSettings.classList.contains('hidden'),true);
});
