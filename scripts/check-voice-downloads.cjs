const assert=require('node:assert/strict');const fs=require('node:fs');const ts=require('typescript');
const files=new Map();const dirs=new Set(['/doc','/doc/voice-comparison']);let downloads=[];
class Directory {
 constructor(base,name){this.uri=(base.uri??base)+'/'+name;}
 get exists(){return dirs.has(this.uri);}
 create(){dirs.add(this.uri);}
 delete(){for(const k of files.keys())if(k.startsWith(this.uri+'/'))files.delete(k);dirs.delete(this.uri);}
 async move(dest){dirs.add(dest.uri);for(const [k,v] of [...files])if(k.startsWith(this.uri+'/')){files.set(dest.uri+k.slice(this.uri.length),v);files.delete(k);}dirs.delete(this.uri);}
}
class File {
 constructor(base,name){this.uri=name?(base.uri??base)+'/'+name:(base.uri??base);}
 get exists(){return files.has(this.uri);}get size(){return files.get(this.uri)?.size ?? 0;}
 async digest(){return files.get(this.uri)?.digest;}async copy(dest){files.set(dest.uri,files.get(this.uri));}
 async write(value){files.set(this.uri,{size:value.length,digest:'meta'});}delete(){files.delete(this.uri);}
 static createDownloadTask(url,dest,opts){return {async downloadAsync(){downloads.push(url);if(opts.signal.aborted)return null;files.set(dest.uri,{size:2,digest:'new'});opts.onProgress?.({bytesWritten:2});return dest;}};}
}
const imports={'expo-file-system':{File,Directory,Paths:{document:'/doc',cache:'/cache'}},'react-native':{NativeModules:{}},'./paradee/adapter':{},'./voiceLabInputs':{}};
const source=fs.readFileSync('src/speech/voiceLab.ts','utf8');const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const api={};new Function('require','exports',js)(name=>imports[name]??require(name),api);
api.voiceLabAssets.kokoro=[{name:'old',url:'old-url',size:3,sha256:'old'},{name:'new',url:'new-url',size:2,sha256:'new'}];
files.set('/doc/voice-comparison/kokoro/old',{size:3,digest:'old'});dirs.add('/doc/voice-comparison/kokoro');
(async()=>{let progress=[];await api.downloadVoiceLab('kokoro',new AbortController().signal,n=>progress.push(n));assert.deepEqual(downloads,['new-url']);assert.equal(api.voiceLabInstalled('kokoro'),true);assert.equal(progress.at(-1),1);assert.equal(files.get('/doc/voice-comparison/kokoro/old').digest,'old');console.log('PASS: existing verified voice files are reused during upgrade');})().catch(e=>{console.error(e);process.exitCode=1});
