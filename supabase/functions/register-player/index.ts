// Temporary username-only signup; no emails are collected or sent.
const base=Deno.env.get('SUPABASE_URL')!;
const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const headers={apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'};
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return reply({ok:true});
 if(req.method!=='POST')return reply({error:'Method not allowed'},405);
 try{
  const text=await req.text();if(text.length>2048)return reply({error:'Слишком большой запрос'},413);
  let body;try{body=JSON.parse(text);}catch{return reply({error:'Некорректный запрос'},400);}
  const username=typeof body.username==='string'?body.username.trim():'';
  const password=body.password;
  if(!/^[a-zA-Z0-9_-]{3,30}$/.test(username))return reply({error:'Логин: 3–30 латинских букв, цифр, _ или -'},400);
  if(typeof password!=='string'||password.length<6||password.length>128)return reply({error:'Пароль: от 6 до 128 символов'},400);
  const ip=(req.headers.get('x-forwarded-for')||'unknown').split(',')[0].trim();
  const hmacKey=await crypto.subtle.importKey('raw',new TextEncoder().encode(service),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const signature=await crypto.subtle.sign('HMAC',hmacKey,new TextEncoder().encode(ip));
  const hash=Array.from(new Uint8Array(signature),b=>b.toString(16).padStart(2,'0')).join('');
  const limit=await fetch(base+'/rest/v1/rpc/username_signup_attempt',{method:'POST',headers,body:JSON.stringify({p_key_hash:hash})});
  if(!limit.ok)return reply({error:'Регистрация временно недоступна'},503);
  if(await limit.json()!==true)return reply({error:'Слишком много регистраций с этого подключения. Попробуйте через 15 минут.'},429);
  const result=await fetch(base+'/auth/v1/admin/users',{method:'POST',headers,body:JSON.stringify({
   email:username.toLowerCase()+'@players.moon-clicker.invalid',password,email_confirm:true,
   user_metadata:{username},app_metadata:{login_mode:'username'}
  })});
  if(!result.ok){
   const error=await result.json();
   if(error.code==='email_exists'||error.code==='user_already_exists'||/already.*registered|already.*exists/i.test(error.msg||error.message||''))return reply({error:'Этот логин уже занят'},409);
   return reply({error:'Не удалось создать аккаунт. Проверьте логин и пароль.'},400);
  }
  return reply({ok:true},201);
 }catch{return reply({error:'Не удалось зарегистрироваться. Попробуйте ещё раз.'},503);}
});