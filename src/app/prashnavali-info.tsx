import React, { useEffect, useRef, useState } from 'react';
import { Alert, Linking, ScrollView, Switch, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as SQLite from 'expo-sqlite';
import { useAppLanguage } from '../AppLanguage';
import { palettes, type ColorTheme } from '../readingAppearance';

export default function PrashnavaliInfo() {
  const {appLanguage,t}=useAppLanguage();
  const {theme}=useLocalSearchParams<{theme?:string}>();
  const colors=palettes[theme && Object.hasOwn(palettes,theme) ? theme as ColorTheme : 'paper'];
  const [db,setDb]=useState<SQLite.SQLiteDatabase|null>(null);
  const writes=useRef<Promise<void>>(Promise.resolve());
  const [sound,setSound]=useState(true);
  const [vibration,setVibration]=useState(true);
  useEffect(() => {let live=true; void (async () => {const database=await SQLite.openDatabaseAsync('kgram.db'); await database.execAsync('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)'); const rows=await database.getAllAsync<{key:string;value:string}>("SELECT key,value FROM settings WHERE key IN ('prashnavali-sound','prashnavali-vibration')"); if (!live) return; setSound(rows.find(row => row.key==='prashnavali-sound')?.value !== 'false'); setVibration(rows.find(row => row.key==='prashnavali-vibration')?.value !== 'false'); setDb(database);})().catch(() => {}); return () => {live=false;};},[]);
  function save(kind:'sound'|'vibration', value:boolean) {if (!db) return; if (kind==='sound') setSound(value); else setVibration(value); writes.current=writes.current.catch(() => {}).then(async () => {await db.runAsync('INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)',`prashnavali-${kind}`,String(value));}).catch(() => Alert.alert(appLanguage==='hi'?'सेटिंग सहेजी नहीं जा सकी':'Could not save setting',appLanguage==='hi'?'कृपया फिर प्रयास करें।':'Please try again.'));}
  const hint={fontSize:14,lineHeight:21,color:colors.muted} as const;
  const title={fontSize:16,fontWeight:'600' as const,color:colors.ink};
  return <><Stack.Screen options={{headerShown:true,title:appLanguage==='hi'?'प्रश्नावली की जानकारी':'About Prashnavali',headerBackButtonDisplayMode:'minimal',headerTintColor:colors.ink,headerStyle:{backgroundColor:colors.paper},headerShadowVisible:false}}/><ScrollView style={{flex:1,backgroundColor:colors.paper}} contentContainerStyle={{paddingHorizontal:24,paddingTop:20,paddingBottom:40,gap:16}}>
    <Text style={hint}>{t('Hold a question in your heart. Touch a square, or move your finger across the board and lift to choose.')}</Text>
    {([['sound',sound],['vibration',vibration]] as const).map(([kind,value]) => <View key={kind} style={{minHeight:76,flexDirection:'row',alignItems:'center',gap:16,borderBottomWidth:1,borderColor:colors.line,paddingVertical:12}}><View style={{flex:1,gap:4}}><Text style={title}>{kind==='sound'?(appLanguage==='hi'?'ध्वनि':'Sound'):(appLanguage==='hi'?'कंपन':'Vibration')}</Text><Text style={hint}>{kind==='sound'?(appLanguage==='hi'?'हर अक्षर और किनारे पर हल्की ध्वनि।':'A gentle sound for each square and the edge.'):(appLanguage==='hi'?'समर्थित डिवाइस पर स्पर्श का एहसास।':'Touch feedback on supported devices.')}</Text></View><Switch accessibilityLabel={kind==='sound'?(appLanguage==='hi'?'ध्वनि':'Sound'):(appLanguage==='hi'?'कंपन':'Vibration')} disabled={!db} value={value} onValueChange={next => save(kind,next)} trackColor={{true:colors.accent}}/></View>)}
    <Text style={title}>{t('Sources')}</Text><Text style={hint}>{t('Ramcharitmanas passages: WirelessAlien/Ramcharitmanas, sourced from the IIT Kanpur Ramcharitmanas project. Board reference: Chalisa Sangrah. Meanings are original summaries.')}</Text>
    <Text accessibilityRole="link" onPress={() => void Linking.openURL('https://github.com/WirelessAlien/Ramcharitmanas')} style={{color:colors.accent,textDecorationLine:'underline'}}>{t('Passages')} ↗</Text><Text accessibilityRole="link" onPress={() => void Linking.openURL('https://chalisasangrah.in/Prashnavali')} style={{color:colors.accent,textDecorationLine:'underline'}}>{t('Board reference')} ↗</Text>
  </ScrollView></>;
}
