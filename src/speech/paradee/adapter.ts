import { Directory, File, Paths } from 'expo-file-system';
import { NativeModules } from 'react-native';
import { gunzipSync, strFromU8 } from 'fflate';
import type { InferenceSession } from 'onnxruntime-react-native';
import type { GeneratedSpeech, SpeechEngine, SpeechEngineInfo, SpeechRequest } from '../engine';
import { installParadee, isParadeeInstalled, paradeeFile, removeParadee } from './storage';

type Ort = typeof import('onnxruntime-react-native');
type Lexicon = {vocab:{in:string[];out:string[]}; lexicon:Record<string,{w:Record<string,string>;c:Record<string,string>}>; numbers:Record<string,Record<string,string>>};
type Config = {vocab:Record<string,number>};
const VOICES = ['af_heart','bf_isabella','am_puck','bm_fable','hf_alpha','hm_omega','ff_siwis','em_alex'];
export const PARADEE_INFO: SpeechEngineInfo = {id:'paradee',name:'Paradee',version:'1.3',voices:[
  {id:'af_heart',name:'English · female',languages:['en']}, {id:'am_puck',name:'English · male',languages:['en']},
  {id:'hf_alpha',name:'Hindi · female',languages:['hi','sa']}, {id:'hm_omega',name:'Hindi · male',languages:['hi','sa']},
]};
function checkAbort(signal?: AbortSignal) { if (signal?.aborted) throw new Error('Speech cancelled.'); }
export function wav(samples:Float32Array):Uint8Array {
  const bytes = new Uint8Array(44 + samples.length * 2); const v = new DataView(bytes.buffer);
  const str = (offset:number, text:string) => { for (let i=0;i<text.length;i++) v.setUint8(offset+i,text.charCodeAt(i)); };
  str(0,'RIFF'); v.setUint32(4,36+samples.length*2,true); str(8,'WAVE'); str(12,'fmt '); v.setUint32(16,16,true); v.setUint16(20,1,true); v.setUint16(22,1,true); v.setUint32(24,24000,true); v.setUint32(28,48000,true); v.setUint16(32,2,true); v.setUint16(34,16,true); str(36,'data'); v.setUint32(40,samples.length*2,true);
  samples.forEach((value,i) => { const x = Math.max(-1,Math.min(1,value)); v.setInt16(44+i*2,Math.round(x < 0 ? x*32768 : x*32767),true); });
  return bytes;
}

/** Prototype phonemizer. The learned fallback uses the same vocabulary as upstream;
 * English text normalization is simplified and may pronounce names differently. */
