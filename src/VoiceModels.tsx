import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, Text, View } from 'react-native';
import { MenuView } from '@expo/ui/community/menu';
import { useAudioPlayer } from 'expo-audio';
import Slider from '@react-native-community/slider';
import { useAppLanguage } from './AppLanguage';
import { configureReadingAudio } from './readingAudioSession';
import type { Palette } from './readingAppearance';
import type { GeneratedSpeech, SpeechLanguage } from './speech/engine';
import { modelBytes, modelInstalled, modelVoices, type VoiceModel, type VoiceSelections } from './speech/models';

const langs:SpeechLanguage[]=['en','hi','sa'];
const models:VoiceModel[]=['paradee','kokoro','ninada'];
const samples:Record<SpeechLanguage,string>={en:'Tell me Sanjaya, what did my sons do?',hi:'धर्मक्षेत्र में एकत्र हुए मेरे पुत्रों ने क्या किया',sa:'धर्मक्षेत्रे कुरुक्षेत्रे समवेता युयुत्सवः।'};
const titles:Record<VoiceModel,string>={paradee:'Paradee 8M',kokoro:'Kokoro 82M',ninada:'Ninada'};
const bundledSamples:Record<VoiceModel,Partial<Record<SpeechLanguage,number>>>={
  paradee:{en:require('../assets/voice-samples/paradee-en.mp3'),hi:require('../assets/voice-samples/paradee-hi.mp3'),sa:require('../assets/voice-samples/paradee-sa.mp3')},
  kokoro:{en:require('../assets/voice-samples/kokoro-en.mp3'),hi:require('../assets/voice-samples/kokoro-hi.mp3')},
  ninada:{sa:require('../assets/voice-samples/ninada-sa.mp3')},
};

