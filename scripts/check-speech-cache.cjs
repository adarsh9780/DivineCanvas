const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require(path.resolve('node_modules/typescript'));
const store=new Map();
class Directory {
 constructor(base,name){this.uri=(base.uri||base)+'/'+name}
 get exists(){return true}
 create(){}
 list(){return [...store.keys()].filter(x=>x.startsWith(this.uri+'/')).map(x=>new File(x))}
}
class File {
 constructor(base,name){this.uri=name?(base.uri||base)+'/'+name:(base.uri||base)}
 get name(){return this.uri.split('/').pop()}
 get exists(){return store.has(this.uri)}
 get size(){return (store.get(this.uri)||'').length}
 textSync(){return store.get(this.uri)}
 writeSync(value){store.set(this.uri,value)}
 delete(){store.delete(this.uri)}
 async move(dest){store.set(dest.uri,store.get(this.uri));store.delete(this.uri)}
}
const source=fs.readFileSync('src/speech/speechCache.ts','utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const api={};new Function('exports','require',js)(api,name=>name==='expo-file-system'?{Directory,File,Paths:{cache:'/cache'}}:require(name));
const timers=[];global.setTimeout=fn=>{timers.push(fn);return 1};
let generated=0;
const engine={info:{id:'engine',version:'1'},synthesize:async()=>{const f=new File('/tmp/'+(++generated));store.set(f.uri,'x'.repeat(60));return {uri:f.uri,dispose:async()=>f.delete()}}};
const request={text:'verse',language:'en',voiceId:'v'};const signal=new AbortController().signal;
(async()=>{
 const first=await api.cachedSpeech(engine,request,signal);const second=await api.cachedSpeech(engine,request,signal);
 assert.equal(generated,1);assert.equal(first.uri,second.uri);assert.equal(api.speechCacheSize()>0,true);
 api.clearSpeechCache();assert.equal(store.has(first.uri),true,'in-use file retained');
 const third=await api.cachedSpeech(engine,request,signal);assert.equal(generated,2,'cleared active cache is not reused');
 await third.dispose();await first.dispose();await second.dispose();
 const changed=await api.cachedSpeech(engine,{...request,text:'different'},signal);assert.equal(generated,3,'different text is generated');await changed.dispose();
 const expressive=await api.cachedSpeech(engine,{...request,text:'different',expressiveness:0.3},signal);assert.equal(generated,4,'voice variation has its own cache entry');await expressive.dispose();
 const clock=Date.now; Date.now=()=>clock()+8*24*60*60*1000; api.pruneSpeechCache(); assert.equal(store.has(changed.uri),false,'unused cached audio expires after seven days'); Date.now=clock;
 api.pruneSpeechCache();assert.equal(store.has(first.uri),true,'released audio survives cleanup while native player settles'); while(timers.length) timers.shift()();assert.equal(store.has(first.uri),false,'cleared file is eventually removed');
 console.log('PASS: cache reuse, active-file protection, clear, and request identity');
})().catch(e=>{console.error(e);process.exitCode=1});
