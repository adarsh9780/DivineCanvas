const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const ts = require(root + '/node_modules/typescript');
const source = fs.readFileSync(root + '/src/musicLibrary.ts', 'utf8');
const compiled = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const files = new Map();
let moveFinished=false, rejectMove=false;
class Directory {
  constructor(...parts) {this.uri=parts.map(part => typeof part==='string' ? part : part.uri).join('/');}
  create() {}
}
class File {
  constructor(dir,name) {this.uri=`${dir.uri}/${name}`;}
  get exists() {return files.has(this.uri);}
  get size() {return files.get(this.uri)?.size;}
  delete() {if (!files.delete(this.uri)) throw new Error('File is missing');}
  async digest() {return files.get(this.uri)?.sha;}
  async move(target) {
    await new Promise(resolve => setTimeout(resolve,10));
    if (rejectMove) throw new Error('Move failed');
    const content=files.get(this.uri);
    if (!content) throw new Error('Source was deleted before move finished');
    files.delete(this.uri); files.set(target.uri,content); this.uri=target.uri; moveFinished=true;
  }
  static createDownloadTask(_url,destination,{onProgress}) {
    return {downloadAsync:async () => {files.set(destination.uri,{size:9,sha:'ok'}); onProgress({bytesWritten:3,totalBytes:12}); onProgress({bytesWritten:9}); return destination;}};
  }
}
const progressApi={};
const progressCode=require('typescript').transpileModule(require('node:fs').readFileSync('src/downloadProgress.ts','utf8'),{compilerOptions:{module:require('typescript').ModuleKind.CommonJS}}).outputText;
new Function('exports',progressCode)(progressApi);
const api={};
new Function('require','exports',compiled)(id => {
  if (id==='expo-file-system') return {Directory,File,Paths:{document:{uri:'documents'}}};
  if (id==='./downloadProgress') return progressApi;
  if (id==='react-native') return {Platform:{OS:'ios'}};
  throw Error(id);
},api);
(async () => {
  const track={id:'test',filename:'test.mp3',sha256:'ok',bytes:9,title:'Test',artist:'Test',source:'https://example.com'};
  files.set('documents/reading-music-v1/patterns.mp3',{size:3,sha:'old'});
  files.set('documents/reading-music-v1/patterns.mp3.partial',{size:2,sha:'old'});
  files.set('documents/reading-music-v1/other.mp3',{size:4,sha:'keep'});
  api.removeRetiredMusic();
  assert.equal(files.has('documents/reading-music-v1/patterns.mp3'),false);
  assert.equal(files.has('documents/reading-music-v1/patterns.mp3.partial'),false);
  assert.equal(files.has('documents/reading-music-v1/other.mp3'),true);
  const progress=[]; await api.downloadMusic(track,n => progress.push(n));
  assert.equal(moveFinished,true,'download must wait for the move');
  assert.equal(api.musicDownloaded(track),true,'cleanup must not remove the completed file');
  assert.deepEqual(progress,[0.25,1]);
  api.removeMusic(track); assert.equal(api.musicDownloaded(track),false);
  rejectMove=true;
  await assert.rejects(api.downloadMusic(track,() => {}),/Move failed/);
  rejectMove=false; await api.downloadMusic(track,() => {});
  assert.equal(api.musicDownloaded(track),true,'failed move must release the download lock');
  console.log('PASS: asynchronous move completes before cleanup, failures release the lock, and retries work.');
})().catch(error => {console.error(error);process.exitCode=1;});
