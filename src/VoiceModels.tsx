import { downloadProgressLabel } from './downloadProgress';
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

type Props={colors:Palette;selections:VoiceSelections;onChange:(v:VoiceSelections)=>void;onDownload:(m:VoiceModel,quiet?:boolean)=>Promise<VoiceDownloadResult>;onPreview:(m:VoiceModel,l:SpeechLanguage,text:string,voiceId:string)=>Promise<GeneratedSpeech>;downloading:VoiceModel|null;progress:number|null;onCancel:()=>void;revision:number};
export function VoiceModels({colors,selections,onChange,onDownload,onPreview,downloading,progress,onCancel,revision}:Props) {
  const {appLanguage}=useAppLanguage();const hi=appLanguage==='hi';
  const [busy,setBusy]=useState<string|null>(null);const [playing,setPlaying]=useState<string|null>(null);
  const [pending,setPending]=useState<{model:VoiceModel;lang:SpeechLanguage}|null>(null);const [failed,setFailed]=useState<Partial<Record<VoiceModel,boolean>>>({});const selectionInFlight=useRef(false);const network=Network.useNetworkState();const offline=networkOffline(network);
  const player=useAudioPlayer(null);const alive=useRef(true);const current=useRef<GeneratedSpeech|null>(null);
  useEffect(()=>{alive.current=true;const listener=player.addListener('playbackStatusUpdate',event=>{if(event.didJustFinish)setPlaying(null);});return()=>{alive.current=false;listener.remove();player.pause();const file=current.current;if(file)setTimeout(()=>void file.dispose().catch(()=>{}),30000);};},[player]);
  const label=(lang:SpeechLanguage)=>lang==='en'?(hi?'अंग्रेज़ी':'English'):lang==='hi'?(hi?'हिन्दी':'Hindi'):(hi?'संस्कृत':'Sanskrit');
  const detail={fontSize:14,lineHeight:20,color:colors.muted};const action={color:colors.accent,fontSize:15,fontWeight:'600' as const};
  const stop=()=>{player.pause();setPlaying(null);};
  async function play(model:VoiceModel,lang:SpeechLanguage,configured=false) {
    const key=configured?`${lang}-${model}-current`:`${model}-${lang}`;if(playing===key){stop();return;}
    stop();setBusy(key);
    try {
      const choice=selections[lang];const gender=(modelVoices[choice.model][lang].find(v=>v.id===choice.voiceId)?.name ?? 'Female') as Gender;const target=modelVoices[model][lang].find(v=>v.name===gender);if(!target)throw new Error('Sample unavailable.');
      if(!modelInstalled(model)){const source=bundledSamples[model][lang]?.[gender];if(!source)throw new Error('Sample unavailable.');await configureReadingAudio(false);player.replace(source);player.play();setPlaying(key);return;}
      const file=await onPreview(model,lang,samples[lang],target.id);if(!alive.current){await file.dispose();return;}
      const old=current.current;current.current=file;await configureReadingAudio(false);player.replace({uri:file.uri});player.play();setPlaying(key);if(old)setTimeout(()=>void old.dispose().catch(()=>{}),30000);
    } catch(error){if(alive.current)Alert.alert(hi?'नमूना नहीं चल सका':'Could not play sample',error instanceof Error?error.message:(hi?'फिर प्रयास करें।':'Please try again.'));}
    finally {if(alive.current)setBusy(null);}
  }
  async function selectModel(model:VoiceModel,lang:SpeechLanguage,select=true) {
    if(downloading || busy || selectionInFlight.current)return;
    const choice=selections[lang];const gender=modelVoices[choice.model][lang].find(v=>v.id===choice.voiceId)?.name ?? 'Female';const voice=modelVoices[model][lang].find(v=>v.name===gender);if(!voice)return;
    haptic();
    if(!modelInstalled(model)){
      if(offline)return;
      stop();
      selectionInFlight.current=true;setPending({model,lang});setFailed(v=>({...v,[model]:false}));
      try {const result=await onDownload(model,true);if(result==='failed'){if(alive.current)setFailed(v=>({...v,[model]:true}));return;}if(result==='offline'){if(alive.current)Alert.alert(hi?'इंटरनेट से जुड़ें':'Connect to download');return;}if(result!=='success')return;}
      finally {selectionInFlight.current=false;if(alive.current)setPending(null);}
    }
    if(!alive.current || !select)return;
    if(choice.model!==model)onChange({...selections,[lang]:{...choice,model,voiceId:voice.id}});
    await play(model,lang,true);
  }
  return <View style={{gap:20,paddingVertical:24}}>
    <View style={{gap:5}}><Text accessibilityRole="header" style={{fontSize:17,fontWeight:'600',color:colors.ink}}>{hi?'आवाज़ें':'Voices'}</Text><Text style={detail}>{hi?'मॉडल चुनने पर उसका नमूना अपने आप बजेगा। डाउनलोड से पहले भी नमूना सुन सकते हैं।':'Selecting a model plays its sample automatically. You can also listen before downloading.'}</Text></View>
    {langs.map(lang=>{const choice=selections[lang];const options=models.filter(model=>modelVoices[model][lang].length);const voices=modelVoices[choice.model][lang];const available=revision>=0 && modelInstalled(choice.model);const previewKey=`${lang}-${choice.model}-current`;const loadingPreview=busy===previewKey;const playingPreview=playing===previewKey;const controlsDisabled=!available || !!downloading || !!pending || !!busy;const gender=(voices.find(v=>v.id===choice.voiceId)?.name ?? 'Female') as Gender;return <View key={lang} style={{gap:12,padding:16,borderRadius:14,backgroundColor:colors.white,borderWidth:1,borderColor:colors.line}}>
      <Text accessibilityRole="header" style={{fontSize:17,fontWeight:'600',color:colors.ink}}>{label(lang)}</Text>
      <View style={{gap:6}}><Text style={{fontSize:15,color:colors.ink}}>{hi?'आवाज़':'Voice'}</Text><SegmentedControl accessibilityLabel={`${label(lang)} ${hi?'आवाज़':'voice'}`} values={hi?['महिला','पुरुष']:['Female','Male']} selectedIndex={gender==='Female'?0:1} enabled={!downloading && !pending && !busy} appearance={colors.dark?'dark':'light'} onChange={event=>{const name=event.nativeEvent.selectedSegmentIndex===0?'Female':'Male';const voice=voices.find(v=>v.name===name);if(voice && voice.id!==choice.voiceId){haptic();stop();onChange({...selections,[lang]:{...choice,voiceId:voice.id}});}}}/></View>
      {options.map(model=>{const installed=modelInstalled(model),selected=choice.model===model,key=`${model}-${lang}`;const state=voiceDownloadState(installed,downloading===model || pending?.model===model,progress,!!failed[model],modelDownloadBytes(model));const blocked=!!downloading || !!pending || !!busy || (offline && state.kind!=='downloaded');const size=mb(state.kind==='notDownloaded'||state.kind==='failed'?state.bytes:modelStorageBytes(model));
        const subtitle=state.kind==='downloading'?downloadProgressLabel(state.progress,hi):state.kind==='downloaded'?`${size} · ${hi?'डाउनलोड किया गया':'Downloaded'}`:offline?(hi?'डाउनलोड के लिए इंटरनेट से जुड़ें':'Connect to download'):state.kind==='failed'?(hi?'डाउनलोड विफल · फिर प्रयास करें':'Download failed · Retry'):`${hi?'डाउनलोड नहीं किया गया':'Not downloaded'} · ${size}`;
        return <View key={model} style={{flexDirection:'row',alignItems:'center',gap:8}}>
          <Pressable accessibilityRole="radio" accessibilityState={{checked:selected,disabled:blocked}} accessibilityLabel={`${titles[model]}, ${subtitle}${state.kind==='notDownloaded'&&!offline?'. Double tap to download and select.':''}`} disabled={blocked} onPress={()=>void selectModel(model,lang)} style={{flex:1,minHeight:56,flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:6}}>
            <SymbolView name={{ios:selected?'largecircle.fill.circle':'circle',android:selected?'radio_button_checked':'radio_button_unchecked',web:selected?'radio_button_checked':'radio_button_unchecked'}} size={22} tintColor={selected?colors.accent:colors.muted}/>
            <View style={{flex:1,gap:2}}><Text style={{fontSize:15,fontWeight:selected?'600':'400',color:installed?colors.ink:colors.muted}}>{titles[model]}</Text><Text style={detail}>{subtitle}</Text>{state.kind==='downloading' && <View accessibilityRole="progressbar" accessibilityValue={{min:0,max:100,now:Math.round(state.progress*100)}} style={{height:3,backgroundColor:colors.line,borderRadius:2,overflow:'hidden',marginTop:3}}><View style={{height:3,width:`${Math.round(state.progress*100)}%`,backgroundColor:colors.accent}}/></View>}</View>
          </Pressable>
          {state.kind==='downloading' && downloading===model ? (
            <Pressable accessibilityRole="button" accessibilityLabel={hi?'डाउनलोड रद्द करें':'Cancel download'} onPress={onCancel} style={{width:44,minHeight:44,alignItems:'center',justifyContent:'center'}}><Text style={action}>×</Text></Pressable>
          ) : !installed && <Pressable accessibilityRole="button" accessibilityLabel={`${hi?'डाउनलोड करें':'Download'} ${titles[model]} · ${size}`} disabled={blocked} onPress={()=>void selectModel(model,lang,false)} style={{width:44,minHeight:44,alignItems:'center',justifyContent:'center',opacity:blocked?0.45:1}}>
            <SymbolView name={{ios:'arrow.down.circle',android:'download',web:'download'}} size={25} tintColor={colors.accent}/>
          </Pressable>}
          <Pressable accessibilityRole="button" accessibilityLabel={`${playing===key?(hi?'नमूना रोकें':'Stop sample'):(hi?'नमूना सुनें':'Play sample')} · ${label(lang)} · ${titles[model]}`} accessibilityState={{busy:busy===key,disabled:!!downloading || !!pending || !!busy}} disabled={!!downloading || !!pending || !!busy} onPress={()=>void play(model,lang)} style={{width:44,minHeight:44,alignItems:'center',justifyContent:'center'}}>
            {busy===key?<ActivityIndicator color={colors.accent}/>:<SymbolView name={{ios:playing===key?'stop.circle':'play.circle',android:playing===key?'stop_circle':'play_circle',web:playing===key?'stop_circle':'play_circle'}} size={25} tintColor={colors.accent}/>}
          </Pressable>
        </View>;})}
      {choice.model==='paradee' && lang==='sa' && <Text style={detail}>{hi?'संस्कृत में हिन्दी उच्चारण का उपयोग होता है।':'Sanskrit uses Hindi pronunciation.'}</Text>}
      <View style={{height:1,backgroundColor:colors.line}}/>
      <View style={{gap:8,opacity:controlsDisabled?0.5:1}}>
        <Text style={{fontSize:15,color:colors.ink}}>{hi?'गति':'Speed'}</Text>
        <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>
          {speeds.map(rate=>{
            const selected=rate===choice.rate;
            return <Pressable key={rate} accessibilityRole="radio" accessibilityState={{checked:selected,selected,disabled:controlsDisabled}} accessibilityLabel={`${label(lang)} ${hi?'गति':'speed'} ${formatRate(rate)}×`} disabled={controlsDisabled} onPress={()=>{
              if(selected)return;
              haptic();
              stop();
              onChange({...selections,[lang]:{...choice,rate}});
            }} style={{minHeight:44,minWidth:44,paddingHorizontal:8,justifyContent:'center',alignItems:'center',borderRadius:10,borderWidth:1,borderColor:selected?colors.accent:colors.line,backgroundColor:selected?colors.accent:colors.white}}>
              <Text style={{fontSize:14,color:selected?colors.onAccent:colors.ink}}>{formatRate(rate)}×</Text>
            </Pressable>;
          })}
        </View>
      </View>
      {choice.model==='ninada' && <View style={{gap:3,opacity:available?1:0.5}}><View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}><Text style={{fontSize:15,color:colors.ink}}>{hi?'आवाज़ में विविधता':'Voice variation'} · {Math.round(choice.expressiveness*100)}%</Text><Pressable accessibilityRole="button" disabled={controlsDisabled} onPress={()=>{haptic();stop();onChange({...selections,[lang]:{...choice,expressiveness:0.667}});}} style={{minHeight:44,justifyContent:'center'}}><Text style={action}>{hi?'डिफ़ॉल्ट':'Default'}</Text></Pressable></View><Text style={detail}>{hi?'Ninada में आवाज़ की विविधता बदल सकते हैं।':'Ninada supports voice variation; higher values add variety.'}</Text><Slider disabled={controlsDisabled} accessibilityLabel={`${label(lang)} ${hi?'आवाज़ में विविधता':'voice variation'}`} accessibilityValue={{min:0,max:100,now:Math.round(choice.expressiveness*100),text:`${Math.round(choice.expressiveness*100)}%`}} minimumValue={0} maximumValue={1} step={0.1} value={choice.expressiveness} onValueChange={value=>{const v=Number(value.toFixed(1));if(v!==choice.expressiveness){haptic();stop();onChange({...selections,[lang]:{...choice,expressiveness:v}});}}} minimumTrackTintColor={colors.accent} maximumTrackTintColor={colors.line} thumbTintColor={colors.accent}/></View>}
      <Pressable accessibilityRole="button" accessibilityLabel={`${loadingPreview?(hi?'नमूना तैयार हो रहा है':'Preparing sample'):playingPreview?(hi?'नमूना रोकें':'Stop preview'):(hi?'नमूना सुनें':'Play preview')} · ${label(lang)}${available?` · ${titles[choice.model]} · ${formatRate(choice.rate)}×`:''}`} accessibilityState={{disabled:controlsDisabled,busy:loadingPreview}} disabled={controlsDisabled} onPress={()=>void play(choice.model,lang,true)} style={{minHeight:52,paddingHorizontal:12,paddingVertical:8,flexDirection:'row',alignItems:'center',gap:12,borderWidth:1,borderColor:colors.line,borderRadius:12,opacity:available?1:0.5}}>
        <View style={{width:28,alignItems:'center'}}>
          {loadingPreview ? <ActivityIndicator color={colors.accent}/> :
            <SymbolView name={{ios:playingPreview?'stop.circle':'play.circle',android:playingPreview?'stop_circle':'play_circle',web:playingPreview?'stop_circle':'play_circle'}} size={28} tintColor={colors.accent}/>}
        </View>
        <View style={{flex:1}}>
          <Text style={action}>{loadingPreview?(hi?'नमूना तैयार हो रहा है…':'Preparing sample…'):playingPreview?(hi?'नमूना रोकें':'Stop preview'):(hi?'नमूना सुनें':'Preview')}</Text>
          <Text style={detail}>{available?<>{titles[choice.model]} · {hi?(gender==='Female'?'महिला':'पुरुष'):gender} · {formatRate(choice.rate)}×</>:(hi?'सुनने के लिए मॉडल डाउनलोड करें।':'Download the selected model to preview these settings.')}</Text>
        </View>
      </Pressable>
    </View>;})}
  </View>;
}


