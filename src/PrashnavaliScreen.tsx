import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Alert, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import * as Haptics from 'expo-haptics';
import * as SQLite from 'expo-sqlite';
import { useAudioPlayer } from 'expo-audio';
import dataset from './data/prashnavali.json';
import { useAppLanguage } from './AppLanguage';
import { palettes, type ColorTheme, type Palette } from './readingAppearance';
import { locateCell, isEdgeCell, resultForCell } from './prashnavaliLogic';
import { PRASHNAVALI_WALKTHROUGH_KEY, readerWalkthroughSeen } from './readerWalkthrough';

const reflections = [
  ['एक शुभ आशीर्वाद की तरह इसे आशा और विश्वास के साथ ग्रहण किया जाता है।', 'Traditionally received as an encouraging blessing of hope and confidence.'],
  ['परंपरागत भाव: श्रीराम का स्मरण करते हुए अपने कार्य में आगे बढ़ें।', 'Traditional reflection: move forward while remembering Rama.'],
  ['परंपरागत भाव: दिखावे से सावधान रहें और अपने मार्ग पर फिर से विचार करें।', 'Traditional reflection: look beyond appearances and reconsider the path carefully.'],
  ['परंपरागत भाव: अपनी संगति पर ध्यान दें और अपने अच्छे गुण बनाए रखें।', 'Traditional reflection: consider your company and remain true to your values.'],
  ['परंपरागत भाव: चिंतन के साथ परिणाम को ईश्वर पर छोड़ने का स्मरण करें।', 'Traditional reflection: act thoughtfully and entrust the outcome to the divine.'],
  ['परंपरागत भाव: सत्संग और अच्छे लोगों के सहारे को महत्व दें।', 'Traditional reflection: value good company and the support of wise people.'],
  ['परंपरागत भाव: कृपा और विश्वास से कठिनाइयों का सामना करने की प्रेरणा लें।', 'Traditional reflection: face difficulties with faith and trust in grace.'],
  ['परंपरागत भाव: शक्ति के साथ विनम्रता रखें और परिस्थिति को सावधानी से देखें।', 'Traditional reflection: meet the situation with humility and care.'],
  ['परंपरागत भाव: शुभकामनाओं के साथ धैर्य और आशा रखें।', 'Traditional reflection: receive the blessing with patience and hope.'],
] as const;

