const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const code=ts.transpileModule(fs.readFileSync('src/speech/models.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const calls=[];
class Tensor {constructor(type,data,dims){Object.assign(this,{type,data,dims});}}
class File {constructor(base,name){this.uri=(base.uri??base)+'/'+name;}async bytes(){return new Uint8Array(522240);}async write(){}get exists(){return true;}delete(){}}
class Directory {constructor(base,name){this.uri=(base.uri??base)+'/'+name;}create(){}}
class ParadeeEngine {async preparePhonemes(){return {phonemes:'ab',vocab:{a:1,b:2}}}async dispose(){}}
const ort={Tensor,InferenceSession:{create:async uri=>({run:async inputs=>{calls.push({uri,inputs});return {waveform:{data:new Float32Array([0,0.5])}};},release:async()=>{}})}};
const imports={'expo-file-system':{File,Directory,Paths:{cache:'/cache'}},'react-native':{NativeModules:{Onnxruntime:{install:()=>{global.OrtApi={};return true;}}}},'./paradee/adapter':{ParadeeEngine,wav:()=>new Uint8Array(48)},'./paradee/storage':{isParadeeInstalled:()=>true,installParadee:async()=>{}},'./paradee/assets':{PARADEE_DOWNLOAD_BYTES:100},'./voiceLab':{voiceLabInstalled:()=>true,voiceLabBytes:()=>200,packDir:x=>({uri:`/${x}`})},'onnxruntime-react-native':ort};
const api={};new Function('require','exports',code)(name=>{if(!(name in imports))throw Error(name);return imports[name];},api);
const defaults=api.parseVoiceSelections();assert.equal(defaults.en.model,'paradee');assert.equal(defaults.sa.voiceId,'hf_alpha');
const saved=api.parseVoiceSelections(JSON.stringify({en:{model:'kokoro',voiceId:'am_puck',rate:1.2},sa:{model:'ninada',voiceId:'female',rate:0.8,expressiveness:0.4},hi:{model:'ninada',voiceId:'female',rate:9}}));
assert.equal(saved.en.voiceId,'am_puck');assert.equal(saved.en.rate,1.2);assert.equal(saved.sa.model,'ninada');assert.equal(saved.sa.expressiveness,0.4);assert.equal(saved.hi.model,'paradee');assert.equal(saved.hi.rate,1);
const expected=JSON.parse(fs.readFileSync('src/speech/voiceLabInputs.ts','utf8').match(/= (.*) as const/)[1]).sanskrit;
assert.deepEqual(api.ninadaSanskritIds('धर्मक्षेत्रे कुरुक्षेत्रे समवेता युयुत्सवः।'),expected);
assert.throws(()=>api.ninadaSanskritIds('☃'),/Unsupported/);
(async()=>{
 const kokoro=api.createVoiceModel('kokoro');await kokoro.synthesize({text:'one',language:'en',voiceId:'am_puck',rate:1.2});assert.equal(calls[0].inputs.speed.data[0].toFixed(1),'1.2');assert.deepEqual(Array.from(calls[0].inputs.input_ids.data),[0n,1n,2n,0n]);
 const ninada=api.createVoiceModel('ninada');await ninada.synthesize({text:'धर्मक्षेत्रे',language:'sa',voiceId:'female',rate:0.8,expressiveness:0.4});assert.match(calls[1].uri,/female\.onnx$/);assert.equal(calls[1].inputs.scales.data[0],1.25);assert.equal(calls[1].inputs.scales.data[1].toFixed(1),'0.4');
 await assert.rejects(()=>kokoro.synthesize({text:'test',language:'sa',voiceId:'hf_alpha'}),/does not support/);await kokoro.dispose();await ninada.dispose();console.log('PASS: voice preferences, Sanskrit tokenization, model inputs and voice settings');
})().catch(error=>{console.error(error);process.exitCode=1;});