export function VoiceModelStorage({colors,selections,onRemove,storageBusy}:Pick<Props,'colors'|'selections'> & {onRemove:(model:VoiceModel)=>Promise<void>;storageBusy:boolean}) {
  const {appLanguage}=useAppLanguage();
  const hi=appLanguage==='hi';
  const detail={fontSize:14,lineHeight:20,color:colors.muted};
  const label=(lang:SpeechLanguage)=>lang==='en'?(hi?'अंग्रेज़ी':'English'):lang==='hi'?(hi?'हिन्दी':'Hindi'):(hi?'संस्कृत':'Sanskrit');
  const selectedLanguages = (model:VoiceModel) => langs.filter(lang=>selections[lang].model===model);
  const removalBlocked = (model:VoiceModel) =>
    selectedLanguages(model).length > 0 ||
    (model==='paradee' && (voiceLabInstalled('kokoro') || selectedLanguages('kokoro').length > 0));
  function confirmRemove(model:VoiceModel) {
    if(removalBlocked(model) || storageBusy)return;
    const size=mb(modelStorageBytes(model));
    const languages=langs.filter(lang=>modelVoices[model][lang].length).map(label).join(', ');
    const impact=hi?`${languages} में इस मॉडल का उपयोग करने के लिए इसे फिर डाउनलोड करें। किसी भाषा की चुनी हुई आवाज़ नहीं बदलेगी।`:`To use this model for ${languages}, download it again. Your selected voices will stay the same.`;
    const dependencies=model==='kokoro'
      ? (hi?'Paradee की साझा उच्चारण फ़ाइलें रहेंगी।':'Paradee’s shared pronunciation files will stay installed.')
      : (hi?'इस डाउनलोड पर कोई स्थापित मॉडल निर्भर नहीं है।':'No installed model depends on this download.');
    Alert.alert(hi?'डाउनलोड हटाएँ?':'Remove download?',`${titles[model]} · ${hi?`${size} जगह खाली होगी`:`Frees ${size}`}\n\n${impact} ${dependencies}`,[
      {text:hi?'रद्द करें':'Cancel',style:'cancel'},
      {text:hi?'हटाएँ':'Remove',style:'destructive',onPress:()=>{void onRemove(model);}},
    ]);
  }
  return <View style={{gap:8,borderTopWidth:1,borderColor:colors.line,paddingTop:16}}>
      <Text accessibilityRole="header" style={{fontSize:17,fontWeight:'600',color:colors.ink}}>{hi?'आवाज़ मॉडल':'Voice models'}</Text>
      <Text style={detail}>{hi?'मॉडल सभी भाषाओं में साझा होते हैं। यहाँ हटाने से डाउनलोड सभी भाषाओं से हट जाता है।':'Models are shared across languages. Removing a download here removes it from every language.'}</Text>
      {models.filter(model=>modelStorageBytes(model)>0).map(model=>{
        const inUse=removalBlocked(model);
        const size=mb(modelStorageBytes(model));
        const disabled=inUse || storageBusy;
        return <View key={model} style={{minHeight:56,flexDirection:'row',alignItems:'center',gap:8}}>
          <View style={{flex:1}}>
            <Text style={{fontSize:15,color:colors.ink}}>{titles[model]}</Text>
            <Text style={detail}>{size}{inUse?(hi?' · उपयोग में':' · In use'):''}{model==='paradee' && (voiceLabInstalled('kokoro') || selectedLanguages('kokoro').length>0)?(hi?' · Kokoro के लिए ज़रूरी':' · Required by Kokoro'):''}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={hi?`${titles[model]} हटाएँ, ${size}`:`Remove ${titles[model]}, ${size.replace(' MB',' megabytes')}`} accessibilityState={{disabled}} disabled={disabled} hitSlop={4} onPress={()=>confirmRemove(model)} style={{width:44,minHeight:44,alignItems:'center',justifyContent:'center',opacity:disabled?0.4:1}}>
            <SymbolView name={{ios:'trash',android:'delete_outline',web:'delete_outline'}} size={19} tintColor={colors.muted}/>
          </Pressable>
        </View>;
      })}
    </View>;
}
