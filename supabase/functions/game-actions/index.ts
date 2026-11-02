import { applyAction, freshState } from './rules.js';
const base=Deno.env.get('SUPABASE_URL')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const headers={apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'};
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
const encoder=new TextEncoder(),decoder=new TextDecoder();
const keyPromise=crypto.subtle.digest('SHA-256',encoder.encode('moon-clicker-snapshot-v1:'+service)).then(bytes=>crypto.subtle.importKey('raw',bytes,{name:'HMAC',hash:'SHA-256'},false,['sign','verify']));
const b64=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
const unb64=(s:string)=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
async function tokenHash(token:string){return b64(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(token))));}
async function openSnapshot(input:unknown,hash:string){
 if(typeof input!=='string'||input.length>60000)return null;
 try{const [payload,signature]=input.split('.');if(!payload||!signature)return null;
  if(!await crypto.subtle.verify('HMAC',await keyPromise,unb64(signature),encoder.encode(payload)))return null;
  const data=JSON.parse(decoder.decode(unb64(payload)));
  if(data.hash!==hash||data.expires<Date.now()||!Number.isSafeInteger(data.revision)||!data.uid||!data.state)return null;
  return data;
 }catch{return null;}
}
async function seal(saved:any,identity:any,hash:string){
 if(!Number.isSafeInteger(saved.revision))return saved;
 const state={...saved.state,effects:[]};
 const payload=b64(encoder.encode(JSON.stringify({uid:identity.uid,hash,revision:saved.revision,state,expires:Date.now()+30000})));
 const signature=b64(new Uint8Array(await crypto.subtle.sign('HMAC',await keyPromise,encoder.encode(payload))));
 return {...saved,snapshot:payload+'.'+signature};
}
async function rpc(name:string,args:unknown){
 const r=await fetch(base+'/rest/v1/rpc/'+name,{method:'POST',headers,body:JSON.stringify(args)});
 const data=await r.json();if(!r.ok){const error=new Error(data.code==='28000'?'Сессия истекла. Войдите снова.':'Не удалось подтвердить действие') as Error&{code?:string};error.code=data.code;throw error;}return data;
}
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return reply({error:'Method not allowed'},405);
 try{
  const authorization=req.headers.get('authorization');if(!authorization?.startsWith('Bearer '))return reply({error:'Требуется вход'},401);
  const text=await req.text();if(text.length>65536)return reply({error:'Слишком большой запрос'},413);
  let body;try{body=JSON.parse(text);}catch{return reply({error:'Некорректный запрос'},400);}
  if(typeof body.request_id!=='string'||!(/^[0-9a-f-]{36}$/i).test(body.request_id))return reply({error:'Некорректный запрос'},400);
  // Authentication is never cached in the snapshot: Auth validates every request.
  const userResponse=await fetch(base+'/auth/v1/user',{headers:{apikey:service,Authorization:authorization}});
  if(!userResponse.ok)return reply({error:'Сессия истекла. Войдите снова.'},401);
  const user=await userResponse.json();
  let claims;try{claims=JSON.parse(decoder.decode(unb64(authorization.slice(7).split('.')[1])));}catch{return reply({error:'Некорректная сессия'},401);}
  if(!claims.session_id||claims.sub!==user.id)return reply({error:'Некорректная сессия'},401);
  const identity={uid:user.id,session:String(claims.session_id),username:user.user_metadata?.username};
  const hash=await tokenHash(authorization);
  let snapshot=await openSnapshot(body.snapshot,hash);
  if(snapshot?.uid!==user.id)snapshot=null;
  const save=(state:any,revision:number,result:any)=>rpc('game_commit_fast',{p_user:identity.uid,p_session:identity.session,p_request:body.request_id,p_expected:revision,p_state:state,p_response:result});
  let loaded=snapshot&&body.action!=='load'?{state:snapshot.state,revision:snapshot.revision}:await rpc('game_load',{p_user:identity.uid,p_request:body.request_id});
  if(loaded.cached)return reply(await seal(await save(loaded.cached.state,0,loaded.cached),identity,hash));
  for(let attempt=0;attempt<3;attempt++){
   const now=Date.now();let state=loaded.state||freshState(String(identity.username||'Игрок').trim().slice(0,30)||'Игрок');
   if(body.action==='reset'){
    const prestige=structuredClone(state.prestige||{coins:0,ascensions:0,upgrades:{}}),runMaxLevel=state.runMaxLevel??state.maxLevel??state.currentLevel,maxLevel=state.maxLevel||state.currentLevel,serial=(state.moonSerial||1)+1;
    state=freshState(state.playerData.username);state.maxLevel=maxLevel;state.moonSerial=serial;state.prestige=prestige;state.runMaxLevel=runMaxLevel;
   }
   try{
    state=applyAction(state,body.action==='reset'?'load':body.action,body.payload||{},now);
    const saved=await save(state,loaded.revision,{state,serverNow:now,revision:loaded.revision+1});
    return reply(await seal(saved,identity,hash));
   }catch(error){
    const code=(error as {code?:string}).code;if(code==='28000')throw error;
    loaded=await rpc('game_load',{p_user:identity.uid,p_request:body.request_id});
    if(loaded.cached)return reply(await seal(await save(loaded.cached.state,0,loaded.cached),identity,hash));
    if(code!=='40001'||attempt===2)throw error;
   }
  }
  return reply({error:'Повторите действие'},409);
 }catch(error){return reply({error:error instanceof Error?error.message:'Ошибка действия'},(error as {code?:string}).code==='28000'?401:400);}
});