type BoardBox = {x:number;y:number;size:number};
function cellHaptic(kind:'tick'|'edge'|'confirm') {
  if (Platform.OS === 'web') return;
  if (Platform.OS === 'android') {
    const type = kind === 'tick' ? Haptics.AndroidHaptics.Segment_Frequent_Tick : kind === 'edge' ? Haptics.AndroidHaptics.Segment_Tick : Haptics.AndroidHaptics.Confirm;
    void Haptics.performAndroidHapticsAsync(type).catch(() => {});
  } else if (kind === 'tick') void Haptics.selectionAsync().catch(() => {});
  else void Haptics.impactAsync(kind === 'edge' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export default function PrashnavaliScreen() {
  const {appLanguage,t} = useAppLanguage();
  const {theme} = useLocalSearchParams<{theme?:string}>();
  const colorTheme:ColorTheme = theme && Object.hasOwn(palettes,theme) ? theme as ColorTheme : 'paper';
  const colors = palettes[colorTheme];
  const styles = useMemo(() => createStyles(colors),[colors]);
  const {width,height} = useWindowDimensions();
  const [viewport,setViewport] = useState({width,height:Math.max(200,height-100)});
  const boardSize = Math.max(150,Math.min(viewport.width-40,viewport.height-64,760));
  const cellSize = boardSize/15;
  const boardView = useRef<React.ComponentRef<typeof View>>(null);
  const geometry = useRef<BoardBox | null>(null);
  const current = useRef<number|null>(null);
  const edge = useRef(false);
  const [active,setActive] = useState<number|null>(null);
  const [dragging,setDragging] = useState(false);
  const [answer,setAnswer] = useState<number|null>(null);
  const [showInfo,setShowInfo] = useState(false);
  const [walkthroughVisible,setWalkthroughVisible] = useState(false);
  const [walkthroughSaving,setWalkthroughSaving] = useState(false);
  const [soundEnabled,setSoundEnabled] = useState(true);
  const [vibrationEnabled,setVibrationEnabled] = useState(true);
  const [feedbackReady,setFeedbackReady] = useState(false);
  const soundRef = useRef(true);
  const vibrationRef = useRef(true);
  const settingsDb = useRef<SQLite.SQLiteDatabase|null>(null);
  const writes = useRef<Promise<void>>(Promise.resolve());
  // Alternate between prepared players so a new cell never waits for a seek.
  const tick0 = useAudioPlayer(require('../assets/audio/prashnavali-tick.wav'));
  const tick1 = useAudioPlayer(require('../assets/audio/prashnavali-tick.wav'));
  const tick2 = useAudioPlayer(require('../assets/audio/prashnavali-tick.wav'));
  const tick3 = useAudioPlayer(require('../assets/audio/prashnavali-tick.wav'));
  const edge0 = useAudioPlayer(require('../assets/audio/prashnavali-edge.wav'));
  const edge1 = useAudioPlayer(require('../assets/audio/prashnavali-edge.wav'));
  const tickPlayers = useMemo(() => [tick0,tick1,tick2,tick3], [tick0,tick1,tick2,tick3]);
  const edgePlayers = useMemo(() => [edge0,edge1], [edge0,edge1]);
  const available = useRef({tick:[true,true,true,true],edge:[true,true]});
  const soundTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const liveSound = useRef(true);
  useEffect(() => {liveSound.current=true; return () => {liveSound.current=false; soundTimers.current.forEach(clearTimeout); soundTimers.current=[];};},[]);
  useEffect(() => {
    let live = true;
    (async () => {
      const db = await SQLite.openDatabaseAsync('kgram.db');
      await db.execAsync('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)');
      const rows = await db.getAllAsync<{key:string;value:string}>("SELECT key,value FROM settings WHERE key IN ('prashnavali-sound','prashnavali-vibration','prashnavali-walkthrough-seen')");
      if (!live) return;
      settingsDb.current = db;
      const sound = rows.find(row => row.key==='prashnavali-sound')?.value !== 'false';
      const vibration = rows.find(row => row.key==='prashnavali-vibration')?.value !== 'false';
      soundRef.current=sound; vibrationRef.current=vibration;
      setSoundEnabled(sound); setVibrationEnabled(vibration); setFeedbackReady(true);
      setWalkthroughVisible(!readerWalkthroughSeen(rows.find(row => row.key===PRASHNAVALI_WALKTHROUGH_KEY)?.value));
    })().catch(() => {if (live) setFeedbackReady(true);});
    return () => {live=false;};
  },[]);
  async function finishWalkthrough() {
    if (walkthroughSaving || !settingsDb.current) return;
    setWalkthroughSaving(true);
    try {
      await settingsDb.current.runAsync('INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)',PRASHNAVALI_WALKTHROUGH_KEY,'true');
      setWalkthroughVisible(false);
    } catch {Alert.alert(appLanguage==='hi'?'सहेजा नहीं जा सका':'Could not save',appLanguage==='hi'?'कृपया फिर प्रयास करें।':'Please try again.');}
    finally {setWalkthroughSaving(false);}
  }
  function saveFeedback(kind:'sound'|'vibration', enabled:boolean) {
    if (!settingsDb.current) {Alert.alert(appLanguage==='hi'?'सेटिंग सहेजी नहीं जा सकी':'Could not save setting', appLanguage==='hi'?'कृपया ऐप फिर से खोलें।':'Please reopen the app and try again.'); return;}
    if (kind==='sound') {soundRef.current=enabled; setSoundEnabled(enabled); if (!enabled) [...tickPlayers,...edgePlayers].forEach(player => player.pause());}
    else {vibrationRef.current=enabled; setVibrationEnabled(enabled);}
    writes.current=writes.current.catch(() => {}).then(() => settingsDb.current!.runAsync('INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)',`prashnavali-${kind}`,String(enabled))).then(() => {});
    void writes.current.catch(() => Alert.alert(appLanguage==='hi'?'सेटिंग सहेजी नहीं जा सकी':'Could not save setting',appLanguage==='hi'?'कृपया फिर प्रयास करें।':'Please try again.'));
  }
  function feedback(kind:'tick'|'edge'|'confirm') {
    if (!feedbackReady) return;
    if (vibrationRef.current) cellHaptic(kind);
    if (!soundRef.current || kind==='confirm') return;
    const players=kind==='edge' ? edgePlayers : tickPlayers;
    const slot=available.current[kind].findIndex((ready,i) => ready && players[i].isLoaded);
    if (slot<0) return; // Drop stale feedback rather than queue sounds behind the finger.
    const player=players[slot];
    available.current[kind][slot]=false;
    player.play();
    const timer=setTimeout(() => {
      soundTimers.current=soundTimers.current.filter(value => value!==timer);
      if (!liveSound.current) return;
      void player.seekTo(0).catch(() => {}).finally(() => {if (liveSound.current) available.current[kind][slot]=true;});
    }, kind==='edge' ? 110 : 70);
    soundTimers.current.push(timer);
  }
  const [screenReader,setScreenReader] = useState(false);
  const [language,setLanguage] = useState<'hi'|'en'>('hi');
  useEffect(() => {
    let mounted=true;
    void AccessibilityInfo.isScreenReaderEnabled().then(value => {if (mounted) setScreenReader(value);}).catch(() => {});
    const sub=AccessibilityInfo.addEventListener('screenReaderChanged',setScreenReader);
    return () => {mounted=false;sub.remove();};
  },[]);
  const updateGeometry=useCallback(() => {
    boardView.current?.measureInWindow((x,y,w,h) => {geometry.current={x,y,size:Math.min(w,h)};});
  },[]);
  function selectCell(index:number) {
    current.current=null; edge.current=false; setActive(null);
    feedback('confirm'); setAnswer(resultForCell(index));
  }
  function moveAt(x:number,y:number) {
    const box=geometry.current;
    if (!box) return;
    const index=locateCell(x-box.x,y-box.y,box.size);
    if (index===null) {current.current=null; edge.current=false; setActive(null);return;}
    if (index===current.current) return;
    const onEdge=isEdgeCell(index), enteringEdge=onEdge && !edge.current;
    current.current=index; edge.current=onEdge; setActive(index);
    if (enteringEdge) feedback('edge');
    else feedback('tick');
  }
  const result=answer===null ? null : dataset.results[answer];
  return <SafeAreaView style={styles.root} edges={['left','right','bottom']}>
    <Stack.Screen options={{headerShown:true,title:t('Prashnavali'),headerTintColor:colors.ink,headerStyle:{backgroundColor:colors.paper},headerShadowVisible:false,headerBackButtonDisplayMode:'minimal',gestureEnabled:false,headerRight:() => <Pressable accessibilityRole="button" accessibilityLabel={appLanguage==='hi'?'प्रश्नावली की जानकारी और सेटिंग':'Prashnavali information and settings'} onPress={() => setShowInfo(true)} style={styles.headerButton}><SymbolView name={{ios:'info.circle',android:'info',web:'info'}} size={23} tintColor={colors.ink}/></Pressable>}}/>
    <Modal visible={walkthroughVisible} transparent animationType="fade" onRequestClose={() => void finishWalkthrough()}>
      <SafeAreaProvider><SafeAreaView style={styles.walkthroughOverlay}>
        <ScrollView contentContainerStyle={styles.walkthroughScroll}><View accessibilityViewIsModal style={styles.walkthroughCard}>
          <View style={{gap:8}}><Text accessibilityRole="header" style={styles.walkthroughTitle}>{appLanguage==='hi'?'प्रश्नावली का परिचय':'Welcome to Prashnavali'}</Text><Text style={styles.walkthroughBody}>{appLanguage==='hi'?'मन में एक प्रश्न रखें और श्री राम प्रश्नावली से मार्गदर्शन लें।':'Hold a question in your heart, then choose a square on the board.'}</Text></View>
          <View style={{gap:16}}>
            <View style={{gap:4}}><Text style={styles.feedbackTitle}>{appLanguage==='hi'?'अक्षर चुनें':'Choose a square'}</Text><Text style={styles.walkthroughBody}>{appLanguage==='hi'?'किसी अक्षर को छुएँ, या बोर्ड पर उंगली घुमाएँ और चुनने के लिए उठाएँ।':'Touch a square, or slide your finger across the board and lift it to choose.'}</Text></View>
            <View style={{gap:4}}><Text style={styles.feedbackTitle}>{appLanguage==='hi'?'अपना उत्तर पढ़ें':'Read your answer'}</Text><Text style={styles.walkthroughBody}>{appLanguage==='hi'?'चुनी हुई चौपाई, उसका अर्थ और पारंपरिक संकेत देखें।':'See the chosen passage, its meaning and a traditional reflection.'}</Text></View>
            <View style={{gap:4}}><Text style={styles.feedbackTitle}>{appLanguage==='hi'?'ध्वनि और कंपन':'Sound and vibration'}</Text><Text style={styles.walkthroughBody}>{appLanguage==='hi'?'इन्हें बदलने के लिए ऊपर ⓘ पर जाएँ।':'Use ⓘ at the top to change the feedback settings.'}</Text></View>
          </View>
          <Text style={styles.infoHint}>{appLanguage==='hi'?'आप सेटिंग में इस परिचय को फिर से देख सकते हैं।':'You can reset this guide in Settings.'}</Text>
          <View style={styles.walkthroughActions}><Pressable accessibilityRole="button" disabled={walkthroughSaving} onPress={() => void finishWalkthrough()} style={styles.walkthroughButton}><Text style={{color:colors.muted,fontSize:15}}>{appLanguage==='hi'?'छोड़ें':'Skip'}</Text></Pressable><Pressable accessibilityRole="button" disabled={walkthroughSaving} onPress={() => void finishWalkthrough()} style={[styles.walkthroughButton,{backgroundColor:colors.accent}]}><Text style={{color:colors.onAccent,fontSize:15,fontWeight:'600'}}>{appLanguage==='hi'?'समझ गया':'Got it'}</Text></Pressable></View>
        </View></ScrollView>
      </SafeAreaView></SafeAreaProvider>
    </Modal>
    <Modal visible={showInfo} animationType="slide" onRequestClose={() => setShowInfo(false)}>
      <SafeAreaProvider><SafeAreaView style={styles.root}>
        <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel={t("Back to reader")} onPress={() => setShowInfo(false)} style={styles.headerButton}><Text style={styles.back}>‹</Text></Pressable><Text accessibilityRole="header" style={styles.headerTitle}>{appLanguage==='hi'?'प्रश्नावली की जानकारी':'About Prashnavali'}</Text><View style={styles.headerButton}/></View>
        <ScrollView contentContainerStyle={styles.infoContent}>
          <Text style={styles.infoHint}>{t("Hold a question in your heart. Touch a square, or move your finger across the board and lift to choose.")}</Text>
          <View style={styles.feedbackRow}><View style={styles.feedbackText}><Text style={styles.feedbackTitle}>{appLanguage==='hi'?'ध्वनि':'Sound'}</Text><Text style={styles.infoHint}>{appLanguage==='hi'?'हर अक्षर और किनारे पर हल्की ध्वनि।':'A gentle sound for each square and the edge.'}</Text></View><Switch accessibilityLabel={appLanguage==='hi'?'ध्वनि':'Sound'} disabled={!feedbackReady} value={soundEnabled} onValueChange={value => saveFeedback('sound',value)} trackColor={{true:colors.accent}}/></View>
          <View style={styles.feedbackRow}><View style={styles.feedbackText}><Text style={styles.feedbackTitle}>{appLanguage==='hi'?'कंपन':'Vibration'}</Text><Text style={styles.infoHint}>{appLanguage==='hi'?'समर्थित डिवाइस पर स्पर्श का एहसास।':'Touch feedback on supported devices.'}</Text></View><Switch accessibilityLabel={appLanguage==='hi'?'कंपन':'Vibration'} disabled={!feedbackReady} value={vibrationEnabled} onValueChange={value => saveFeedback('vibration',value)} trackColor={{true:colors.accent}}/></View>
          <Text style={styles.feedbackTitle}>{t("Sources")}</Text><Text style={styles.infoHint}>{t("Ramcharitmanas passages: WirelessAlien/Ramcharitmanas, sourced from the IIT Kanpur Ramcharitmanas project. Board reference: Chalisa Sangrah. Meanings are original summaries.")}</Text>
          <Pressable accessibilityRole="link" onPress={() => void Linking.openURL('https://github.com/WirelessAlien/Ramcharitmanas')}><Text style={styles.infoLink}>{t("Passages")} ↗</Text></Pressable>
          <Pressable accessibilityRole="link" onPress={() => void Linking.openURL('https://chalisasangrah.in/Prashnavali')}><Text style={styles.infoLink}>{t("Board reference")} ↗</Text></Pressable>
        </ScrollView>
      </SafeAreaView></SafeAreaProvider>
    </Modal>
    <ScrollView onLayout={event => {const {width:w,height:h}=event.nativeEvent.layout; if (w>0 && h>0) setViewport(previous => previous.width===w && previous.height===h ? previous : {width:w,height:h});}} contentContainerStyle={[styles.content,!result && styles.boardContent]} showsVerticalScrollIndicator={false} scrollEnabled={!dragging} onScroll={updateGeometry} scrollEventThrottle={32}>
      {result ? <View style={styles.result}>
        <Text style={styles.eyebrow}>श्रीरामचरितमानस · RAM SHALAKA</Text>
        <Text accessibilityRole="header" style={styles.resultTitle}>आपका उत्तर</Text>
        <Text style={styles.resultSubtitle}>{t("Your chosen passage")}</Text>
        <View style={styles.rule}/>
        <Text style={styles.verse}>{result.verse}</Text>
        <Text style={styles.reference}>{result.kand} · {result.reference}</Text>
        <View style={styles.languageRow}><Text style={styles.sectionLabel}>भावार्थ · MEANING</Text><Pressable accessibilityRole="button" accessibilityLabel={t("Switch meaning language")} onPress={() => setLanguage(language==='hi'?'en':'hi')} style={styles.languageButton}><Text style={styles.languageText}>{language==='hi'?t("English"):'हिंदी'}</Text></Pressable></View>
        <Text style={styles.meaning}>{language==='hi'?result.meaningHi:result.meaningEn}</Text>
        <Text style={styles.sectionLabel}>पारंपरिक संकेत · REFLECTION</Text>
        <Text style={styles.meaning}>{reflections[answer!][language==='hi'?0:1]}</Text>
        <Pressable accessibilityRole="button" onPress={() => {setAnswer(null);setLanguage('hi');}} style={styles.primary}><Text style={styles.primaryText}>{t("Return to board")}</Text></Pressable>
      </View> : <>
        <View style={styles.preview} accessibilityLiveRegion="polite"><Text style={styles.previewText}>{active===null?'ॐ':dataset.board[active].startsWith('ा')?'◌'+dataset.board[active]:dataset.board[active]}</Text></View>
        <View ref={boardView} onLayout={updateGeometry} style={[styles.board,{width:boardSize,height:boardSize}]}
          onStartShouldSetResponderCapture={() => !screenReader}
          onMoveShouldSetResponderCapture={() => !screenReader}
          onResponderTerminationRequest={() => false}
          onResponderGrant={event => {setDragging(true); updateGeometry();moveAt(event.nativeEvent.pageX,event.nativeEvent.pageY);}}
          onResponderMove={event => moveAt(event.nativeEvent.pageX,event.nativeEvent.pageY)}
          onResponderRelease={event => {setDragging(false); const box=geometry.current; const i=box?locateCell(event.nativeEvent.pageX-box.x,event.nativeEvent.pageY-box.y,box.size):null; if (i!==null) selectCell(i); else {current.current=null;edge.current=false;setActive(null);}}}
          onResponderTerminate={() => {setDragging(false);current.current=null;edge.current=false;setActive(null);}}>
          {Array.from({length:15},(_,row)=><View key={row} style={styles.row}>{dataset.board.slice(row*15,row*15+15).map((letter,col)=>{
            const index=row*15+col;
            return <Pressable key={index} accessibilityRole="button" accessibilityLabel={`${appLanguage==='hi'?'पंक्ति':'Row'} ${row+1}, ${appLanguage==='hi'?'स्तंभ':'column'} ${col+1}, ${letter}`} onPress={() => {if (screenReader) selectCell(index);}} style={[styles.cell,{width:cellSize,height:cellSize},active===index && styles.cellActive]}><Text allowFontScaling={false} style={[styles.cellText,{fontSize:Math.min(24,cellSize*0.55)},active===index && styles.cellTextActive]}>{letter.startsWith('ा')?'◌'+letter:letter}</Text></Pressable>;
          })}</View>)}
        </View>

      </>}
    </ScrollView>
  </SafeAreaView>;
}
function createStyles(c:Palette) {return StyleSheet.create({
  walkthroughOverlay:{flex:1,backgroundColor:'#0009',justifyContent:'center',padding:24},walkthroughScroll:{flexGrow:1,justifyContent:'center'},walkthroughCard:{backgroundColor:c.white,borderRadius:20,padding:24,gap:20,maxWidth:480,width:'100%',alignSelf:'center'},walkthroughTitle:{fontSize:22,fontWeight:'700',color:c.ink},walkthroughBody:{fontSize:15,lineHeight:23,color:c.muted},walkthroughActions:{flexDirection:'row',alignItems:'center',justifyContent:'flex-end',gap:12,flexWrap:'wrap'},walkthroughButton:{paddingVertical:12,paddingHorizontal:18,borderRadius:20},
  root:{flex:1,backgroundColor:c.paper},header:{height:56,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:16},headerButton:{width:44,height:44,justifyContent:'center'},back:{fontSize:34,color:c.ink,lineHeight:40},headerTitle:{fontSize:17,fontWeight:'600',color:c.ink},info:{fontSize:22,color:c.ink},infoContent:{paddingHorizontal:24,paddingTop:20,paddingBottom:40,gap:16},infoHint:{fontSize:14,lineHeight:21,color:c.muted},feedbackRow:{minHeight:76,flexDirection:'row',alignItems:'center',gap:16,borderBottomWidth:1,borderColor:c.line,paddingVertical:12},feedbackText:{flex:1,gap:4},feedbackTitle:{fontSize:16,fontWeight:'600',color:c.ink},infoLink:{fontSize:14,color:c.accent,textDecorationLine:'underline'},content:{paddingHorizontal:20,paddingBottom:16,alignItems:'center'},boardContent:{flexGrow:1,justifyContent:'center'},intro:{alignItems:'center',maxWidth:420,paddingTop:20},eyebrow:{fontSize:11,letterSpacing:1.5,color:c.accent,fontWeight:'700'},title:{fontSize:27,color:c.ink,fontWeight:'600',marginTop:10},subtitle:{fontSize:14,lineHeight:21,color:c.muted,textAlign:'center',marginTop:10},preview:{height:40,justifyContent:'center',alignItems:'center'},previewText:{fontSize:27,color:c.accent,fontWeight:'600'},board:{borderWidth:1,borderColor:c.accent,backgroundColor:c.white,overflow:'hidden'},row:{flexDirection:'row'},cell:{alignItems:'center',justifyContent:'center',borderWidth:StyleSheet.hairlineWidth,borderColor:c.line},cellActive:{backgroundColor:c.accent},cellText:{color:c.ink,includeFontPadding:false},cellTextActive:{color:c.onAccent},hapticRow:{width:'100%',maxWidth:510,flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:24,gap:12},hapticTitle:{fontSize:15,color:c.ink,fontWeight:'600'},hapticHint:{fontSize:13,color:c.muted,marginTop:4},creditButton:{marginTop:28,paddingVertical:8},credit:{fontSize:13,color:c.muted,textDecorationLine:'underline'},result:{width:'100%',maxWidth:510,paddingTop:32},resultTitle:{fontSize:29,color:c.ink,fontWeight:'600',marginTop:16},resultSubtitle:{fontSize:14,color:c.muted,marginTop:4},rule:{height:1,backgroundColor:c.line,marginVertical:24},verse:{fontSize:26,lineHeight:42,color:c.ink},reference:{fontSize:13,color:c.muted,marginTop:12},languageRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:28},sectionLabel:{fontSize:11,letterSpacing:1,color:c.accent,fontWeight:'700',marginTop:24},languageButton:{paddingHorizontal:14,paddingVertical:8,borderWidth:1,borderColor:c.line,borderRadius:20},languageText:{fontSize:13,fontWeight:'600',color:c.ink},meaning:{fontSize:17,lineHeight:27,color:c.ink,marginTop:12},primary:{marginTop:32,backgroundColor:c.accent,borderRadius:24,paddingVertical:14,alignItems:'center'},primaryText:{color:c.onAccent,fontSize:15,fontWeight:'600'},
});}
