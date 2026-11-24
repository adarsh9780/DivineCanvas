import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { SegmentedControl } from '@expo/ui/community/segmented-control';
import { useAudioPlayer } from 'expo-audio';
import Slider from '@react-native-community/slider';
import { SymbolView } from 'expo-symbols';
import * as Haptics from 'expo-haptics';
import * as Network from 'expo-network';
import { networkOffline, voiceDownloadState, type VoiceDownloadResult } from './speech/voiceDownloadState';
import { useAppLanguage } from './AppLanguage';
import { configureReadingAudio } from './readingAudioSession';
import type { Palette } from './readingAppearance';
import type { GeneratedSpeech, SpeechLanguage } from './speech/engine';
import { modelDownloadBytes, modelInstalled, modelStorageBytes, modelVoices, voiceSpeeds, type VoiceModel, type VoiceSelections } from './speech/models';
import { voiceLabInstalled } from './speech/voiceLab';

const langs:SpeechLanguage[]=['en','hi','sa'];
const models:VoiceModel[]=['paradee','kokoro','ninada'];
const speeds=voiceSpeeds;
const samples:Record<SpeechLanguage,string>={en:'Tell me Sanjaya, what did my sons do?',hi:'धर्मक्षेत्र में एकत्र हुए मेरे पुत्रों ने क्या किया',sa:'धर्मक्षेत्रे कुरुक्षेत्रे समवेता युयुत्सवः।'};
const titles:Record<VoiceModel,string>={paradee:'Paradee 8M',kokoro:'Kokoro 82M',ninada:'Ninada'};
type Gender='Female'|'Male';
const bundledSamples:Record<VoiceModel,Partial<Record<SpeechLanguage,Record<Gender,number>>>>={
  paradee:{en:{Female:require('../assets/voice-samples/paradee-en.mp3'),Male:require('../assets/voice-samples/paradee-en-male.mp3')},hi:{Female:require('../assets/voice-samples/paradee-hi.mp3'),Male:require('../assets/voice-samples/paradee-hi-male.mp3')},sa:{Female:require('../assets/voice-samples/paradee-sa.mp3'),Male:require('../assets/voice-samples/paradee-sa-male.mp3')}},
  kokoro:{en:{Female:require('../assets/voice-samples/kokoro-en.mp3'),Male:require('../assets/voice-samples/kokoro-en-male.mp3')},hi:{Female:require('../assets/voice-samples/kokoro-hi.mp3'),Male:require('../assets/voice-samples/kokoro-hi-male.mp3')}},
  ninada:{sa:{Male:require('../assets/voice-samples/ninada-sa.mp3'),Female:require('../assets/voice-samples/ninada-sa-female.mp3')}},
};
const haptic=()=>{void Haptics.selectionAsync().catch(()=>{});};
const mb=(n:number)=>(n/1000000).toFixed(1)+' MB';
const formatRate=(n:number)=>Number.isInteger(n)?n.toFixed(1):String(n);
const closestSpeed=(value:number)=>speeds.reduce((best,rate,i)=>Math.abs(rate-value)<Math.abs(speeds[best]-value)?i:best,0);

