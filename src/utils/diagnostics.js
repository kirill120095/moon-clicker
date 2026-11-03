const entries=[],listeners=new Set();
export function safeDiagnosticMessage(value){
 return String(value?.message||value||'').replace(/Bearer\s+\S+/gi,'Bearer [скрыто]').replace(/sb_(?:secret|publishable)_[A-Za-z0-9_-]+/g,'[ключ скрыт]').replace(/[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}/g,'[токен скрыт]').replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[email скрыт]').replace(/(?:password|пароль|access_token|refresh_token|authorization)\s*[:=]\s*[^\s,;]+/gi,'[секрет скрыт]').slice(0,300);
}
export function recordDiagnostic(source,action,code,message){
 const text=safeDiagnosticMessage(message),last=entries[entries.length-1],now=Date.now();
 if(last&&last.source===source&&last.action===action&&last.code===code&&last.message===text&&now-last.at<5000){last.count++;last.at=now;}else entries.push({at:now,source:String(source).slice(0,30),action:String(action).slice(0,40),code:String(code||'UNKNOWN').slice(0,40),message:text,count:1});
 if(entries.length>100)entries.splice(0,entries.length-100);
 for(const fn of listeners)try{fn();}catch{}
}
export function getDiagnostics(){return entries.map(e=>({...e}));}
export function subscribeDiagnostics(fn){listeners.add(fn);return()=>listeners.delete(fn);}
export function clearDiagnostics(){entries.length=0;for(const fn of listeners)try{fn();}catch{}}
let installed=false;
export function installDiagnostics(){
 if(installed||typeof window==='undefined')return;installed=true;
 window.addEventListener('error',e=>recordDiagnostic('browser','runtime','JS_ERROR',e.message));
 window.addEventListener('unhandledrejection',e=>recordDiagnostic('browser','promise','UNHANDLED',e.reason));
}