type Props={colors:Palette;selections:VoiceSelections;onChange:(v:VoiceSelections)=>void;onDownload:(m:VoiceModel)=>Promise<void>;onRemove:(m:VoiceModel)=>Promise<void>;onPreview:(m:VoiceModel,l:SpeechLanguage,text:string)=>Promise<GeneratedSpeech>;downloading:VoiceModel|null;progress:number|null;onCancel:()=>void;revision:number};
export function VoiceModels({colors,selections,onChange,onDownload,onRemove,onPreview,downloading,progress,onCancel,revision}:Props) {
  const {appLanguage}=useAppLanguage();const hi=appLanguage==='hi';
  const [busy,setBusy]=useState<string|null>(null);const [playing,setPlaying]=useState<string|null>(null);
  const player=useAudioPlayer(null);const alive=useRef(true);const current=useRef<GeneratedSpeech|null>(null);
  useEffect(()=>{alive.current=true;const listener=player.addListener('playbackStatusUpdate',event=>{if(event.didJustFinish)setPlaying(null);});return()=>{alive.current=false;listener.remove();player.pause();const file=current.current;if(file)setTimeout(()=>void file.dispose().catch(()=>{}),30000);};},[player]);
  const label=(lang:SpeechLanguage)=>lang==='en'?(hi?'अंग्रेज़ी':'English'):lang==='hi'?(hi?'हिन्दी':'Hindi'):(hi?'संस्कृत':'Sanskrit');
  async function play(model:VoiceModel,lang:SpeechLanguage) {
    const key=`${model}-${lang}`;if(playing===key){player.pause();setPlaying(null);return;}
    player.pause();setPlaying(null);setBusy(key);
    try {if(!modelInstalled(model)){const source=bundledSamples[model][lang];if(!source)throw new Error('Sample unavailable.');await configureReadingAudio(false);player.replace(source);player.play();setPlaying(key);return;}const file=await onPreview(model,lang,samples[lang]);if(!alive.current){await file.dispose();return;}const old=current.current;current.current=file;await configureReadingAudio(false);player.replace({uri:file.uri});player.play();setPlaying(key);if(old)setTimeout(()=>void old.dispose().catch(()=>{}),30000);}
    catch(error){if(alive.current)Alert.alert(hi?'नमूना नहीं चल सका':'Could not play sample',error instanceof Error?error.message:(hi?'फिर प्रयास करें।':'Please try again.'));}
    finally {if(alive.current)setBusy(null);}
  }
  const heading={fontSize:17,fontWeight:'600' as const,color:colors.ink};
  const detail={fontSize:14,lineHeight:21,color:colors.muted};
  const action={color:colors.accent,fontSize:15,fontWeight:'600' as const};
  return <View style={{gap:24,paddingVertical:24}}>
    <View style={{gap:6}}><Text accessibilityRole="header" style={heading}>{hi?'आवाज़ मॉडल':'Voice models'}</Text><Text style={detail}>{hi?'डाउनलोड से पहले नमूने सुनें। अपनी चुनी हुई आवाज़ ऑफ़लाइन उपयोग करने के लिए मॉडल डाउनलोड करें।':'Listen to samples before downloading. Download a model to use your chosen voice and settings offline.'}</Text></View>
    <View>{models.map(model=>{const installed=revision>=0 && modelInstalled(model);const supported=langs.filter(l=>modelVoices[model][l].length>0);return <View key={model} style={{paddingVertical:16,borderBottomWidth:1,borderColor:colors.line,gap:8}}>
      <View style={{flexDirection:'row',alignItems:'center',gap:12}}><View style={{flex:1,gap:4}}><Text style={{fontSize:16,fontWeight:'600',color:colors.ink}}>{titles[model]}</Text><Text style={detail}>{supported.map(label).join(' · ')} · {(modelBytes(model)/1000000).toFixed(1)} MB {hi?'कुल':'total'}</Text><Text style={detail}>{installed?(hi?'डाउनलोड किया गया':'Downloaded'):(hi?'डाउनलोड नहीं किया गया':'Not downloaded')}</Text></View>
        {downloading===model?<Pressable accessibilityRole="button" onPress={onCancel} style={{minHeight:44,justifyContent:'center'}}><Text style={action}>{hi?'रोकें':'Cancel'} {Math.round((progress??0)*100)}%</Text></Pressable>:<Pressable accessibilityRole="button" disabled={!!downloading || !!busy} onPress={()=>void(installed?onRemove(model):onDownload(model))} style={{minHeight:44,justifyContent:'center',opacity:downloading||busy?0.5:1}}><Text style={action}>{installed?(hi?'हटाएँ':'Remove'):(hi?'डाउनलोड':'Download')}</Text></Pressable>}
      </View>
      {model==='paradee' && <Text style={detail}>{hi?'संस्कृत में हिन्दी उच्चारण का उपयोग होता है।':'Sanskrit uses the Hindi pronunciation model.'}</Text>}
      {model==='kokoro' && <Text style={detail}>{hi?'इस आकार में Paradee का उच्चारण संसाधन शामिल है।':'Total size includes Paradee pronunciation resources; already downloaded files are reused.'}</Text>}
      <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{supported.map(lang=>{const key=`${model}-${lang}`;return <Pressable key={lang} accessibilityRole="button" accessibilityLabel={`${playing===key?'Stop':'Play'} ${titles[model]} ${label(lang)}`} disabled={!!busy || !!downloading} onPress={()=>void play(model,lang)} style={{minHeight:44,paddingHorizontal:12,borderRadius:10,backgroundColor:colors.white,justifyContent:'center',opacity:busy || downloading?0.5:1}}>{busy===key?<ActivityIndicator color={colors.accent}/>:<Text style={action}>{playing===key?'Ⅱ':'▶'} {label(lang)}</Text>}</Pressable>;})}</View>
    </View>;})}</View>
    <View style={{gap:6}}><Text accessibilityRole="header" style={heading}>{hi?'हर भाषा की आवाज़':'Voice for each language'}</Text><Text style={detail}>{hi?'पढ़ने की भाषा बदलने पर चुनी आवाज़ अपने आप उपयोग होगी।':'Your chosen voice is used automatically when you change reading language.'}</Text></View>
    {langs.map(lang=>{const choice=selections[lang];const options=models.filter(model=>modelVoices[model][lang].length);const voices=modelVoices[choice.model][lang];return <View key={lang} style={{gap:10,paddingBottom:16,borderBottomWidth:1,borderColor:colors.line}}>
      <Text accessibilityRole="header" style={{fontSize:16,fontWeight:'600',color:colors.ink}}>{label(lang)}</Text>
      <MenuView title={hi?'मॉडल चुनें':'Choose model'} actions={options.map(model=>({id:model,title:titles[model],state:model===choice.model?'on':'off'}))} onPressAction={event=>{const model=event.nativeEvent.event as VoiceModel;if(!options.includes(model))return;onChange({...selections,[lang]:{...choice,model,voiceId:modelVoices[model][lang][0].id}});}}><View accessibilityRole="button" accessibilityLabel={`${label(lang)} ${hi?'मॉडल':'model'}: ${titles[choice.model]}`} style={{minHeight:48,flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><Text style={{color:colors.ink,fontSize:15}}>{hi?'मॉडल':'Model'}</Text><Text style={action}>{titles[choice.model]}  ▾</Text></View></MenuView>
      {!modelInstalled(choice.model) && <Text style={detail}>{hi?'उपयोग से पहले ऊपर मॉडल डाउनलोड करें।':'Download this model above before using it.'}</Text>}
      <MenuView title={hi?'आवाज़ चुनें':'Choose voice'} actions={voices.map(voice=>({id:voice.id,title:hi?(voice.name==='Female'?'महिला':'पुरुष'):voice.name,state:voice.id===choice.voiceId?'on':'off'}))} onPressAction={event=>{if(voices.some(v=>v.id===event.nativeEvent.event))onChange({...selections,[lang]:{...choice,voiceId:event.nativeEvent.event}});}}><View accessibilityRole="button" accessibilityLabel={`${label(lang)} ${hi?'आवाज़':'voice'}`} style={{minHeight:48,flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><Text style={{color:colors.ink,fontSize:15}}>{hi?'आवाज़':'Voice'}</Text><Text style={action}>{hi?(voices.find(v=>v.id===choice.voiceId)?.name==='Female'?'महिला':'पुरुष'):voices.find(v=>v.id===choice.voiceId)?.name}  ▾</Text></View></MenuView>
      <View style={{gap:2}}><View style={{flexDirection:'row',justifyContent:'space-between'}}><Text style={{color:colors.ink,fontSize:15}}>{hi?'गति':'Speed'}</Text><Text style={detail}>{choice.rate.toFixed(1)}×</Text></View><Slider accessibilityLabel={`${label(lang)} ${hi?'गति':'speed'}`} minimumValue={0.7} maximumValue={1.3} step={0.1} value={choice.rate} onSlidingComplete={rate=>onChange({...selections,[lang]:{...choice,rate:Number(rate.toFixed(1))}})} minimumTrackTintColor={colors.accent} maximumTrackTintColor={colors.line} thumbTintColor={colors.accent}/></View>
      {choice.model==='ninada' && <View style={{gap:2}}><View style={{flexDirection:'row',justifyContent:'space-between'}}><Text style={{color:colors.ink,fontSize:15}}>{hi?'आवाज़ में विविधता':'Voice variation'}</Text><Text style={detail}>{Math.round(choice.expressiveness*100)}%</Text></View><Text style={detail}>{hi?'उच्च मान से आवाज़ में अधिक विविधता आ सकती है।':'Higher values can add variation to the voice.'}</Text><Slider accessibilityLabel={`${label(lang)} ${hi?'आवाज़ में विविधता':'voice variation'}`} minimumValue={0} maximumValue={1} step={0.1} value={choice.expressiveness} onSlidingComplete={expressiveness=>onChange({...selections,[lang]:{...choice,expressiveness:Number(expressiveness.toFixed(1))}})} minimumTrackTintColor={colors.accent} maximumTrackTintColor={colors.line} thumbTintColor={colors.accent}/></View>}
      {Platform.OS==='web' && <Text style={detail}>{hi?'यह सुविधा मोबाइल ऐप में उपलब्ध है।':'Available in the mobile app.'}</Text>}
    </View>;})}
  </View>;
}
