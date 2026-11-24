const assert=require('node:assert/strict');const fs=require('node:fs');const ts=require('typescript');
const files=new Map();
class File {constructor(dir,name){this.uri=(dir.uri??dir)+'/'+name;}get exists(){return files.has(this.uri);}get size(){return files.get(this.uri)??0;}}
class Directory {constructor(path){this.uri=path;}get exists(){return [...files.keys()].some(k=>k.startsWith(this.uri+'/'));}list(){return [...files.keys()].filter(k=>k.startsWith(this.uri+'/')).map(k=>new File(this,k.slice(this.uri.length+1)));}}
const paradee=new Directory('/paradee'),kokoro=new Directory('/kokoro'),ninada=new Directory('/ninada');
const voiceLabAssets={kokoro:[{name:'model',size:100},{name:'voice',size:10}],ninada:[{name:'male',size:30},{name:'female',size:30}]};
const imports={'expo-file-system':{File,Directory,Paths:{}},'react-native':{NativeModules:{}},'./paradee/adapter':{ParadeeEngine:class{}},'./paradee/storage':{isParadeeInstalled:()=>files.has('/paradee/verified'),paradeeDirectory:()=>paradee},'./paradee/assets':{PARADEE_ASSETS:[{name:'model',size:8},{name:'g2p',size:2}],PARADEE_DOWNLOAD_BYTES:10},'./voiceLab':{voiceLabAssets,packDir:m=>m==='kokoro'?kokoro:ninada,voiceLabBytes:m=>voiceLabAssets[m].reduce((n,a)=>n+a.size,0),voiceLabInstalled:m=>files.has(`/${m}/verified`)}};
const code=ts.transpileModule(fs.readFileSync('src/speech/models.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;const api={};new Function('require','exports',code)(name=>imports[name]??require(name),api);
assert.equal(api.modelDownloadBytes('kokoro'),120);assert.equal(api.modelStorageBytes('kokoro'),0);
files.set('/paradee/model',8);assert.equal(api.modelDownloadBytes('paradee'),10,'partial Paradee installations require the full download');
files.set('/paradee/model',8);files.set('/paradee/g2p',2);files.set('/paradee/verified',1);files.set('/kokoro/model',100);
assert.equal(api.modelDownloadBytes('kokoro'),10,'shared and existing model files are not counted again');assert.equal(api.modelStorageBytes('kokoro'),100,'removing Kokoro excludes shared Paradee');assert.equal(api.modelStorageBytes('paradee'),11);
files.set('/ninada/male',30);assert.equal(api.modelDownloadBytes('ninada'),30,'only missing voice is downloaded');
console.log('PASS: download estimates and removable model storage account for shared files');
