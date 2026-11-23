import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, Text, View } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { File } from 'expo-file-system';
import { configureReadingAudio } from './readingAudioSession';
import type { Palette } from './readingAppearance';
import { downloadVoiceLab, generateVoiceLab, removeVoiceLab, voiceLabBytes, voiceLabInstalled, type VoiceLabPack, type VoiceLabSample } from './speech/voiceLab';

const samples:{id:VoiceLabSample;pack:VoiceLabPack;label:string;text:string}[]=[
  {id:'english',pack:'kokoro',label:'English · female',text:'Tell me Sanjaya, what did my sons do?'},
  {id:'hindi',pack:'kokoro',label:'Hindi · female',text:'धर्मक्षेत्र में एकत्र हुए मेरे पुत्रों ने क्या किया'},
  {id:'sanskrit',pack:'ninada',label:'Sanskrit · male',text:'धर्मक्षेत्रे कुरुक्षेत्रे समवेता युयुत्सवः।'},
];

export function VoiceComparison({colors}:{colors:Palette}) {
  const [installed,setInstalled]=useState(()=>({kokoro:voiceLabInstalled('kokoro'),ninada:voiceLabInstalled('ninada')}));
  const [busy,setBusy]=useState<string|null>(null);const [progress,setProgress]=useState(0);
  const [selected,setSelected]=useState<VoiceLabSample|null>(null);
  const player=useAudioPlayer(null);const status=useAudioPlayerStatus(player);
  const download=useRef<AbortController|null>(null);const alive=useRef(true);const generated=useRef<File|null>(null);
  useEffect(()=>{alive.current=true; const listener=player.addListener('playbackStatusUpdate',event=>{if(event.didJustFinish)setSelected(null);}); return ()=>{alive.current=false;download.current?.abort();listener.remove();player.pause();const file=generated.current;if(file) setTimeout(()=>{try{if(file.exists)file.delete();}catch{}},30000);};},[player]);
  async function install(pack:VoiceLabPack) {
    const controller=new AbortController();download.current=controller;setBusy(pack);setProgress(0);
    try {await downloadVoiceLab(pack,controller.signal,n=>{if(alive.current)setProgress(n);});if(alive.current)setInstalled(old=>({...old,[pack]:true}));}
    catch(error) {if(alive.current && !controller.signal.aborted) Alert.alert('Could not download voice',error instanceof Error?error.message:'Please try again.');}
    finally {download.current=null;if(alive.current)setBusy(null);}
  }
  async function play(sample:VoiceLabSample) {
    if(selected===sample && status.playing) {player.pause();setSelected(null);return;}
    setBusy(sample);player.pause();setSelected(null);
    try {
      const file=await generateVoiceLab(sample);if(!alive.current){if(file.exists)file.delete();return;}
      const old=generated.current;generated.current=file;
      await configureReadingAudio(false);player.replace({uri:file.uri});player.play();setSelected(sample);
      if(old?.exists) setTimeout(()=>{try{if(old.exists)old.delete();}catch{}},30000);
    } catch(error){if(alive.current) Alert.alert('Could not play voice',error instanceof Error?error.message:'Please try again.');}
    finally {if(alive.current)setBusy(null);}
  }
  return <View style={{paddingVertical:24,gap:16}}>
    <View style={{gap:6}}><Text accessibilityRole="header" style={{fontSize:17,fontWeight:'600',color:colors.ink}}>Compare voices</Text><Text style={{fontSize:14,lineHeight:21,color:colors.muted}}>Test short samples on this device. These previews do not change the reading voice.</Text></View>
    {(['kokoro','ninada'] as const).map(pack=><View key={pack} style={{gap:8,paddingVertical:8,borderBottomWidth:1,borderColor:colors.line}}>
      <View style={{flexDirection:'row',alignItems:'center',gap:12}}><View style={{flex:1,gap:4}}><Text style={{fontSize:16,fontWeight:'600',color:colors.ink}}>{pack==='kokoro'?'Kokoro 82M':'Ninada Sanskrit'}</Text><Text style={{fontSize:14,color:colors.muted}}>{`${(voiceLabBytes(pack)/1000000).toFixed(1)} MB · ${installed[pack]?'Downloaded':'Not downloaded'}`}</Text></View>
        {busy===pack ? <Pressable accessibilityRole="button" onPress={()=>download.current?.abort()} style={{minHeight:44,justifyContent:'center'}}><Text style={{color:colors.accent}}>{`Cancel ${Math.round(progress*100)}%`}</Text></Pressable> : <Pressable disabled={busy!==null} accessibilityRole="button" onPress={()=>{if(installed[pack]){player.pause();setSelected(null);try{removeVoiceLab(pack);setInstalled(old=>({...old,[pack]:false}));}catch{Alert.alert('Could not remove voice');}}else void install(pack);}} style={{minHeight:44,justifyContent:'center',opacity:busy?0.5:1}}><Text style={{color:colors.accent,fontWeight:'600'}}>{installed[pack]?'Remove':'Download'}</Text></Pressable>}
      </View>
      {samples.filter(sample=>sample.pack===pack).map(sample=><View key={sample.id} style={{flexDirection:'row',alignItems:'center',gap:12,paddingBottom:8}}><View style={{flex:1,gap:4}}><Text style={{fontSize:15,color:colors.ink}}>{sample.label}</Text><Text style={{fontSize:14,lineHeight:20,color:colors.muted}}>{sample.text}</Text></View><Pressable disabled={!installed[pack] || busy!==null} accessibilityRole="button" accessibilityLabel={`${selected===sample.id?'Stop':'Play'} ${sample.label} sample`} onPress={()=>void play(sample.id)} style={{minWidth:48,minHeight:44,alignItems:'center',justifyContent:'center',opacity:!installed[pack] || busy?0.5:1}}>{busy===sample.id?<ActivityIndicator color={colors.accent}/>:<Text style={{color:colors.accent,fontWeight:'600'}}>{selected===sample.id?'Stop':'Play'}</Text>}</Pressable></View>)}
    </View>)}
    <Text style={{fontSize:13,lineHeight:19,color:colors.muted}}>Kokoro by hexgrad and ONNX Community: Apache 2.0. <Text accessibilityRole="link" style={{color:colors.accent}} onPress={()=>void Linking.openURL('https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX')}>Source</Text>{' · '}Ninada model by Hemanth.HM: CC BY 4.0. <Text accessibilityRole="link" style={{color:colors.accent}} onPress={()=>void Linking.openURL('https://huggingface.co/gnumanth/ninada')}>Source</Text></Text>
  </View>;
}