export class ParadeeEngine implements SpeechEngine {
  readonly info = PARADEE_INFO;
  private ort?: Ort;
  private phonemeSession?: InferenceSession;
  private voiceSession?: InferenceSession;
  private lexicon?: Lexicon;
  private config?: Config;
  async isInstalled() { return isParadeeInstalled(); }
  async install(options: Parameters<SpeechEngine['install']>[0]) { await installParadee(options); }
  async uninstall() { await this.dispose(); removeParadee(); }
  private async load() {
    if (this.voiceSession && this.phonemeSession && this.lexicon && this.config && this.ort) return;
    if (!isParadeeInstalled()) throw new Error('Download the voice in Settings first.');
    try {
      const native = NativeModules.Onnxruntime;
      if (!native || native.install() !== true || !(globalThis as {OrtApi?: unknown}).OrtApi) {
        throw new Error('The speech engine could not start on this device.');
      }
      this.ort = await import('onnxruntime-react-native');
    }
    catch (error) { throw new Error(error instanceof Error ? error.message : 'The speech engine could not start on this device.'); }
    this.lexicon = JSON.parse(strFromU8(gunzipSync(await paradeeFile('g2p.json.gz').bytes()))) as Lexicon;
    this.config = await paradeeFile('config.json').json() as Config;
    this.phonemeSession = await this.ort.InferenceSession.create(paradeeFile('g2p.onnx').uri);
    this.voiceSession = await this.ort.InferenceSession.create(paradeeFile('voice.onnx').uri);
  }
  private async phonemize(text:string, language:'en'|'hi', signal?:AbortSignal):Promise<string> {
    const ort=this.ort!, lexicon=this.lexicon!, session=this.phonemeSession!;
    const code=language==='en'?'en-us':'hi'; const entries=lexicon.lexicon[code];
    const digits=['zero','one','two','three','four','five','six','seven','eight','nine'];
    const hindiDigits=['शून्य','एक','दो','तीन','चार','पाँच','छह','सात','आठ','नौ'];
    const prepared=text.normalize('NFC').replace(/[०-९]/g,c=>String(c.charCodeAt(0)-'०'.charCodeAt(0))).replace(/\d/g,c=> language==='en' ? ` ${digits[Number(c)]} ` : ` ${hindiDigits[Number(c)]} `);
    const tokens=prepared.match(/[\p{L}\p{M}]+(?:['’][\p{L}\p{M}]+)*|[^\p{L}\p{M}\s]+|\s+/gu) ?? [];
    const index=new Map(lexicon.vocab.in.map((c,i)=>[c,i])); const idx=(c:string)=>index.get(c) ?? index.get('<unk>')!;
    const results:string[]=[];
    for (let pos=0;pos<tokens.length;pos++) {
      checkAbort(signal); const raw=tokens[pos];
      if (!/[\p{L}\p{M}]/u.test(raw)) {results.push(raw); continue;}
      const word=raw.toLowerCase();
      let result=entries.w[word];
      if (!result) {
        const row=[idx(`<${code}>`),idx('#'),idx('<s1>'),...Array.from(word).slice(0,60).map(idx),idx('<s2>'),idx('#')];
        const inputs={chars:new ort.Tensor('int64',BigInt64Array.from(row.map(BigInt)),[1,row.length]),pad:new ort.Tensor('bool',new Uint8Array(row.length),[1,row.length])};
        const prediction=await session.run(inputs); const data=prediction.best.data; let prev=0; let out='';
        for (let i=0;i<Math.min(data.length,row.length*3);i++) {const id=Number(data[i]); if (id!==prev && id!==0) out+=lexicon.vocab.out[id] ?? ''; prev=id;}
        result=out;
      }
      results.push(result);
    }
    return results.join('').replace(/[।॥]/g,'.');
  }
  async preparePhonemes(text:string, language:'en'|'hi', signal?:AbortSignal) {
    await this.load(); checkAbort(signal);
    return {phonemes:await this.phonemize(text,language,signal),vocab:this.config!.vocab};
  }
  async synthesize(request:SpeechRequest, signal?:AbortSignal):Promise<GeneratedSpeech> {
    if (!this.info.voices.some(voice => voice.id===request.voiceId && voice.languages.includes(request.language))) throw new Error('This voice does not support that language.');
    if (!request.text.trim()) throw new Error('There is no text to read.');
    await this.load(); checkAbort(signal);
    const ps=await this.phonemize(request.text,request.language==='en'?'en':'hi',signal);
    const vocab=this.config!.vocab; const chunks:string[]=[]; let chunk='';
    for (const word of ps.split(/\s+/)) { if (chunk && Array.from(chunk+' '+word).length>500) {chunks.push(chunk);chunk='';} chunk+=(chunk?' ':'')+word; }
    if (chunk) chunks.push(chunk);
    const rendered:Float32Array[]=[];
    for (const part of chunks) {
      checkAbort(signal); const ids=[0,...Array.from(part).filter(c=>c in vocab).map(c=>vocab[c]),0];
      if (ids.length>512) throw new Error('A word is too long to read.');
      const result=await this.voiceSession!.run({input_ids:new this.ort!.Tensor('int64',BigInt64Array.from(ids.map(BigInt)),[1,ids.length]),speed:new this.ort!.Tensor('float32',new Float32Array([request.rate ?? 1]),[1]),voice:new this.ort!.Tensor('int64',BigInt64Array.from([BigInt(VOICES.indexOf(request.voiceId))]),[1])});
      rendered.push(result.waveform.data as Float32Array);
    }
    checkAbort(signal); const joined=new Float32Array(rendered.reduce((sum,x)=>sum+x.length,0)); let offset=0; for (const part of rendered) {joined.set(part,offset);offset+=part.length;}
    const dir=new Directory(Paths.cache,'speech-output'); dir.create({idempotent:true,intermediates:true});
    const file=new File(dir,`speech-${Date.now()}-${Math.random().toString(36).slice(2)}.wav`); await file.write(wav(joined));
    return {uri:file.uri,dispose:async()=>{if(file.exists) file.delete();}};
  }
  async dispose() { await this.voiceSession?.release(); await this.phonemeSession?.release(); this.voiceSession=undefined; this.phonemeSession=undefined; this.lexicon=undefined; this.config=undefined; }
}
export const paradeeFactory = {info:PARADEE_INFO,create:async():Promise<SpeechEngine>=>new ParadeeEngine()};
