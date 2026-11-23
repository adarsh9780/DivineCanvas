import { Directory, File, Paths } from 'expo-file-system';
import { NativeModules } from 'react-native';
import type { InferenceSession } from 'onnxruntime-react-native';
import { ParadeeEngine, wav } from './paradee/adapter';
import { isParadeeInstalled, installParadee } from './paradee/storage';
import { PARADEE_DOWNLOAD_BYTES } from './paradee/assets';
import { downloadVoiceLab, packDir, removeVoiceLab, voiceLabBytes, voiceLabInstalled, type VoiceLabPack } from './voiceLab';
import type { GeneratedSpeech, SpeechEngine, SpeechEngineInfo, SpeechLanguage, SpeechRequest } from './engine';

export type VoiceModel = 'paradee'|'kokoro'|'ninada';
export type VoiceSelection = {model:VoiceModel;voiceId:string;rate:number;expressiveness:number};
export type VoiceSelections = Record<SpeechLanguage,VoiceSelection>;
export const defaultVoiceSelections:VoiceSelections={
  en:{model:'paradee',voiceId:'af_heart',rate:1,expressiveness:0.667},
  hi:{model:'paradee',voiceId:'hf_alpha',rate:1,expressiveness:0.667},
  sa:{model:'paradee',voiceId:'hf_alpha',rate:1,expressiveness:0.667},
};
export const modelVoices:Record<VoiceModel,Record<SpeechLanguage,readonly {id:string;name:string}[]>>={
  paradee:{en:[{id:'af_heart',name:'Female'},{id:'am_puck',name:'Male'}],hi:[{id:'hf_alpha',name:'Female'},{id:'hm_omega',name:'Male'}],sa:[{id:'hf_alpha',name:'Female'},{id:'hm_omega',name:'Male'}]},
  kokoro:{en:[{id:'af_heart',name:'Female'},{id:'am_puck',name:'Male'}],hi:[{id:'hf_alpha',name:'Female'},{id:'hm_omega',name:'Male'}],sa:[]},
  ninada:{en:[],hi:[],sa:[{id:'male',name:'Male'},{id:'female',name:'Female'}]},
};
export function parseVoiceSelections(raw?:string):VoiceSelections {
  let data:Partial<Record<SpeechLanguage,Partial<VoiceSelection>>>={};try{data=JSON.parse(raw ?? '{}');}catch{}
  return Object.fromEntries((['en','hi','sa'] as const).map(lang=>{
    const saved=data?.[lang];const model:VoiceModel=saved?.model && Object.hasOwn(modelVoices,saved.model) && modelVoices[saved.model][lang].length ? saved.model : 'paradee';
    const voices=modelVoices[model][lang];const voiceId=voices.some(v=>v.id===saved?.voiceId)?saved!.voiceId!:voices[0].id;
    const rate=typeof saved?.rate==='number' && saved.rate>=0.7 && saved.rate<=1.3?saved.rate:1;
    const expressiveness=typeof saved?.expressiveness==='number' && saved.expressiveness>=0 && saved.expressiveness<=1?saved.expressiveness:0.667;
    return [lang,{model,voiceId,rate,expressiveness}];
  })) as VoiceSelections;
}
export function modelInstalled(model:VoiceModel) {return model==='paradee'?isParadeeInstalled():voiceLabInstalled(model) && (model!=='kokoro'||isParadeeInstalled());}
export function modelBytes(model:VoiceModel) {return model==='paradee'?PARADEE_DOWNLOAD_BYTES:voiceLabBytes(model)+(model==='kokoro'?PARADEE_DOWNLOAD_BYTES:0);}
const check=(signal?:AbortSignal)=>{if(signal?.aborted) throw new Error('Speech cancelled.');};
async function output(samples:Float32Array):Promise<GeneratedSpeech> {
  const dir=new Directory(Paths.cache,'speech-output');dir.create({idempotent:true,intermediates:true});
  const file=new File(dir,`speech-${Date.now()}-${Math.random().toString(36).slice(2)}.wav`);await file.write(wav(samples));
  return {uri:file.uri,dispose:async()=>{if(file.exists)file.delete();}};
}
function join(parts:Float32Array[]) {const data=new Float32Array(parts.reduce((n,p)=>n+p.length,0));let at=0;for(const p of parts){data.set(p,at);at+=p.length;}return data;}
function chunks(text:string,limit:number) {const parts:string[]=[];let current='';for(const word of text.split(/\s+/)){if(current && Array.from(current+' '+word).length>limit){parts.push(current);current='';}current+=(current?' ':'')+word;}if(current)parts.push(current);return parts;}
const saPunct="!¡'(),-.:;¿? ";
// Ninada v5 Sanskrit character vocabulary and normalization, adapted from MIT-licensed upstream studio_g2p.js.
const saChars=")ऊभॐब८•औॲ?z५ी/ऩठअवइ',डळत3° ञोnआफ़ॊच:․छऍई;ओuगझल0२ॆऑऱ!ॕ\"(मर|9…न-ॄु5ृहेॅःएघ७शऎ1ङॠं।१ष४cॉधाऽ\u200aकि2.ऋउ–ूa्स६जखदथ०68णऐैफ़ँs९३4ौ7—टपढयऌॡॢॣ॥";
const saTokens=['<PAD>',...Array.from(saPunct),...Array.from(saChars),'<BLNK>'];
const saIds=Object.fromEntries(saTokens.map((c,i)=>[c,i]));
export function ninadaSanskritIds(text:string) {
  const cleaned=text.normalize('NFC').trim().replace(/[\u0951-\u0954\u1cd0-\u1cff]/g,'').replace(/\s*ऽ+/g,'ऽ').replaceAll('||','॥').replaceAll('|','।').replace(/[\u200c\u200d\ufeff]/g,'').replace(/[“”]/g,'"').replace(/[‘’]/g,"'").replace(/–/g,' ').replace(/—/g,', ').replace(/…/g,'.').replace(/[;:]/g,',').replace(/-/g,' ').toLowerCase().replace(/[<>()[\]"]+/g,'').replace(/\s+/g,' ').trim();
  const ids=[saIds['<BLNK>']];for(const c of cleaned){if(saIds[c]===undefined) throw new Error(`Unsupported Sanskrit character: ${c}`);ids.push(saIds[c],saIds['<BLNK>']);}if(ids.length===1)throw new Error('There is no Sanskrit text to read.');return ids;
}
class NeuralModel implements SpeechEngine {
  readonly info:SpeechEngineInfo;
  private session?:InferenceSession;private sessionVoice='';private front?:ParadeeEngine;
  constructor(private model:VoiceLabPack) {this.info={id:model,name:model==='kokoro'?'Kokoro 82M':'Ninada',version:model==='kokoro'?'1.0-q8':'5-sa-v1',voices:Object.entries(modelVoices[model]).flatMap(([language,voices])=>voices.map(v=>({...v,languages:[language as SpeechLanguage]})))};}
  async isInstalled(){return modelInstalled(this.model);}
  async install(options:Parameters<SpeechEngine['install']>[0]) {
    const total=modelBytes(this.model);let base=0;
    if(this.model==='kokoro') {if(!isParadeeInstalled()) await installParadee({signal:options.signal,onProgress:p=>options.onProgress?.({completedBytes:p.completedBytes,totalBytes:total})});base=PARADEE_DOWNLOAD_BYTES;}
    if(!voiceLabInstalled(this.model)) await downloadVoiceLab(this.model,options.signal ?? new AbortController().signal,n=>options.onProgress?.({completedBytes:base+Math.round(n*voiceLabBytes(this.model)),totalBytes:total}));
  }
  async uninstall(){await this.dispose();removeVoiceLab(this.model);}
  async synthesize(request:SpeechRequest,signal?:AbortSignal):Promise<GeneratedSpeech> {
    if (!modelVoices[this.model][request.language].some(v=>v.id===request.voiceId)) throw new Error('This voice does not support this language.');
    if(!modelInstalled(this.model)) throw new Error('Download this voice model first.');
    if(!NativeModules.Onnxruntime || NativeModules.Onnxruntime.install()!==true || !(globalThis as {OrtApi?:unknown}).OrtApi)throw new Error('The speech engine is unavailable.');
    const ort=await import('onnxruntime-react-native');check(signal);
    const selected=this.model==='ninada' && request.voiceId==='female'?'female.onnx':'model.onnx';
    if(!this.session || this.sessionVoice!==selected){if(this.session)await this.session.release();this.session=await ort.InferenceSession.create(new File(packDir(this.model),selected).uri);this.sessionVoice=selected;}
    const rendered:Float32Array[]=[];let texts:string[];
    if(this.model==='kokoro') {
      if(!this.front)this.front=new ParadeeEngine();const front=await this.front.preparePhonemes(request.text,request.language as 'en'|'hi',signal);texts=chunks(front.phonemes,480);
      const file=request.voiceId==='af_heart'?'english.bin':request.voiceId==='am_puck'?'english-male.bin':request.voiceId==='hf_alpha'?'hindi.bin':'hindi-male.bin';const bytes=await new File(packDir('kokoro'),file).bytes();
      for(const part of texts){check(signal);const ids=[0,...Array.from(part).filter(c=>c in front.vocab).map(c=>front.vocab[c]),0];if(ids.length>512)throw new Error('A word is too long to read.');const pos=Math.min(ids.length-2,509)*1024;const data=new DataView(bytes.buffer,bytes.byteOffset+pos,1024);const style=new Float32Array(256);for(let i=0;i<256;i++)style[i]=data.getFloat32(i*4,true);const result=await this.session.run({input_ids:new ort.Tensor('int64',BigInt64Array.from(ids.map(BigInt)),[1,ids.length]),style:new ort.Tensor('float32',style,[1,256]),speed:new ort.Tensor('float32',new Float32Array([request.rate ?? 1]),[1])});rendered.push(new Float32Array(result.waveform.data as Float32Array));}
    } else {
      texts=chunks(request.text,180);for(const text of texts){check(signal);const ids=ninadaSanskritIds(text);const result=await this.session.run({input_ids:new ort.Tensor('int64',BigInt64Array.from(ids.map(BigInt)),[1,ids.length]),scales:new ort.Tensor('float32',new Float32Array([1/(request.rate ?? 1),request.expressiveness ?? 0.667,0.8]),[3])});rendered.push(new Float32Array(result.waveform.data as Float32Array));}
    }
    check(signal);const audio=join(rendered);if(!audio.length || !audio.every(Number.isFinite))throw new Error('The voice produced invalid audio.');return output(audio);
  }
  async dispose(){if(this.session)await this.session.release();this.session=undefined;if(this.front)await this.front.dispose();this.front=undefined;}
}
export function createVoiceModel(model:VoiceModel):SpeechEngine {return model==='paradee'?new ParadeeEngine():new NeuralModel(model);}
