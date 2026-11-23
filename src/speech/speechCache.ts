import { Directory, File, Paths } from 'expo-file-system';
import type { GeneratedSpeech, SpeechEngine, SpeechRequest } from './engine';

const MAX_IDLE_MS=7*24*60*60*1000;
const RELEASE_GRACE_MS=30000;
const active=new Map<string,number>();
const pending=new Set<string>();
const recentlyReleased=new Map<string,number>();
const directory=() => new Directory(Paths.cache,'narration-cache');
type Metadata={key:string;lastUsed:number;clear?:boolean};

function nameFor(key:string) {
  let a=2166136261,b=2246822519;
  for (let i=0;i<key.length;i++) {a=Math.imul(a^key.charCodeAt(i),16777619);b=Math.imul(b^key.charCodeAt(i),3266489917);}
  return `${(a>>>0).toString(16).padStart(8,'0')}${(b>>>0).toString(16).padStart(8,'0')}`;
}
function files(name:string) {const dir=directory();return {audio:new File(dir,`${name}.wav`),meta:new File(dir,`${name}.json`)};}
function readMetadata(meta:File):Metadata|null {
  try {return meta.exists ? JSON.parse(meta.textSync()) as Metadata : null;} catch {return null;}
}
function remove(name:string) {
  const {audio,meta}=files(name);
  try {if (audio.exists) audio.delete(); if (meta.exists) meta.delete();} catch { /* Cache can be removed by the OS at any time. */ }
}
function deferRemoval(name:string) {
  pending.add(name);
  const delay=Math.max(0,(recentlyReleased.get(name) ?? Date.now())+RELEASE_GRACE_MS-Date.now());
  setTimeout(() => {
    if (!active.has(name) && pending.delete(name)) {recentlyReleased.delete(name); remove(name);}
  }, delay);
}
function release(name:string) {
  const count=(active.get(name) ?? 1)-1;
  if (count>0) active.set(name,count);
  else {
    active.delete(name);
    const releasedAt=Date.now();
    recentlyReleased.set(name,releasedAt);
    if (pending.has(name)) deferRemoval(name);
    else setTimeout(() => {if (!pending.has(name) && recentlyReleased.get(name)===releasedAt) recentlyReleased.delete(name);}, RELEASE_GRACE_MS);
  }
}
function lease(name:string,audio:File):GeneratedSpeech {
  active.set(name,(active.get(name) ?? 0)+1);
  let released=false;
  return {uri:audio.uri,dispose:async()=>{if (!released) {released=true; release(name);}}};
}
export function speechCacheSize():number {
  const dir=directory();
  if (!dir.exists) return 0;
  try {return dir.list().reduce((total,item)=>total+(item instanceof File ? item.size : 0),0);} catch {return 0;}
}
export function clearSpeechCache() {
  const dir=directory();
  if (!dir.exists) return;
  for (const item of dir.list()) {
    if (!(item instanceof File) || (!item.name.endsWith('.json') && !item.name.endsWith('.wav'))) continue;
    const name=item.name.slice(0,-(item.name.endsWith('.json')?5:4));
    if (active.has(name) || Date.now()-(recentlyReleased.get(name) ?? 0)<RELEASE_GRACE_MS) {
      pending.add(name);
      if (!active.has(name)) deferRemoval(name);
      const metaFile=files(name).meta;
      const meta=readMetadata(metaFile);
      if (meta) {try {metaFile.writeSync(JSON.stringify({...meta,clear:true}));} catch { /* The OS may have removed the cache. */ }}
    } else remove(name);
  }
}
export function pruneSpeechCache() {
  const dir=directory();
  if (!dir.exists) return;
  for (const item of dir.list()) {
    if (!(item instanceof File) || !item.name.endsWith('.json')) continue;
    const name=item.name.slice(0,-5), meta=readMetadata(item);
    if (!active.has(name) && !pending.has(name) && Date.now()-(recentlyReleased.get(name) ?? 0)>=RELEASE_GRACE_MS && (!meta || meta.clear || !Number.isFinite(meta.lastUsed) || Date.now()-meta.lastUsed>MAX_IDLE_MS)) remove(name);
  }
}
function deferGeneratedDisposal(file:GeneratedSpeech):GeneratedSpeech {
  let released=false;
  return {uri:file.uri,dispose:async()=>{if (!released) {released=true; setTimeout(() => {void file.dispose().catch(() => {});}, RELEASE_GRACE_MS);}}};
}
export async function cachedSpeech(engine:SpeechEngine,request:SpeechRequest,signal:AbortSignal):Promise<GeneratedSpeech> {
  const key=JSON.stringify([engine.info.id,engine.info.version,request.language,request.voiceId,request.rate ?? 1,request.expressiveness ?? null,request.text]);
  const name=nameFor(key), dir=directory();
  try {dir.create({idempotent:true,intermediates:true});} catch {return deferGeneratedDisposal(await engine.synthesize(request,signal));}
  const {audio,meta}=files(name);
  const existing=readMetadata(meta);
  if (existing?.key===key && !existing.clear && audio.exists && audio.size>44 && (active.has(name) || Date.now()-existing.lastUsed<=MAX_IDLE_MS)) {
    try {meta.writeSync(JSON.stringify({...existing,lastUsed:Date.now()}));} catch { /* Reuse remains safe if the timestamp cannot be updated. */ }
    return lease(name,audio);
  }
  const generated=await engine.synthesize(request,signal);
  if (signal.aborted || pending.has(name) || active.has(name) || recentlyReleased.has(name) || (existing && existing.key!==key)) return deferGeneratedDisposal(generated);
  try {
    if (audio.exists) audio.delete();
    await new File(generated.uri).move(audio);
    meta.writeSync(JSON.stringify({key,lastUsed:Date.now()}));
    return lease(name,audio);
  } catch {
    // If promotion failed after the move, the cache file is still safe to play.
    if (audio.exists) return lease(name,audio);
    return deferGeneratedDisposal(generated);
  }
}