type Props={colors:Palette;selections:VoiceSelections;onChange:(v:VoiceSelections)=>void;onDownload:(m:VoiceModel,quiet?:boolean)=>Promise<VoiceDownloadResult>;onRemove:(m:VoiceModel)=>Promise<void>;onPreview:(m:VoiceModel,l:SpeechLanguage,text:string,voiceId:string)=>Promise<GeneratedSpeech>;downloading:VoiceModel|null;progress:number|null;onCancel:()=>void;revision:number};
export function VoiceModels({colors,selections,onChange,onDownload,onRemove,onPreview,downloading,progress,onCancel,revision}:Props) {
  const {appLanguage}=useAppLanguage();const hi=appLanguage==='hi';
  const [busy,setBusy]=useState<string|null>(null);const [playing,setPlaying]=useState<string|null>(null);
  const [pending,setPending]=useState<{model:VoiceModel;lang:SpeechLanguage}|null>(null);const [failed,setFailed]=useState<Partial<Record<VoiceModel,boolean>>>({});const selectionInFlight=useRef(false);const network=Network.useNetworkState();const offline=networkOffline(network);const [showDownloads,setShowDownloads]=useState(false);
  const player=useAudioPlayer(null);const alive=useRef(true);const current=useRef<GeneratedSpeech|null>(null);
  useEffect(()=>{alive.current=true;const listener=player.addListener('playbackStatusUpdate',event=>{if(event.didJustFinish)setPlaying(null);});return()=>{alive.current=false;listener.remove();player.pause();const file=current.current;if(file)setTimeout(()=>void file.dispose().catch(()=>{}),30000);};},[player]);
  const label=(lang:SpeechLanguage)=>lang==='en'?(hi?'अंग्रेज़ी':'English'):lang==='hi'?(hi?'हिन्दी':'Hindi'):(hi?'संस्कृत':'Sanskrit');
  const detail={fontSize:14,lineHeight:20,color:colors.muted};const action={color:colors.accent,fontSize:15,fontWeight:'600' as const};
  const stop=()=>{player.pause();setPlaying(null);};
  async function play(model:VoiceModel,lang:SpeechLanguage,configured=false) {
    const key=configured?`${lang}-current`:`${model}-${lang}`;if(playing===key){stop();return;}
    stop();setBusy(key);
    try {
      const choice=selections[lang];const gender=(modelVoices[choice.model][lang].find(v=>v.id===choice.voiceId)?.name ?? 'Female') as Gender;const target=modelVoices[model][lang].find(v=>v.name===gender);if(!target)throw new Error('Sample unavailable.');
      if(!modelInstalled(model)){const source=bundledSamples[model][lang]?.[gender];if(!source)throw new Error('Sample unavailable.');await configureReadingAudio(false);player.replace(source);player.play();setPlaying(key);return;}
      const file=await onPreview(model,lang,samples[lang],target.id);if(!alive.current){await file.dispose();return;}
      const old=current.current;current.current=file;await configureReadingAudio(false);player.replace({uri:file.uri});player.play();setPlaying(key);if(old)setTimeout(()=>void old.dispose().catch(()=>{}),30000);
    } catch(error){if(alive.current)Alert.alert(hi?'नमूना नहीं चल सका':'Could not play sample',error instanceof Error?error.message:(hi?'फिर प्रयास करें।':'Please try again.'));}
    finally {if(alive.current)setBusy(null);}
  }
  async function selectModel(model:VoiceModel,lang:SpeechLanguage) {
    if(downloading || busy || selectionInFlight.current)return;
    const choice=selections[lang];const gender=modelVoices[choice.model][lang].find(v=>v.id===choice.voiceId)?.name ?? 'Female';const voice=modelVoices[model][lang].find(v=>v.name===gender);if(!voice)return;
    haptic();stop();
    if(!modelInstalled(model)){
      if(offline)return;
      selectionInFlight.current=true;setPending({model,lang});setFailed(v=>({...v,[model]:false}));
      try {const result=await onDownload(model,true);if(result==='failed'){if(alive.current)setFailed(v=>({...v,[model]:true}));return;}if(result==='offline'){if(alive.current)Alert.alert(hi?'इंटरनेट से जुड़ें':'Connect to download');return;}if(result!=='success')return;}
      finally {selectionInFlight.current=false;if(alive.current)setPending(null);}
    }
    if(alive.current && choice.model!==model)onChange({...selections,[lang]:{...choice,model,voiceId:voice.id}});
  }
  function confirmRemove(model:VoiceModel) {
    if(model==='paradee' && voiceLabInstalled('kokoro')){Alert.alert(hi?'Paradee आवश्यक है':'Paradee is required',hi?'Kokoro को Paradee की उच्चारण फ़ाइलें चाहिए। पहले Kokoro हटाएँ।':'Kokoro uses Paradee’s pronunciation files. Remove Kokoro first.');return;}
    const affected=langs.filter(lang=>selections[lang].model===model).map(label).join(', ');
    const size=mb(modelStorageBytes(model));
    const shared=model==='kokoro'?(hi?' Paradee की साझा फ़ाइलें रहेंगी।':' Shared Paradee files will remain.') : '';
    const warning=affected?(hi?` ${affected} के लिए इसे फिर डाउनलोड करना होगा।`:` ${affected} will need this model downloaded again.`):'';
    Alert.alert(hi?'डाउनलोड हटाएँ?':'Remove download?',`${titles[model]} · ${size}${shared}${warning}`,[{text:hi?'रद्द करें':'Cancel',style:'cancel'},{text:hi?'हटाएँ':'Remove',style:'destructive',onPress:()=>{stop();void onRemove(model);}}]);
  }
  return <View style={{gap:20,paddingVertical:24}}>
    <View style={{gap:5}}><Text accessibilityRole="header" style={{fontSize:17,fontWeight:'600',color:colors.ink}}>{hi?'आवाज़ें':'Voices'}</Text><Text style={detail}>{hi?'हर भाषा के लिए मॉडल चुनें। डाउनलोड से पहले नमूना सुनें।':'Choose a model for each language. Listen before downloading.'}</Text></View>
    {langs.map(lang=>{const choice=selections[lang];const options=models.filter(model=>modelVoices[model][lang].length);const voices=modelVoices[choice.model][lang];const available=revision>=0 && modelInstalled(choice.model);const speedIndex=closestSpeed(choice.rate);const gender=(voices.find(v=>v.id===choice.voiceId)?.name ?? 'Female') as Gender;return <View key={lang} style={{gap:12,padding:16,borderRadius:14,backgroundColor:colors.white,borderWidth:1,borderColor:colors.line}}>
      <Text accessibilityRole="header" style={{fontSize:17,fontWeight:'600',color:colors.ink}}>{label(lang)}</Text>
      <View style={{gap:6}}><Text style={{fontSize:15,color:colors.ink}}>{hi?'आवाज़':'Voice'}</Text><SegmentedControl accessibilityLabel={`${label(lang)} ${hi?'आवाज़':'voice'}`} values={hi?['महिला','पुरुष']:['Female','Male']} selectedIndex={gender==='Female'?0:1} enabled={!downloading && !pending} appearance={colors.dark?'dark':'light'} onChange={event=>{const name=event.nativeEvent.selectedSegmentIndex===0?'Female':'Male';const voice=voices.find(v=>v.name===name);if(voice && voice.id!==choice.voiceId){haptic();stop();onChange({...selections,[lang]:{...choice,voiceId:voice.id}});}}}/></View>
      {options.map(model=>{const installed=modelInstalled(model),selected=choice.model===model,key=`${model}-${lang}`;const state=voiceDownloadState(installed,downloading===model || pending?.model===model,progress,!!failed[model],modelDownloadBytes(model));const blocked=!!downloading || !!pending || !!busy || (offline && state.kind!=='downloaded');const size=mb(state.kind==='notDownloaded'||state.kind==='failed'?state.bytes:modelStorageBytes(model));
        const subtitle=state.kind==='downloading'?`${hi?'डाउनलोड हो रहा है':'Downloading'} ${Math.round(state.progress*100)}%`:state.kind==='downloaded'?`${size} · ${hi?'डाउनलोड किया गया':'Downloaded'}`:offline?(hi?'डाउनलोड के लिए इंटरनेट से जुड़ें':'Connect to download'):state.kind==='failed'?(hi?'डाउनलोड विफल · फिर प्रयास करें':'Download failed · Retry'):`${hi?'डाउनलोड नहीं किया गया':'Not downloaded'} · ${size}`;
        return <View key={model} style={{flexDirection:'row',alignItems:'center',gap:8}}>
          <Pressable accessibilityRole="radio" accessibilityState={{checked:selected,disabled:blocked}} accessibilityLabel={`${titles[model]}, ${subtitle}${state.kind==='notDownloaded'&&!offline?'. Double tap to download and select.':''}`} disabled={blocked} onPress={()=>void selectModel(model,lang)} style={{flex:1,minHeight:56,flexDirection:'row',alignItems:'center',gap:10}}>
            <SymbolView name={{ios:selected?'largecircle.fill.circle':'circle',android:selected?'radio_button_checked':'radio_button_unchecked',web:selected?'radio_button_checked':'radio_button_unchecked'}} size={22} tintColor={selected?colors.accent:colors.muted}/>
            <View style={{flex:1,gap:2}}><Text style={{fontSize:15,fontWeight:selected?'600':'400',color:colors.ink}}>{titles[model]}</Text><Text style={detail}>{subtitle}</Text>{state.kind==='downloading' && <View accessibilityRole="progressbar" accessibilityValue={{min:0,max:100,now:Math.round(state.progress*100)}} style={{height:3,backgroundColor:colors.line,borderRadius:2,overflow:'hidden',marginTop:3}}><View style={{height:3,width:`${Math.round(state.progress*100)}%`,backgroundColor:colors.accent}}/></View>}</View>
            {state.kind==='notDownloaded' && !offline && <SymbolView name={{ios:'arrow.down.circle',android:'download',web:'download'}} size={19} tintColor={colors.muted}/>}
          </Pressable>
          {state.kind==='downloading' && downloading===model?<Pressable accessibilityRole="button" accessibilityLabel={`${hi?'डाउनलोड रद्द करें':'Cancel download'} ${titles[model]}`} onPress={onCancel} style={{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center'}}><Text style={action}>×</Text></Pressable>:<Pressable accessibilityRole="button" accessibilityLabel={`${playing===key?'Stop':'Play'} ${label(lang)} ${gender} sample with ${titles[model]}`} disabled={!!downloading || !!pending || !!busy} onPress={()=>void play(model,lang)} style={{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center'}}>{busy===key?<ActivityIndicator color={colors.accent}/>:<SymbolView name={{ios:playing===key?'stop.circle':'play.circle',android:playing===key?'stop_circle':'play_circle',web:playing===key?'stop_circle':'play_circle'}} size={25} tintColor={colors.accent}/>}</Pressable>}
        </View>;})}
      {choice.model==='paradee' && lang==='sa' && <Text style={detail}>{hi?'संस्कृत में हिन्दी उच्चारण का उपयोग होता है।':'Sanskrit uses Hindi pronunciation.'}</Text>}
      <View style={{height:1,backgroundColor:colors.line}}/>
      <View style={{gap:3,opacity:available?1:0.5}}><View style={{flexDirection:'row',justifyContent:'space-between'}}><Text style={{fontSize:15,color:colors.ink}}>{hi?'गति':'Speed'}</Text><Text style={detail}>{formatRate(choice.rate)}×</Text></View><Slider disabled={!available || !!downloading} accessibilityLabel={`${label(lang)} ${hi?'गति':'speed'}`} accessibilityValue={{min:0.5,max:2,now:choice.rate,text:`${formatRate(choice.rate)} ${hi?'गुना':'times'}`}} minimumValue={0} maximumValue={speeds.length-1} step={1} value={speedIndex} onValueChange={index=>{const rate=speeds[Math.round(index)];if(rate!==undefined && rate!==choice.rate){haptic();stop();onChange({...selections,[lang]:{...choice,rate}});}}} minimumTrackTintColor={colors.accent} maximumTrackTintColor={colors.line} thumbTintColor={colors.accent}/><View style={{flexDirection:'row',justifyContent:'space-between'}}><Text style={detail}>0.5×</Text><Text style={detail}>2.0×</Text></View></View>
      {choice.model==='ninada' && <View style={{gap:3,opacity:available?1:0.5}}><View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}><Text style={{fontSize:15,color:colors.ink}}>{hi?'आवाज़ में विविधता':'Voice variation'} · {Math.round(choice.expressiveness*100)}%</Text><Pressable accessibilityRole="button" disabled={!available || !!downloading} onPress={()=>{haptic();stop();onChange({...selections,[lang]:{...choice,expressiveness:0.667}});}} style={{minHeight:44,justifyContent:'center'}}><Text style={action}>{hi?'डिफ़ॉल्ट':'Default'}</Text></Pressable></View><Text style={detail}>{hi?'Ninada में आवाज़ की विविधता बदल सकते हैं।':'Ninada supports voice variation; higher values add variety.'}</Text><Slider disabled={!available || !!downloading} accessibilityLabel={`${label(lang)} ${hi?'आवाज़ में विविधता':'voice variation'}`} accessibilityValue={{min:0,max:100,now:Math.round(choice.expressiveness*100),text:`${Math.round(choice.expressiveness*100)}%`}} minimumValue={0} maximumValue={1} step={0.1} value={choice.expressiveness} onValueChange={value=>{const v=Number(value.toFixed(1));if(v!==choice.expressiveness){haptic();stop();onChange({...selections,[lang]:{...choice,expressiveness:v}});}}} minimumTrackTintColor={colors.accent} maximumTrackTintColor={colors.line} thumbTintColor={colors.accent}/></View>}
      <Pressable accessibilityRole="button" accessibilityLabel={`${playing===`${lang}-current`?'Stop':'Preview'} ${label(lang)} ${titles[choice.model]} ${gender} ${formatRate(choice.rate)} times`} accessibilityState={{disabled:!available || !!busy || !!downloading || !!pending}} disabled={!available || !!busy || !!downloading || !!pending} onPress={()=>void play(choice.model,lang,true)} style={{minHeight:44,alignSelf:'flex-start',justifyContent:'center',opacity:available?1:0.5}}><Text style={action}>{playing===`${lang}-current`?'■':'▶'} {hi?'नमूना सुनें':'Preview'} {titles[choice.model]} · {gender} · {formatRate(choice.rate)}×</Text></Pressable>
    </View>;})}
    <View style={{gap:8}}><Pressable accessibilityRole="button" accessibilityState={{expanded:showDownloads}} onPress={()=>setShowDownloads(v=>!v)} style={{minHeight:44,flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><Text accessibilityRole="header" style={{fontSize:17,fontWeight:'600',color:colors.ink}}>{hi?'डाउनलोड प्रबंधित करें':'Manage downloads'}</Text><Text style={action}>{showDownloads?'−':'+'}</Text></Pressable>
      {showDownloads && models.map(model=>{const bytes=modelStorageBytes(model);return <View key={model} style={{minHeight:56,flexDirection:'row',alignItems:'center',gap:12,borderBottomWidth:1,borderColor:colors.line}}><View style={{flex:1}}><Text style={{fontSize:15,color:colors.ink}}>{titles[model]}</Text><Text style={detail}>{bytes?`${mb(bytes)} ${hi?'हटाई जा सकती है':'removable'}`:(hi?'डाउनलोड नहीं किया गया':'Not downloaded')}</Text></View>{bytes>0 && <Pressable accessibilityRole="button" accessibilityLabel={`${hi?'हटाएँ':'Remove'} ${titles[model]}`} disabled={!!downloading || !!busy} onPress={()=>confirmRemove(model)} style={{minHeight:44,justifyContent:'center'}}><Text style={action}>{hi?'हटाएँ':'Remove'}</Text></Pressable>}</View>;})}
    </View>
  </View>;
}
