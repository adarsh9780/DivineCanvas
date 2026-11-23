import { Directory, File, Paths } from 'expo-file-system';
import { NativeModules } from 'react-native';
import { wav } from './paradee/adapter';
import { sampleInputs } from './voiceLabInputs';

export type VoiceLabPack = 'kokoro' | 'ninada';
export type VoiceLabSample = 'english' | 'hindi' | 'sanskrit';
type Asset = {name:string; url:string; sha256:string; size:number};
const kokoroRevision='1939ad2a8e416c0acfeecc08a694d14ef25f2231';
const ninadaRevision='25143ee2842dd7bd9e2955b94797d43590ca676e';
const kokoroBase=`https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/${kokoroRevision}`;
const ninadaBase=`https://huggingface.co/gnumanth/ninada/resolve/${ninadaRevision}`;
export const voiceLabAssets:Record<VoiceLabPack,readonly Asset[]> = {
  kokoro:[
    {name:'model.onnx',url:`${kokoroBase}/onnx/model_quantized.onnx`,size:92361116,sha256:'fbae9257e1e05ffc727e951ef9b9c98418e6d79f1c9b6b13bd59f5c9028a1478'},
    {name:'english.bin',url:`${kokoroBase}/voices/af_heart.bin`,size:522240,sha256:'d583ccff3cdca2f7fae535cb998ac07e9fcb90f09737b9a41fa2734ec44a8f0b'},
    {name:'hindi.bin',url:`${kokoroBase}/voices/hf_alpha.bin`,size:522240,sha256:'040be6a4425411cc01fda5fd06693c76bfa78572632852bc8cda9c99232ffb56'},
    {name:'english-male.bin',url:`${kokoroBase}/voices/am_puck.bin`,size:522240,sha256:'fcf73c989033e9233e0b98713eca600c8c74dcc1614b37009d5450ff4a2274a0'},
    {name:'hindi-male.bin',url:`${kokoroBase}/voices/hm_omega.bin`,size:522240,sha256:'b02d9222d9ed00ce26b302173a862c2c93f96cc40b5c422b8d14910b9ff34137'},
  ],
  ninada:[{name:'model.onnx',url:`${ninadaBase}/onnx/sa.onnx`,size:29288386,sha256:'4e5b9aa10c53fb76959dbec03fb1dc014cc704435f8dffabf7a923056abcd1b6'}, {name:'female.onnx',url:`${ninadaBase}/onnx/sa_female.onnx`,size:29288386,sha256:'580f7c776cddbbb5721817bee201835fe9b2d3328cc0e078a59c07bf66b7e898'}],
};
const root=()=>new Directory(Paths.document,'voice-comparison');
export const packDir=(pack:VoiceLabPack)=>new Directory(root(),pack);
export const voiceLabBytes=(pack:VoiceLabPack)=>voiceLabAssets[pack].reduce((n,a)=>n+a.size,0);
export function voiceLabInstalled(pack:VoiceLabPack) {const dir=packDir(pack);return dir.exists && new File(dir,'verified.json').exists && voiceLabAssets[pack].every(a=>new File(dir,a.name).exists);}
export async function downloadVoiceLab(pack:VoiceLabPack,signal:AbortSignal,onProgress:(n:number)=>void) {
  const staging=new Directory(root(),`${pack}-tmp-${Date.now()}`); let moved=false;
  try {
    root().create({idempotent:true,intermediates:true});staging.create({intermediates:true});let done=0;
    for (const asset of voiceLabAssets[pack]) {
      const existing=new File(packDir(pack),asset.name);
      const fileInStage=new File(staging,asset.name);
      let file:File|undefined;
      if (existing.exists && existing.size===asset.size && await existing.digest('SHA-256')===asset.sha256) {await existing.copy(fileInStage);file=fileInStage;}
      else {const task=File.createDownloadTask(asset.url,fileInStage,{signal,onProgress:({bytesWritten})=>onProgress((done+bytesWritten)/voiceLabBytes(pack))});file=await task.downloadAsync() ?? undefined;}
      if (!file || signal.aborted) throw new Error('Download cancelled.');
      if (file.size!==asset.size || await file.digest('SHA-256')!==asset.sha256) throw new Error('Download verification failed.');
      done+=asset.size;onProgress(done/voiceLabBytes(pack));
    }
    await new File(staging,'verified.json').write(JSON.stringify({pack,revision:pack==='kokoro'?kokoroRevision:ninadaRevision}));
    const dest=packDir(pack);if(dest.exists) dest.delete();await staging.move(dest);moved=true;
  } finally {if(!moved && staging.exists) staging.delete();}
}
export function removeVoiceLab(pack:VoiceLabPack) {const dir=packDir(pack);if(dir.exists) dir.delete();}
export async function generateVoiceLab(sample:VoiceLabSample):Promise<File> {
  const pack:VoiceLabPack=sample==='sanskrit'?'ninada':'kokoro';
  if (!voiceLabInstalled(pack)) throw new Error('Download the voice first.');
  if (!NativeModules.Onnxruntime || NativeModules.Onnxruntime.install()!==true || !(globalThis as {OrtApi?:unknown}).OrtApi) throw new Error('The speech engine is unavailable.');
  const ort=await import('onnxruntime-react-native');
  const session=await ort.InferenceSession.create(new File(packDir(pack),'model.onnx').uri);
  try {
    const ids=sampleInputs[sample];
    const inputs:Record<string,InstanceType<typeof ort.Tensor>>={input_ids:new ort.Tensor('int64',BigInt64Array.from(ids.map(BigInt)),[1,ids.length])};
    if(pack==='kokoro') {
      const bytes=await new File(packDir(pack),`${sample}.bin`).bytes();
      const offset=Math.min(ids.length-2,509)*256*4;
      const style=new Float32Array(256);const data=new DataView(bytes.buffer,bytes.byteOffset+offset,1024);
      for(let i=0;i<256;i++) style[i]=data.getFloat32(i*4,true);
      inputs.style=new ort.Tensor('float32',style,[1,256]);inputs.speed=new ort.Tensor('float32',new Float32Array([1]),[1]);
    } else inputs.scales=new ort.Tensor('float32',new Float32Array([1,0.667,0.8]),[3]);
    const result=await session.run(inputs);const samples=result.waveform.data as Float32Array;
    if(!samples.length || !samples.every(Number.isFinite)) throw new Error('The voice produced invalid audio.');
    const folder=new Directory(Paths.cache,'voice-comparison');folder.create({idempotent:true,intermediates:true});
    const output=new File(folder,`${sample}-${Date.now()}.wav`);await output.write(wav(samples));return output;
  } finally {await session.release();}
}
