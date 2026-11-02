import { applyAction, freshState } from './rules.js';
const base=Deno.env.get('SUPABASE_URL')!;
const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const headers={'apikey':service,'Authorization':'Bearer '+service,'Content-Type':'application/json'};
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'};
const response=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json'}});
async function rpc(name:string,args:unknown){const r=await fetch(base+'/rest/v1/rpc/'+name,{method:'POST',headers,body:JSON.stringify(args)});const data=await r.json();if(!r.ok)throw Error(data.code==='40001'?'Прогресс изменился в другой вкладке. Повторите действие.':'Не удалось сохранить действие');return data;}
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return response({error:'Method not allowed'},405);
 try{
  const authorization=req.headers.get('authorization');
  if(!authorization?.startsWith('Bearer '))return response({error:'Требуется вход'},401);
  const userResponse=await fetch(base+'/auth/v1/user',{headers:{apikey:service,Authorization:authorization}});
  if(!userResponse.ok)return response({error:'Сессия истекла. Войдите снова.'},401);
  const user=await userResponse.json();
  const text=await req.text();if(text.length>2048)return response({error:'Request too large'},413);
  const body=JSON.parse(text);
  if(typeof body.request_id!=='string'||!(/^[0-9a-f-]{36}$/i).test(body.request_id))return response({error:'Некорректный запрос'},400);
  const loaded=await rpc('game_load',{p_user:user.id,p_request:body.request_id});
  if(loaded.cached)return response(loaded.cached);
  const now=Date.now();
  let state=loaded.state||freshState(String(user.user_metadata?.username||user.email?.split('@')[0]||'Игрок').trim().slice(0,30)||'Игрок');
  if(body.action==='reset'){const maxLevel=state.maxLevel||state.currentLevel;state=freshState(state.playerData.username);state.maxLevel=maxLevel;}
  state=applyAction(state,body.action==='reset'?'load':body.action,body.payload||{},now);
  const result={state,serverNow:now};
  const saved=await rpc('game_commit',{p_user:user.id,p_request:body.request_id,p_expected:loaded.revision,p_state:state,p_response:result});
  return response(saved);
 }catch(error){return response({error:error instanceof Error?error.message:'Ошибка действия'},400);}
});
