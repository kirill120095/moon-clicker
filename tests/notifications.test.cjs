const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
test('toast container initializes lazily, stacks messages and removes them on timeout',()=>{
 const pending=[],children=[];const container={children,appendChild(el){children.push(el);el.parentNode=this;},get firstElementChild(){return children[0];}};
 const document={getElementById:()=>container,createElement(){return{classList:{add(){},remove(){}},remove(){const i=children.indexOf(this);if(i>=0)children.splice(i,1);this.parentNode=null;}};}};
 const context={console,window:{},document,requestAnimationFrame:fn=>fn(),setTimeout:(fn,delay)=>{pending.push({fn,delay});return pending.length;}};
 vm.createContext(context);const source=fs.readFileSync(path.join(__dirname,'../src/modules/ui/renderer.js'),'utf8').replace(/^import\s[\s\S]*?from\s+['"][^'"]+['"];?\s*/gm,'').replace(/^export\s+/gm,'');vm.runInContext(source,context);
 vm.runInContext("showToast('Quest','success',3500);showToast('Achievement','success',3500);",context);assert.equal(children.length,2);assert.deepEqual(children.map(c=>c.textContent),['Quest','Achievement']);for(const timer of pending.filter(t=>t.delay===3500))timer.fn();for(const timer of pending.filter(t=>t.delay===300))timer.fn();assert.equal(children.length,0);
});
