const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function setup(){
 const nodes=Object.fromEntries(['authEmail','authPassword','authError','loginBtn','registerBtn','authScreen','app'].map(id=>[id,{value:'',textContent:'',classList:{add(){},remove(){}}}]));
 const calls=[];const c={document:{getElementById:id=>nodes[id]},db:{register:async(username,password)=>{calls.push({username,password});return {user:{id:'regular',user_metadata:{username}}};},signInWithPassword:async(email,password)=>{calls.push({email,password});return {user:{id:'legacy',user_metadata:{username:'Legacy'}}};}},appState:{setUser(){}},state:{},gameAdmin:{connect:async()=>{}},recordDiagnostic(){},gameEngine:{init:async()=>{}},showToast(){},handleDatabaseError:e=>e.message,console:{log(){},error(){}}};
 vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/modules/auth/auth.js'),'utf8').replace(/^import .*;$/gm,'').replace(/^export /gm,''),c);return {nodes,calls,run:s=>vm.runInContext(s,c)};
}
test('email in registration explains game username before any network call',async()=>{
 const s=setup();s.nodes.authEmail.value='example_player@example.test';s.nodes.authPassword.value='a'.repeat(8);
 await s.run('handleRegister()');assert.equal(s.calls.length,0);assert.match(s.nodes.authError.textContent,/логин без @/);assert.match(s.nodes.authError.textContent,/старые аккаунты/);
});
test('lowercase letters, digits and hyphens are accepted without uppercase and kept unchanged',async()=>{
 const s=setup(),password=['ab7','cde','fg8','hij'].join('-');s.nodes.authEmail.value='regular_player';s.nodes.authPassword.value=password;
 await s.run('handleRegister()');assert.equal(s.calls.length,1);assert.equal(s.calls[0].password,password);assert.equal(s.calls[0].username,'regular_player');assert.equal(s.nodes.authError.textContent,'');
});
test('registration enforces server length boundaries without an outgoing request for invalid password',async()=>{
 for(const length of [5,129]){const s=setup();s.nodes.authEmail.value='valid_player';s.nodes.authPassword.value='a'.repeat(length);await s.run('handleRegister()');assert.equal(s.calls.length,0);assert.match(s.nodes.authError.textContent,/6 до 128/);}
 for(const length of [6,128]){const s=setup();s.nodes.authEmail.value='valid_player';s.nodes.authPassword.value='a'.repeat(length);await s.run('handleRegister()');assert.equal(s.calls.length,1);}
});
test('legacy email login remains available and is not checked against new username format',async()=>{
 const s=setup();s.nodes.authEmail.value='legacy@example.test';s.nodes.authPassword.value='a'.repeat(8);await s.run('handleLogin()');assert.equal(s.calls.length,1);assert.equal(s.calls[0].email,'legacy@example.test');
});
