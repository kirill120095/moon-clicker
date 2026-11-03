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
 let r:Response;try{r=await fetch(base+'/rest/v1/rpc/'+name,{method:'POST',headers,body:JSON.stringify(args),signal:AbortSignal.timeout(8000)});}catch{throw Object.assign(new Error('База данных временно недоступна. Повторите через несколько секунд.'),{code:'SERVICE_UNAVAILABLE'});}
 let data;try{data=await r.json();}catch{throw Object.assign(new Error('Сервер базы данных временно недоступен.'),{code:'SERVICE_UNAVAILABLE'});}
 if(data?.conflict)throw Object.assign(new Error('Сохранение изменилось в другой вкладке.'),{code:'40001'});
 if(!r.ok){
  const unavailable=r.status>=500&&data.code!=='40001',message=data.code==='28000'?'Сессия истекла. Войдите снова.':unavailable?'База данных временно недоступна. Повторите через несколько секунд.':data.code==='40001'?'Сохранение изменилось в другой вкладке. Повторите действие.':'Не удалось подтвердить действие';
  throw Object.assign(new Error(message),{code:data.code||'SERVICE_UNAVAILABLE',privateMessage:String(data.message||message).slice(0,300)});
 }
 return data;
}
async function diagnostic(user:string|null,request:string|null,action:string,code:string,message:string,level='error'){
 if(!user)return;
 const safe=String(message).replace(/Bearer\s+\S+/gi,'[redacted]').replace(/sb_(?:secret|publishable)_[A-Za-z0-9_-]+/g,'[redacted]').replace(/[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}/g,'[redacted]').slice(0,300);
 if(['PGRST003','PGRST000','PGRST001','PGRST002','SERVICE_UNAVAILABLE'].includes(code)){console.warn(JSON.stringify({event:'game_api_unavailable',request_id:request,action,code,message:safe}));return;}
 try{await fetch(base+'/rest/v1/rpc/game_record_diagnostic',{method:'POST',headers,body:JSON.stringify({p_user:user,p_request:request,p_action:action,p_code:code,p_message:safe,p_level:level}),signal:AbortSignal.timeout(1500)});}catch{}
}

Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return reply({error:'Method not allowed'},405);
 let diagnosticUser:string|null=null,diagnosticRequest:string|null=null,diagnosticAction='unknown';
 try{
  const authorization=req.headers.get('authorization');if(!authorization?.startsWith('Bearer '))return reply({error:'Требуется вход'},401);
  const text=await req.text();if(text.length>65536)return reply({error:'Слишком большой запрос'},413);
  let body;try{body=JSON.parse(text);}catch{return reply({error:'Некорректный запрос'},400);}
  if(typeof body.request_id!=='string'||!(/^[0-9a-f-]{36}$/i).test(body.request_id))return reply({error:'Некорректный запрос'},400);
  diagnosticRequest=body.request_id;diagnosticAction=String(body.action||'unknown').slice(0,40);
  // Authentication is never cached in the snapshot: Auth validates every request.
  const userResponse=await fetch(base+'/auth/v1/user',{headers:{apikey:service,Authorization:authorization},signal:AbortSignal.timeout(8000)});
  if(!userResponse.ok)return reply({error:'Сессия истекла. Войдите снова.'},401);
  const user=await userResponse.json();diagnosticUser=user.id;
  let claims;try{claims=JSON.parse(decoder.decode(unb64(authorization.slice(7).split('.')[1])));}catch{return reply({error:'Некорректная сессия'},401);}
  if(!claims.session_id||claims.sub!==user.id)return reply({error:'Некорректная сессия'},401);
  const identity={uid:user.id,session:String(claims.session_id),username:user.user_metadata?.username};
  const hash=await tokenHash(authorization);
  let snapshot=await openSnapshot(body.snapshot,hash);
  if(snapshot?.uid!==user.id)snapshot=null;
  const save=(state:any,revision:number,result:any)=>rpc('game_commit_safe',{p_user:identity.uid,p_session:identity.session,p_request:body.request_id,p_expected:revision,p_state:state,p_response:result});
  let loaded=snapshot&&body.action!=='load'?{state:snapshot.state,revision:snapshot.revision}:await rpc('game_load',{p_user:identity.uid,p_request:body.request_id});
  if(loaded.cached)return reply(await seal(await save(loaded.cached.state,0,loaded.cached),identity,hash));
  for(let attempt=0;attempt<5;attempt++){
   const now=Date.now();let state=loaded.state||freshState(String(identity.username||'Игрок').trim().slice(0,30)||'Игрок');
   if(body.action==='reset'){
    const prestige=structuredClone(state.prestige||{coins:0,ascensions:0,upgrades:{}}),runMaxLevel=state.runMaxLevel??state.maxLevel??state.currentLevel,maxLevel=state.maxLevel||state.currentLevel,serial=(state.moonSerial||1)+1;
    state=freshState(state.playerData.username);state.maxLevel=maxLevel;state.moonSerial=serial;state.prestige=prestige;state.runMaxLevel=runMaxLevel;
   }
   try{
    state=applyAction(state,body.action==='reset'?'load':body.action,body.payload||{},now);
    const saved=await save(state,loaded.revision,{state,serverNow:now,revision:loaded.revision+1});
    if(body.action==='load')await diagnostic(user.id,body.request_id,'load','OK','Сохранение загружено','info');
    return reply(await seal(saved,identity,hash));
   }catch(error){
    const code=(error as {code?:string}).code;if(code!=='40001'||attempt===4)throw error;
    await new Promise(resolve=>setTimeout(resolve,20*(attempt+1)));
    loaded=await rpc('game_load',{p_user:identity.uid,p_request:body.request_id});
    if(loaded.cached)return reply(await seal(await save(loaded.cached.state,0,loaded.cached),identity,hash));
   }
  }
  return reply({error:'Повторите действие'},409);
 }catch(error){
  const e=error as Error&{code?:string;privateMessage?:string},code=e.code||(e.name==='TimeoutError'?'SERVICE_UNAVAILABLE':'ACTION_ERROR');
  await diagnostic(diagnosticUser,diagnosticRequest,diagnosticAction,code,e.privateMessage||e.message);
  const status=code==='28000'?401:code==='40001'?409:code==='RATE_LIMIT'?429:['PGRST003','PGRST000','PGRST001','PGRST002','SERVICE_UNAVAILABLE','57014','53300'].includes(code)?503:400;
  return reply({error:e.name==='TimeoutError'?'Сервер временно недоступен. Повторите через несколько секунд.':e.message||'Ошибка действия',code,request_id:diagnosticRequest},status);
 }
});
