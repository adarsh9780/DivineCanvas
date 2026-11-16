import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, AppState, Easing, FlatList, Image, Linking, Modal, NativeModules, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import * as SQLite from 'expo-sqlite';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Directory, File, Paths } from 'expo-file-system';
import { chapterImage, gitaImages } from './bookBackgrounds';
import Svg, { Path } from 'react-native-svg';
import { FilterImage } from 'react-native-svg/filter-image';
import type { Filters } from 'react-native-svg/filter-image';
import Slider from '@react-native-community/slider';
import { StatusBar } from 'expo-status-bar';
import { sharePassageImage } from './shareImage';
import { speechEngines, defaultSpeechEngineId } from './speech';
import type { GeneratedSpeech, SpeechEngine } from './speech/engine';
import { PARADEE_DOWNLOAD_BYTES } from './speech/paradee/assets';
import { isParadeeInstalled } from './speech/paradee/storage';
import { dictionaryAvailable, downloadDictionary, lookupWord } from './dictionary';
import type { DictionaryMeaning } from './dictionaryEngine';
import { wordnetNotice } from './dictionaryNotice';
import { chapters, passages, Passage } from './book';
import { CHAPTER_POSITION_PREFIX, chapterPositionKey, chapterResumeIndex, chapterReadingProgress, SAVE_POSITION_SQL } from './readingProgress';

import { backgrounds, backgroundLabels, palettes, fontSizes, parseAppearance, Background, ColorTheme, ReadingFontSize, Palette } from './readingAppearance';

function newImageId() { return `user-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`; }
function newImageSeed() { return Math.floor(Math.random() * 4294967295) || 1; }

type UploadedImage = {id: string; filename: string; thumbFilename?: string};
type Saved = Record<string, string>;
type Screen = 'read' | 'chapters' | 'saved';
type NavigationItem = {key: string; title: string; detail: string; idx: number; progress?: {percent: number; label: string}};

function AutoScrollCountdown({seconds, active, finished, colors}: {seconds: number; active: boolean; finished: boolean; colors: Palette}) {
  const [remaining, setRemaining] = useState(seconds);
  const [progress] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (!active) return;
    const startedAt = Date.now();
    const animation = Animated.timing(progress, {toValue:0, duration:seconds * 1000, easing:Easing.linear, useNativeDriver:true});
    animation.start();
    const clock = setInterval(() => setRemaining(Math.max(0, Math.ceil(seconds - (Date.now() - startedAt) / 1000))), 200);
    return () => { clearInterval(clock); animation.stop(); progress.setValue(1); };
  }, [active, progress, seconds]);

  return <View accessibilityRole="timer" accessibilityLabel={finished ? 'Auto-scroll finished' : active ? `Next passage in ${remaining} seconds` : 'Auto-scroll paused'} style={{minWidth:68,alignItems:'center',gap:5}}>
    <Text style={{fontSize:13,fontWeight:'600',color:colors.muted,fontVariant:['tabular-nums']}}>{finished ? 'Finished' : active ? `${remaining}s` : 'Paused'}</Text>
    <View style={{height:2,width:48,borderRadius:1,backgroundColor:colors.line,overflow:'hidden'}}><Animated.View style={{height:2,width:48,backgroundColor:colors.accent,transform:[{scaleX:active ? progress : 1}]}}/></View>
  </View>;
}


export default function App() {
  const { height, width } = useWindowDimensions();
  const list = useRef<FlatList<Passage>>(null);
  const db = useRef<SQLite.SQLiteDatabase | null>(null);
  const [ready, setReady] = useState(false);
  const readerView = useRef<React.ComponentRef<typeof View>>(null);
  const sharing = useRef(false);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [settingsPage, setSettingsPage] = useState<'menu' | 'reading' | 'appearance' | null>(null);
  const [background, setBackground] = useState<Background>('images');
  const [colorTheme, setColorTheme] = useState<ColorTheme>('paper');
  const [imageSeed, setImageSeed] = useState(1);
  const [selectedImages, setSelectedImages] = useState<string[]>(() => gitaImages.map(image => image.id));
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [addingImages, setAddingImages] = useState(false);
  const [imageTone, setImageTone] = useState<'color' | 'monochrome'>('color');
  const [imageBlur, setImageBlur] = useState(0);
  const imageFilters = useMemo<Filters>(() => {
    const filters: Filters = [];
    if (imageTone === 'monochrome') filters.push({name:'feColorMatrix',type:'saturate',values:[0]});
    if (imageBlur > 0) filters.push({name:'feGaussianBlur',stdDeviation:imageBlur});
    return filters;
  }, [imageTone, imageBlur]);
  const [fontSize, setFontSize] = useState<ReadingFontSize>(26);
  const colors = palettes[colorTheme];
  const styles = useMemo(() => createStyles(colors), [colors]);
  const bookImages = useMemo(() => [...gitaImages, ...uploadedImages.map(image => ({id:image.id, source:{uri:new File(Paths.document, 'book-backgrounds', image.filename).uri}, thumbnail:{uri:new File(Paths.document, 'book-backgrounds', image.thumbFilename ?? image.filename).uri}}))], [uploadedImages]);
  const activeImages = useMemo(() => bookImages.filter(image => selectedImages.includes(image.id)), [bookImages, selectedImages]);
  const [screen, setScreen] = useState<Screen>('read');
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(false);
  const [autoScrollSeconds, setAutoScrollSeconds] = useState(15);
  const [touchingReader, setTouchingReader] = useState(false);
  const [interactionCount, setInteractionCount] = useState(0);
  const speechEngine = useRef<SpeechEngine | null>(null);
  const speechAbort = useRef<AbortController | null>(null);
  const speechFile = useRef<GeneratedSpeech | null>(null);
  const speechDownloadAbort = useRef<AbortController | null>(null);
  const [voiceInstalled, setVoiceInstalled] = useState(() => Platform.OS !== 'web' && isParadeeInstalled());
  const [voiceDownload, setVoiceDownload] = useState<number | null>(null);
  const [narrating, setNarrating] = useState(false);
  const narrationPlayer = useAudioPlayer(null);
  const runtimeAvailable = Platform.OS !== 'web' && !!NativeModules.Onnxruntime;
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [musicVolume, setMusicVolume] = useState(0.2);
  const [appActive, setAppActive] = useState(AppState.currentState == null || AppState.currentState === 'active');
  const musicPlayer = useAudioPlayer(require('../assets/audio/krishna-flute.mp3'));
  const musicStatus = useAudioPlayerStatus(musicPlayer);
  const [musicError, setMusicError] = useState(false);
  const [musicAttempt, setMusicAttempt] = useState(0);
  const musicFailed = musicError || !!musicStatus.error;
  const waitingForMusic = ready && musicEnabled && appActive && screen === 'read' && !musicStatus.playing && !musicFailed;

  useEffect(() => {
    if (!ready || !musicEnabled || !appActive || screen !== 'read' || musicStatus.playing || musicFailed) return;
    const timer = setTimeout(() => setMusicError(true), 60_000);
    return () => clearTimeout(timer);
  }, [ready, musicEnabled, appActive, screen, musicStatus.playing, musicFailed, musicAttempt]);


  function retryMusic() {
    musicPlayer.replace(require('../assets/audio/krishna-flute.mp3'));
    setMusicError(false);
    setMusicAttempt(attempt => attempt + 1);
  }

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => setAppActive(state === 'active'));
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    // Expo Audio exposes playback configuration through mutable native player properties.
    // eslint-disable-next-line react-hooks/immutability
    musicPlayer.loop = true;
    musicPlayer.volume = narrating ? musicVolume * 0.2 : musicVolume;
  }, [musicPlayer, musicVolume, narrating]);
  useEffect(() => {
    let cancelled = false;
    if (ready && musicEnabled && appActive && screen === 'read' && musicStatus.isLoaded && !musicFailed) {
      void setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false, interruptionMode: 'mixWithOthers' })
        .then(() => { if (!cancelled) musicPlayer.play(); })
        .catch(error => { if (!cancelled) { console.warn('Unable to start reading music:', error); setMusicError(true); } });
    } else {
      musicPlayer.pause();
    }
    return () => { cancelled = true; musicPlayer.pause(); };
  }, [musicPlayer, ready, musicEnabled, appActive, screen, musicStatus.isLoaded, musicFailed, musicAttempt]);
  const [index, setIndex] = useState(0);
  const [language, setLanguage] = useState<'en' | 'hi'>('en');
  const [saved, setSaved] = useState<Saved>({});
  const [chapterPositions, setChapterPositions] = useState<Record<number, string>>({});
  const positionWrites = useRef<Promise<void>>(Promise.resolve());
  const [editing, setEditing] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const selectionInputs = useRef(new Map<string, React.ComponentRef<typeof TextInput>>());
  const activeSelection = useRef<{passageId: string; start: number; end: number} | null>(null);
  const touchStart = useRef<{x: number; y: number; time: number; selection: {passageId: string; start: number; end: number}} | null>(null);
  const [selectedWord, setSelectedWord] = useState<{passageId: string; language: 'en' | 'hi'; word: string} | null>(null);
  const [dictionaryWord, setDictionaryWord] = useState<string | null>(null);
  const [dictionaryLanguage, setDictionaryLanguage] = useState<'en' | 'hi'>('en');
  const [dictionaryStatus, setDictionaryStatus] = useState<'prompt' | 'loading' | 'results' | 'error' | 'unsupported'>('prompt');
  const [dictionaryError, setDictionaryError] = useState('');
  const [meanings, setMeanings] = useState<DictionaryMeaning[]>([]);
  const [showDictionaryLicense, setShowDictionaryLicense] = useState(false);
  const dictionaryRequest = useRef(0);
  const [dictionaryAnimation] = useState(() => new Animated.Value(0));
  const dictionaryClosing = useRef(false);
  const [passageHeights, setPassageHeights] = useState<Record<string, number>>({});
  const [readerHeight, setReaderHeight] = useState(Math.max(200, height - 180));

  useEffect(() => { (async () => {
    try {
      const database = await SQLite.openDatabaseAsync('kgram.db');
      await database.execAsync('CREATE TABLE IF NOT EXISTS saves (id TEXT PRIMARY KEY NOT NULL, note TEXT NOT NULL DEFAULT ""); CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);');
      db.current = database;
      const rows = await database.getAllAsync<{id: string; note: string}>('SELECT id, note FROM saves');
      setSaved(Object.fromEntries(rows.map(row => [row.id, row.note])));
      const position = await database.getFirstAsync<{value: string}>("SELECT value FROM settings WHERE key = 'position'");
      const last = passages.findIndex(p => p.id === position?.value);
      const chapterRows = await database.getAllAsync<{key: string; value: string}>(
        'SELECT key, value FROM settings WHERE key LIKE ?', `${CHAPTER_POSITION_PREFIX}%`,
      );
      const positions: Record<number, string> = {};
      for (const row of chapterRows) {
        const chapter = Number(row.key.slice(CHAPTER_POSITION_PREFIX.length));
        if (passages.some(p => p.chapter === chapter && p.id === row.value)) positions[chapter] = row.value;
      }
      // Seed the chapter from the previous version's last-opened passage.
      if (last >= 0) {
        setIndex(last);
        const passage = passages[last];
        if (!positions[passage.chapter]) {
          positions[passage.chapter] = passage.id;
          await database.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', chapterPositionKey(passage.chapter), passage.id);
        }
      }
      if (last < 0 && passages[0]) {
        const first = passages[0];
        positions[first.chapter] = first.id;
        await database.runAsync(SAVE_POSITION_SQL, 'position', first.id, chapterPositionKey(first.chapter), first.id);
      }
      setChapterPositions(positions);
      const lang = await database.getFirstAsync<{value: string}>("SELECT value FROM settings WHERE key = 'language'");
      if (lang?.value === 'hi') setLanguage('hi');
      const appearanceRows = await database.getAllAsync<{key: string; value: string}>("SELECT key, value FROM settings WHERE key IN ('background', 'font-size', 'gita-backgrounds', 'color-theme', 'image-tone', 'image-blur', 'music-enabled', 'music-volume', 'auto-scroll-enabled', 'auto-scroll-seconds')");
      const values = Object.fromEntries(appearanceRows.map(row => [row.key, row.value]));
      if (values['auto-scroll-enabled'] === 'true') setAutoScrollEnabled(true);
      const savedScrollSeconds = Number(values['auto-scroll-seconds']);
      if (Number.isInteger(savedScrollSeconds) && savedScrollSeconds >= 5 && savedScrollSeconds <= 60) setAutoScrollSeconds(savedScrollSeconds);
      if (values['music-enabled'] === 'false') setMusicEnabled(false);
      const savedVolume = values['music-volume'] === undefined ? NaN : Number(values['music-volume']);
      if (Number.isFinite(savedVolume) && savedVolume >= 0 && savedVolume <= 1) setMusicVolume(savedVolume);
      const appearance = parseAppearance(values.background, values['font-size'], values['color-theme']);
      setBackground(appearance.background); setFontSize(appearance.fontSize); setColorTheme(appearance.colorTheme);
      if (values['image-tone'] === 'color' || values['image-tone'] === 'monochrome') setImageTone(values['image-tone']);
      const savedBlur = values['image-blur'] === undefined ? NaN : Number(values['image-blur']);
      if (Number.isInteger(savedBlur) && savedBlur >= 0 && savedBlur <= 8) setImageBlur(savedBlur);
      if (values['gita-backgrounds']) {
        try {
          const data = JSON.parse(values['gita-backgrounds']) as {seed?: unknown; selected?: unknown; uploaded?: unknown};
          const uploads: UploadedImage[] = Array.isArray(data.uploaded) ? data.uploaded.filter((image): image is UploadedImage => !!image && typeof image.id === 'string' && typeof image.filename === 'string' && /^[a-zA-Z0-9._-]+$/.test(image.filename) && Platform.OS !== 'web' && new File(Paths.document, 'book-backgrounds', image.filename).exists).map(image => ({id:image.id, filename:image.filename, thumbFilename:typeof image.thumbFilename === 'string' && /^[a-zA-Z0-9._-]+$/.test(image.thumbFilename) && new File(Paths.document, 'book-backgrounds', image.thumbFilename).exists ? image.thumbFilename : undefined})) : [];
          const valid = new Set([...gitaImages.map(image => image.id), ...uploads.map(image => image.id)]);
          const selected = Array.isArray(data.selected) ? data.selected.filter((id): id is string => typeof id === 'string' && valid.has(id)) : [];
          if (typeof data.seed === 'number' && Number.isFinite(data.seed)) setImageSeed(data.seed);
          setUploadedImages(uploads);
          if (selected.length) setSelectedImages(selected);
        } catch { /* Reset invalid image preferences to the bundled collection. */ }
      } else {
        const seed = newImageSeed();
        setImageSeed(seed);
        await database.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'gita-backgrounds', JSON.stringify({seed, selected:gitaImages.map(image => image.id), uploaded:[]}));
      }
      setReady(true);
    } catch { Alert.alert('Unable to open local storage', 'Please restart the app and try again.'); }
  })(); }, []);

  async function setting(key: string, value: string) { await db.current?.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', key, value); }
  const preferenceWrites = useRef<Promise<void>>(Promise.resolve());
  function savePreference(key: string, value: string) {
    preferenceWrites.current = preferenceWrites.current.then(() => setting(key, value))
      .catch(() => Alert.alert('Setting could not be saved', 'Please try selecting it again.'));
  }
  function saveImagePreferences(selected: string[], uploaded: UploadedImage[]) {
    savePreference('gita-backgrounds', JSON.stringify({seed:imageSeed, selected, uploaded}));
  }
  function toggleImage(id: string) {
    const next = selectedImages.includes(id) ? selectedImages.filter(value => value !== id) : [...selectedImages, id];
    if (!next.length) { Alert.alert('Choose an image', 'Keep at least one image selected.'); return; }
    setSelectedImages(next); saveImagePreferences(next, uploadedImages);
  }
  async function addImages() {
    if (addingImages) return;
    if (Platform.OS === 'web') { Alert.alert('Use the mobile app', 'Adding your own images is available on iPhone and Android.'); return; }
    setAddingImages(true);
    const copied: File[] = [];
    try {
      const result = await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsMultipleSelection:true,quality:1});
      if (result.canceled) return;
      const directory = new Directory(Paths.document, 'book-backgrounds');
      directory.create({idempotent:true,intermediates:true});
      const additions: UploadedImage[] = [];
      for (const asset of result.assets) {
        const id = newImageId();
        // Bound dimensions while decoding, so high-resolution photos do not fill memory.
        const keepTransparency = asset.mimeType === 'image/png' || /\.png$/i.test(asset.fileName ?? '');
        const context = ImageManipulator.manipulate(asset.uri, {maxWidth:1920,maxHeight:1920});
        let fullUri: string;
        try {
          const rendered = await context.renderAsync();
          try { fullUri = (await rendered.saveAsync({compress:0.8,format:keepTransparency ? SaveFormat.PNG : SaveFormat.JPEG})).uri; }
          finally { rendered.release(); }
        } finally { context.release(); }
        const thumbContext = ImageManipulator.manipulate(fullUri, {maxWidth:240,maxHeight:360});
        let thumbUri: string;
        try {
          const rendered = await thumbContext.renderAsync();
          try { thumbUri = (await rendered.saveAsync({compress:0.75,format:keepTransparency ? SaveFormat.PNG : SaveFormat.JPEG})).uri; }
          finally { rendered.release(); }
        } finally { thumbContext.release(); }
        const extension = keepTransparency ? 'png' : 'jpg';
        const destination = new File(directory, `${id}.${extension}`);
        const thumbnail = new File(directory, `${id}-thumb.${extension}`);
        copied.push(destination); await new File(fullUri).copy(destination);
        copied.push(thumbnail); await new File(thumbUri).copy(thumbnail);
        additions.push({id, filename:destination.name, thumbFilename:thumbnail.name});
      }
      const nextUploaded = [...uploadedImages, ...additions];
      const nextSelected = [...selectedImages, ...additions.map(image => image.id)];
      setUploadedImages(nextUploaded); setSelectedImages(nextSelected); saveImagePreferences(nextSelected, nextUploaded);
    } catch {
      for (const file of copied) { try { if (file.exists) file.delete(); } catch { /* Ignore cleanup errors. */ } }
      Alert.alert('Could not add images', 'Please try choosing your photos again.');
    } finally { setAddingImages(false); }
  }
  async function toggle(p: Passage) {
    if (Object.hasOwn(saved, p.id)) {
      await db.current?.runAsync('DELETE FROM saves WHERE id = ?', p.id);
      setSaved(current => { const next = {...current}; delete next[p.id]; return next; });
    } else {
      await db.current?.runAsync('INSERT OR REPLACE INTO saves (id, note) VALUES (?, ?)', p.id, '');
      setSaved(current => ({...current, [p.id]: ''}));
      setNote(''); setEditing(p.id);
    }
  }
  async function saveNote() {
    if (!editing) return;
    await db.current?.runAsync('UPDATE saves SET note = ? WHERE id = ?', note, editing);
    setSaved(current => ({ ...current, [editing]: note })); setEditing(null);
  }
  const rememberPosition = useCallback((i: number) => {
    const passage = passages[i];
    const database = db.current;
    if (!passage || !database) return;
    setIndex(i);
    setSelectedWord(null);
    setChapterPositions(current => ({...current, [passage.chapter]: passage.id}));
    // Keep rapid swipes in order; both positions are saved in one atomic statement.
    positionWrites.current = positionWrites.current.then(async () => {
      await database.runAsync(SAVE_POSITION_SQL, 'position', passage.id, chapterPositionKey(passage.chapter), passage.id);
    }).catch(() => Alert.alert('Reading position could not be saved', 'Please try opening this passage again.'));
  }, []);
  async function sharePassage(passage: Passage) {
    if (sharing.current) return;
    const view = readerView.current;
    if (!view) return;
    sharing.current = true;
    setSharingId(passage.id);
    try {
      // Let React commit the hidden actions before capturing the visible page.
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      await sharePassageImage(view, `${passage.id.replace(/[^a-z0-9-]/gi, '-')}.png`);
    } catch {
      Alert.alert('Could not share this passage', 'Please try again.');
    } finally {
      sharing.current = false;
      setSharingId(null);
    }
  }
  function openDictionaryAnimation() {
    if (dictionaryClosing.current) return;
    Animated.timing(dictionaryAnimation, {toValue: 1, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web'}).start();
  }
  function closeDictionary() {
    if (dictionaryClosing.current) return;
    dictionaryClosing.current = true;
    dictionaryRequest.current++;
    Animated.timing(dictionaryAnimation, {toValue: 0, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: Platform.OS !== 'web'}).start(({finished}) => {
      if (finished) { setDictionaryWord(null); dictionaryClosing.current = false; }
    });
  }
  async function showWord(word: string, lang: 'en' | 'hi', download = false) {
    if (dictionaryClosing.current) return;
    const request = ++dictionaryRequest.current;
    setDictionaryWord(word); setDictionaryLanguage(lang); setShowDictionaryLicense(false);
    if (lang !== 'en' || Platform.OS === 'web') { setDictionaryStatus('unsupported'); return; }
    if (!download && !dictionaryAvailable()) { setDictionaryStatus('prompt'); return; }
    setDictionaryStatus('loading');
    try {
      if (download) await downloadDictionary();
      // Let the loading indicator render before processing the downloaded archive.
      await new Promise<void>(resolve => setTimeout(resolve, 50));
      const result = await lookupWord(word);
      if (request === dictionaryRequest.current) { setMeanings(result); setDictionaryStatus('results'); }
    } catch {
      if (request === dictionaryRequest.current) {
        setDictionaryError(download ? 'Download failed. Check your connection and try again.' : 'Could not open the dictionary. Please try again.');
        setDictionaryStatus('error');
      }
    }
  }
  const stopNarration = useCallback(() => {
    speechAbort.current?.abort(); speechAbort.current = null;
    narrationPlayer.pause();
    const file = speechFile.current; speechFile.current = null;
    if (file) void file.dispose().catch(() => {});
    setNarrating(false);
  }, [narrationPlayer]);

  useEffect(() => {
    const subscription = narrationPlayer.addListener('playbackStatusUpdate', status => {
      if (status.didJustFinish) stopNarration();
      else if (status.error && speechAbort.current) {stopNarration(); Alert.alert('Could not play narration', status.error);}
    });
    return () => subscription.remove();
  }, [narrationPlayer, stopNarration]);

  useEffect(() => () => { stopNarration(); }, [index, language, screen, appActive, stopNarration]);

  async function getSpeechEngine() {
    if (!speechEngine.current) speechEngine.current = await speechEngines.create(defaultSpeechEngineId);
    return speechEngine.current;
  }
  async function downloadVoice() {
    if (!runtimeAvailable) {Alert.alert('Development build needed', 'This voice requires an app build with the speech runtime. Expo Go cannot run it.'); return;}
    if (voiceDownload !== null) return;
    const controller = new AbortController(); speechDownloadAbort.current = controller; setVoiceDownload(0);
    try {
      const engine = await getSpeechEngine();
      await engine.install({signal:controller.signal,onProgress:progress=>setVoiceDownload(Math.min(1,progress.completedBytes/(progress.totalBytes ?? PARADEE_DOWNLOAD_BYTES)))});
      setVoiceInstalled(true);
    } catch (error) {if (!controller.signal.aborted) Alert.alert('Voice download failed', error instanceof Error ? error.message : 'Please try again.');}
    finally {speechDownloadAbort.current = null; setVoiceDownload(null);}
  }
  async function removeVoice() {
    try {stopNarration(); const engine=await getSpeechEngine(); await engine.uninstall(); setVoiceInstalled(false);}
    catch (error) {Alert.alert('Could not remove voice', error instanceof Error ? error.message : 'Please try again.');}
  }
  async function readPassage(passage: Passage) {
    if (narrating) {stopNarration(); return;}
    if (!runtimeAvailable) {Alert.alert('Development build needed', 'This voice requires an app build with the speech runtime. Expo Go cannot run it.'); return;}
    if (!voiceInstalled) {Alert.alert('Download a voice', 'Open Settings and download the reading voice first.'); return;}
    const controller=new AbortController(); speechAbort.current=controller; setNarrating(true);
    try {
      const engine=await getSpeechEngine();
      const speechLanguage = language === 'en' ? 'en' : 'sa';
      const voice = engine.info.voices.find(candidate => candidate.languages.includes(speechLanguage));
      if (!voice) throw new Error('No voice is available for this language.');
      const result=await engine.synthesize({text:passage[language],language:speechLanguage,voiceId:voice.id},controller.signal);
      if (controller.signal.aborted) {await result.dispose(); return;}
      speechFile.current=result;
      await setAudioModeAsync({playsInSilentMode:true,shouldPlayInBackground:false,interruptionMode:'mixWithOthers'});
      if (controller.signal.aborted) {await result.dispose(); return;}
      narrationPlayer.replace({uri:result.uri}); narrationPlayer.play();
    } catch(error) {if (!controller.signal.aborted) {stopNarration(); Alert.alert('Could not read this passage', error instanceof Error ? error.message : 'Please try again.');}}
  }
  useEffect(() => () => { speechDownloadAbort.current?.abort(); speechAbort.current?.abort(); const engine=speechEngine.current; if (engine) void engine.dispose(); }, []);

  useEffect(() => {
    if (!ready || !autoScrollEnabled || !appActive || screen !== 'read' || settingsPage !== null || editing !== null || dictionaryWord !== null || sharingId !== null || selectedWord !== null || narrating || touchingReader || index >= passages.length - 1) return;
    const timer = setTimeout(() => {
      const next = index + 1;
      if (!list.current) return;
      list.current.scrollToIndex({index:next, animated:true});
      rememberPosition(next);
    }, autoScrollSeconds * 1000);
    return () => clearTimeout(timer);
  }, [ready, autoScrollEnabled, autoScrollSeconds, appActive, screen, settingsPage, editing, dictionaryWord, sharingId, selectedWord, narrating, touchingReader, index, interactionCount, rememberPosition]);

  function jump(i: number) { if (i < 0) return; rememberPosition(i); setScreen('read'); }
  const autoScrollFinished = index >= passages.length - 1;
  const autoScrollRunning = ready && autoScrollEnabled && appActive && screen === 'read' && settingsPage === null && editing === null && dictionaryWord === null && sharingId === null && selectedWord === null && !narrating && !touchingReader && !autoScrollFinished;
  if (!ready) return <View style={styles.loading}><ActivityIndicator color={colors.accent}/></View>;
  return <SafeAreaView style={styles.root}
    onTouchCancel={() => {setTouchingReader(false); setInteractionCount(count => count + 1);}}
    onTouchStart={event => {
      setTouchingReader(true);
      const selection = activeSelection.current;
      touchStart.current = selection ? {x:event.nativeEvent.pageX,y:event.nativeEvent.pageY,time:Date.now(),selection} : null;
    }}
    onTouchEnd={event => {
      setTouchingReader(false);
      setInteractionCount(count => count + 1);
      const start = touchStart.current;
      touchStart.current = null;
      if (!start || Date.now() - start.time > 350 || Math.hypot(event.nativeEvent.pageX - start.x, event.nativeEvent.pageY - start.y) > 12) return;
      // Let buttons and the system's text menu receive their tap first.
      setTimeout(() => {
        const current = activeSelection.current;
        if (current && (current.passageId !== start.selection.passageId || current.start !== start.selection.start || current.end !== start.selection.end)) return;
        const input = selectionInputs.current.get(start.selection.passageId);
        input?.setSelection(start.selection.end, start.selection.end);
        input?.blur();
        activeSelection.current = null;
        setSelectedWord(null);
      }, 0);
    }}><StatusBar style={colors.dark ? "light" : "dark"} />
    <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="Open settings" accessibilityState={{expanded:settingsPage !== null}} onPress={() => setSettingsPage('menu')} style={styles.profileButton}><View accessible={false} style={styles.profileGlyph}><View style={styles.profileHead}/><View style={styles.profileShoulders}/></View></Pressable>{autoScrollEnabled && screen === 'read' && <AutoScrollCountdown key={`${index}-${interactionCount}-${autoScrollSeconds}-${autoScrollRunning}`} seconds={autoScrollSeconds} active={autoScrollRunning} finished={autoScrollFinished} colors={colors}/>}<View style={{flexDirection:'row',alignItems:'center',gap:8}}><Pressable accessibilityRole="button" accessibilityLabel={waitingForMusic ? 'Loading reading music' : musicFailed && musicEnabled ? 'Music unavailable. Tap to retry' : musicEnabled ? 'Mute reading music' : 'Unmute reading music'} accessibilityState={{disabled:waitingForMusic}} disabled={waitingForMusic} onPress={() => {if (musicFailed && musicEnabled) {retryMusic(); return;} const next = !musicEnabled; setMusicEnabled(next); if (!next) setMusicError(false); void setting('music-enabled', String(next));}} style={styles.profileButton}>{waitingForMusic ? <ActivityIndicator color={colors.ink} size="small"/> : musicFailed && musicEnabled ? <Text style={{color:colors.ink,fontSize:22,fontWeight:'600'}}>!</Text> : <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={colors.ink} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><Path d="M11 5 6 9H3v6h3l5 4V5Z"/>{musicEnabled ? <Path d="M15 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12"/> : <Path d="m16 9 5 6m0-6-5 6"/>}</Svg>}</Pressable><Pressable accessibilityRole="button" accessibilityLabel="Switch between English translation and Sanskrit" onPress={() => { const next = language === 'en' ? 'hi' : 'en'; setLanguage(next); void setting('language', next); }} style={styles.language}><Text style={styles.languageText}>{language === 'en' ? 'English ▾' : 'संस्कृत ▾'}</Text></Pressable></View></View>
    <View ref={readerView} collapsable={false} style={styles.main} onLayout={e => setReaderHeight(e.nativeEvent.layout.height)}>
      {screen === 'read' && background === 'images' && activeImages.length > 0 && <View pointerEvents="none" style={styles.fixedBackground}><FilterImage source={chapterImage(activeImages, passages[index]?.chapter ?? 1, imageSeed)?.source} style={styles.backgroundImage} resizeMode="cover" filters={imageFilters}/><View style={styles.backgroundScrim}/></View>}
      {screen === 'read' ? <FlatList key={`${readerHeight}-${width}`} ref={list} data={passages} initialScrollIndex={index} getItemLayout={(_, i) => ({length: readerHeight, offset: readerHeight * i, index: i})} pagingEnabled scrollEnabled={sharingId === null} showsVerticalScrollIndicator={false} keyExtractor={p => p.id} onMomentumScrollEnd={e => { const next = Math.max(0, Math.min(passages.length - 1, Math.round(e.nativeEvent.contentOffset.y / readerHeight))); rememberPosition(next); }} renderItem={({item}) => <View style={[styles.page, background === 'images' && styles.transparentPage, {height: readerHeight}]}>

        <ScrollView style={styles.reading} contentContainerStyle={styles.readingContent}><TextInput
          accessibilityLabel="Passage text"
          key={`${item.id}-${language}-${fontSize}-${width}`}
          onContentSizeChange={({nativeEvent: {contentSize}}) => {
            const key = `${item.id}-${language}-${fontSize}-${width}`;
            const height = Math.ceil(contentSize.height);
            setPassageHeights(current => current[key] === height ? current : {...current, [key]:height});
          }}
          ref={input => { if (input) selectionInputs.current.set(item.id, input); else selectionInputs.current.delete(item.id); }}
          multiline
          value={item[language]}
          showSoftInputOnFocus={false}
          caretHidden
          scrollEnabled={false}
          underlineColorAndroid="transparent"
          autoCorrect={false}
          spellCheck={false}
          onSelectionChange={({nativeEvent: {selection}}) => {
            const previous = activeSelection.current;
            if (selection.start !== selection.end) {
              if (!previous || previous.passageId !== item.id) void Haptics.selectionAsync().catch(() => {});
              activeSelection.current = {passageId:item.id, start:selection.start, end:selection.end};
            } else if (previous?.passageId === item.id) {
              activeSelection.current = null;
            }
            const selected = item[language].slice(selection.start, selection.end).trim();
            const word = selected.replace(/^[^\p{L}\p{M}]+|[^\p{L}\p{M}]+$/gu, '');
            if (/^[\p{L}\p{M}]+(?:['’\-][\p{L}\p{M}]+)*$/u.test(word)) {
              setSelectedWord({passageId:item.id, language, word});
            } else {
              setSelectedWord(current => current?.passageId === item.id ? null : current);
            }
          }}
          style={[styles.passage,styles.passageInput,background === 'images' && styles.imagePassage,{fontSize,lineHeight:Math.round(fontSize * 1.5),height:passageHeights[`${item.id}-${language}-${fontSize}-${width}`]}]}
        /></ScrollView>
        <View><View style={styles.pageBottom}><View style={styles.referenceGroup}><Text accessibilityLabel={`Bhagavad Gita, chapter ${item.chapter}, ${item.label}`} style={[styles.reference,background === 'images' && styles.imageReference]}>Gita {item.chapter}.{item.label.replace(/^TEXTS?\s+/i, '')}</Text>{selectedWord?.passageId === item.id && selectedWord.language === language && sharingId !== item.id && <Pressable accessibilityRole="button" accessibilityLabel={`Look up ${selectedWord.word}`} onPress={() => void showWord(selectedWord.word, selectedWord.language)} style={styles.lookupButton}><Text numberOfLines={1} style={styles.lookupText}>Look up “{selectedWord.word}”</Text></Pressable>}</View><View style={[styles.actions,sharingId === item.id && styles.hiddenActions]}><Pressable accessibilityRole="button" accessibilityLabel={narrating ? 'Stop reading aloud' : 'Read passage aloud'} onPress={() => void readPassage(item)} style={styles.action}><Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.accent} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">{narrating ? <Path d="M7 7h10v10H7z"/> : <Path d="M8 5v14l11-7L8 5z"/>}</Svg></Pressable><Pressable accessibilityRole="button" accessibilityLabel={Object.hasOwn(saved, item.id) ? 'Remove saved passage' : 'Save passage'} onPress={() => void toggle(item)} style={styles.action}><Text style={styles.heart}>{Object.hasOwn(saved, item.id) ? '♥' : '♡'}</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Share passage image" accessibilityState={{busy:sharingId===item.id}} disabled={sharingId!==null} onPress={() => void sharePassage(item)} style={styles.action}><Svg accessible={false} width={22} height={22} viewBox="0 0 24 24" fill="none"><Path d="M22 2 9.5 14.5M22 2l-7.5 20-5-7.5L2 9.5 22 2Z" stroke={colors.accent} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" /></Svg></Pressable>{Object.hasOwn(saved, item.id) && <Pressable accessibilityRole="button" accessibilityLabel="Edit note" onPress={() => {setEditing(item.id); setNote(saved[item.id]);}} style={styles.action}><Text style={styles.noteIcon}>✎</Text></Pressable>}</View></View></View>
      </View>}/> : <View style={styles.section}><Text style={styles.title}>{screen === 'chapters' ? 'Chapters' : 'Saved passages'}</Text><FlatList<NavigationItem> data={screen === 'chapters' ? chapters.map(c => {
        const resumeIndex = chapterResumeIndex(passages, c.number, chapterPositions[c.number]);
        return {key: String(c.number), title: c.title,
          detail: `CHAPTER ${String(c.number).padStart(2, '0')}`,
          progress: chapterReadingProgress(passages, c.number, chapterPositions[c.number]),
          idx: resumeIndex};
      }) : passages.filter(p => Object.hasOwn(saved, p.id)).map(p => ({key: p.id, title: p[language], detail: saved[p.id] || p.label, progress: undefined, idx: passages.indexOf(p)}))} keyExtractor={item => item.key} ListEmptyComponent={<Text style={styles.empty}>Nothing saved yet. Tap the heart while reading to save a passage.</Text>} renderItem={({item}) => <Pressable accessibilityRole="button" onPress={() => jump(item.idx)} style={styles.row}><View style={{flex: 1}}><Text style={styles.rowLabel}>{item.detail}</Text><Text style={styles.rowTitle} numberOfLines={2}>{item.title}</Text>{item.progress && <View style={styles.chapterProgress}>
          <View style={styles.progressLabels}><Text style={styles.progressText}>{item.progress.label}</Text><Text style={styles.progressText}>{item.progress.percent}%</Text></View>
          <View accessibilityRole="progressbar" accessibilityLabel={`Reading position: ${item.progress.label}`} accessibilityValue={{min:0,max:100,now:item.progress.percent}} style={styles.progressTrack}><View style={[styles.progressFill,{width:`${item.progress.percent}%`}]}/></View>
        </View>}</View><Text style={styles.arrow}>↗</Text></Pressable>}/></View>}
    </View>
    <View style={styles.nav}>{(['read','chapters','saved'] as Screen[]).map(tab => <Pressable key={tab} accessibilityRole="button" accessibilityState={{selected: screen === tab}} onPress={() => setScreen(tab)} style={styles.navItem}><Text style={[styles.navText, screen === tab && styles.navActive]}>{tab === 'read' ? 'Read' : tab === 'chapters' ? 'Chapters' : 'Saved'}</Text><View style={[styles.dot, screen === tab && styles.dotActive]}/></Pressable>)}</View>
    <Modal visible={settingsPage !== null} animationType="slide" onRequestClose={() => setSettingsPage(settingsPage === 'menu' ? null : 'menu')}>
      <SafeAreaProvider><SafeAreaView style={styles.settingsScreen}>
        <View style={styles.settingsNavigationHeader}>
          <Pressable accessibilityRole="button" accessibilityLabel={settingsPage === 'menu' ? 'Back to reader' : 'Back to settings'} onPress={() => setSettingsPage(settingsPage === 'menu' ? null : 'menu')} style={styles.settingsBackButton}><Text style={styles.backIcon}>‹</Text></Pressable>
          <Text accessibilityRole="header" style={styles.settingsNavigationTitle}>{settingsPage === 'reading' ? 'Reading customisation' : settingsPage === 'appearance' ? 'App appearance' : 'Settings'}</Text>
        </View>
        {settingsPage === 'menu' ? <ScrollView contentContainerStyle={styles.settingsList}>
          <Pressable accessibilityRole="button" accessibilityLabel="Reading customisation" onPress={() => setSettingsPage('reading')} style={styles.settingsListRow}>
            <View style={styles.settingsMenuText}><Text style={styles.settingsMenuTitle}>Reading customisation</Text><Text style={styles.settingsMenuDescription}>Adjust text size and reading background.</Text></View><Text style={styles.settingsChevron}>›</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="App appearance" onPress={() => setSettingsPage('appearance')} style={styles.settingsListRow}>
            <View style={styles.settingsMenuText}><Text style={styles.settingsMenuTitle}>App appearance</Text><Text style={styles.settingsMenuDescription}>Choose the colors used throughout the app.</Text></View><Text style={styles.settingsChevron}>›</Text>
          </Pressable>
          <View style={styles.settingsListRow}>
            <View style={styles.settingsMenuText}><Text style={styles.settingsMenuTitle}>Reading voice</Text><Text style={styles.settingsMenuDescription}>{voiceDownload !== null ? `Downloading ${Math.round(voiceDownload*100)}%` : voiceInstalled ? 'Paradee voice is available offline.' : 'Download an offline voice (about 11 MB).'}</Text></View>
            {voiceDownload !== null ? <Pressable accessibilityRole="button" accessibilityLabel="Cancel voice download" onPress={() => speechDownloadAbort.current?.abort()}><Text style={{color:colors.accent}}>Cancel</Text></Pressable> : <Pressable accessibilityRole="button" accessibilityLabel={voiceInstalled ? 'Remove reading voice' : 'Download reading voice'} onPress={() => void (voiceInstalled ? removeVoice() : downloadVoice())}><Text style={{color:colors.accent,fontWeight:'600'}}>{voiceInstalled ? 'Remove' : 'Download'}</Text></Pressable>}
          </View>
          {!runtimeAvailable && <Text style={styles.imageHelp}>Reading aloud requires a development build.</Text>}
          <View style={styles.settingsListRow}>
            <View style={styles.settingsMenuText}><Text style={styles.settingsMenuTitle}>Auto-scroll</Text><Text style={styles.settingsMenuDescription}>Move to the next passage automatically.</Text></View>
            <Switch accessibilityLabel="Auto-scroll" value={autoScrollEnabled} onValueChange={value => {setAutoScrollEnabled(value); savePreference('auto-scroll-enabled', String(value));}} trackColor={{true: colors.accent}} />
          </View>
          <View style={{paddingVertical:18}}>
            <View style={styles.blurHeading}><Text style={styles.settingsMenuTitle}>Time per passage</Text><Text style={styles.settingsMenuDescription}>{autoScrollSeconds} seconds</Text></View>
            <Slider accessibilityLabel="Time per passage" accessibilityValue={{min:5,max:60,now:autoScrollSeconds,text:`${autoScrollSeconds} seconds`}} minimumValue={5} maximumValue={60} step={1} value={autoScrollSeconds} onValueChange={setAutoScrollSeconds} onSlidingComplete={value => {setAutoScrollSeconds(value); savePreference('auto-scroll-seconds', String(value));}} minimumTrackTintColor={colors.accent} maximumTrackTintColor={colors.line} thumbTintColor={colors.accent} tapToSeek style={styles.blurSlider}/>
            <Text style={styles.settingsMenuDescription}>Auto-scroll pauses while you interact and stops at the end of the book.</Text>
          </View>
          <View style={styles.settingsListRow}>
            <View style={styles.settingsMenuText}><Text style={styles.settingsMenuTitle}>Reading music</Text><Text style={styles.settingsMenuDescription}>Play instrumental music while reading.</Text></View>
            <Switch accessibilityLabel="Reading music" value={musicEnabled} onValueChange={value => {setMusicEnabled(value); void setting('music-enabled', String(value));}} trackColor={{true: colors.accent}} />
          </View>
          <View style={{paddingVertical: 18}}>
            <View style={styles.blurHeading}><Text style={styles.settingsMenuTitle}>Music volume</Text><Text style={styles.settingsMenuDescription}>{Math.round(musicVolume * 100)}%</Text></View>
            <Slider accessibilityLabel="Music volume" accessibilityValue={{min:0,max:100,now:Math.round(musicVolume*100)}} minimumValue={0} maximumValue={1} step={0.01} value={musicVolume} onValueChange={setMusicVolume} onSlidingComplete={value => {setMusicVolume(value); void setting('music-volume', String(value));}} minimumTrackTintColor={colors.accent} maximumTrackTintColor={colors.line} thumbTintColor={colors.accent} tapToSeek style={styles.blurSlider}/>
            <Text style={styles.settingsMenuDescription}>“Krishna Flute Music” by Alex Morgan · CC BY 4.0</Text>
            <Text accessibilityRole="link" onPress={() => void Linking.openURL('https://freemusicarchive.org/music/alex-morgan/world-devotional-music/krishna-flute-music/')} style={[styles.settingsMenuDescription, {color:colors.accent, marginTop:6}]}>Music source</Text>
            <Text accessibilityRole="link" onPress={() => void Linking.openURL('https://creativecommons.org/licenses/by/4.0/')} style={[styles.settingsMenuDescription, {color:colors.accent, marginTop:6}]}>Creative Commons license</Text>
          </View>
        </ScrollView> : settingsPage === 'reading' ? <ScrollView contentContainerStyle={styles.settingsContent}>
          <View style={styles.preferenceGroup}><View><Text style={styles.preferenceLabel}>Text size</Text><Text style={styles.imageHelp}>Choose a comfortable size for reading.</Text></View><View style={styles.sizeOptions}>
            {fontSizes.map((size,i) => <Pressable key={size} accessibilityRole="button" accessibilityLabel={`${['Small','Default','Large'][i]} text`} accessibilityState={{selected:fontSize===size}} onPress={() => {setFontSize(size); savePreference('font-size',String(size));}} style={[styles.sizeOption,fontSize===size && styles.selectedOption]}><Text style={[styles.sizeSample,{fontSize:18+i*4},fontSize===size && styles.selectedText]}>Aa</Text><Text style={[styles.optionLabel,fontSize===size && styles.selectedText]}>{['Small','Default','Large'][i]}</Text></Pressable>)}
          </View></View>
          <View style={styles.preferenceGroup}><View><Text style={styles.preferenceLabel}>Reading background</Text><Text style={styles.imageHelp}>Choose what appears behind the text.</Text></View>
            <View>
              <Pressable accessibilityRole="radio" accessibilityLabel="No image" accessibilityState={{checked:background!=='images'}} aria-checked={background!=='images'} onPress={() => {setBackground(colorTheme); savePreference('background',colorTheme);}} style={styles.choiceRow}><View style={styles.settingsMenuText}><Text style={styles.settingsMenuTitle}>No image</Text><Text style={styles.settingsMenuDescription}>Use your app background color.</Text></View>{background !== 'images' && <Text style={styles.choiceCheck}>✓</Text>}</Pressable>
              <Pressable accessibilityRole="radio" accessibilityLabel="With images" accessibilityState={{checked:background==='images'}} aria-checked={background==='images'} onPress={() => {setBackground('images'); savePreference('background','images');}} style={styles.choiceRow}><View style={styles.settingsMenuText}><Text style={styles.settingsMenuTitle}>With images</Text><Text style={styles.settingsMenuDescription}>Show an image behind each chapter.</Text></View>{background === 'images' && <Text style={styles.choiceCheck}>✓</Text>}</Pressable>
            </View>
          </View>
          {background === 'images' && <View style={styles.preferenceGroup}>
            <View><Text style={styles.preferenceLabel}>Image style</Text><Text style={styles.imageHelp}>Choose the look of your reading background.</Text></View>
            <View style={styles.imagePreview} accessible accessibilityLabel={`Background preview, ${imageTone === 'color' ? 'color' : 'black and white'}, blur ${imageBlur} of 8`}>
              <View pointerEvents="none" style={styles.fixedBackground}><FilterImage source={chapterImage(activeImages, passages[index]?.chapter ?? 1, imageSeed)?.source} style={styles.backgroundImage} resizeMode="cover" filters={imageFilters}/><View style={styles.backgroundScrim}/></View>
              <Text style={styles.imagePreviewText}>A moment to read.</Text>
            </View>
            <View>
              {([['color','Color'],['monochrome','Black and white']] as const).map(([value,label]) => <Pressable key={value} accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{checked:imageTone===value}} aria-checked={imageTone===value} onPress={() => {setImageTone(value); savePreference('image-tone',value);}} style={styles.choiceRow}><Text style={styles.paletteName}>{label}</Text>{imageTone===value && <Text style={styles.choiceCheck}>✓</Text>}</Pressable>)}
            </View>
            <View><View style={styles.blurHeading}><Text style={styles.preferenceLabel}>Blur</Text><Text style={styles.imageHelp}>{imageBlur === 0 ? 'None' : `${imageBlur} / 8`}</Text></View><Text style={styles.imageHelp}>Soften the image behind the text.</Text>
              <Slider accessibilityLabel="Background blur" accessibilityValue={{min:0,max:8,now:imageBlur,text:imageBlur === 0 ? 'No blur' : `Blur level ${imageBlur} of 8`}} minimumValue={0} maximumValue={8} step={1} value={imageBlur} onValueChange={setImageBlur} onSlidingComplete={value => {setImageBlur(value); savePreference('image-blur',String(value));}} minimumTrackTintColor={colors.accent} maximumTrackTintColor={colors.line} thumbTintColor={colors.accent} tapToSeek style={styles.blurSlider}/>
              <View style={styles.blurLabels}><Text style={styles.optionLabel}>None</Text><Text style={styles.optionLabel}>More</Text></View>
            </View>
          </View>}
          {background === 'images' && <View style={styles.preferenceGroup}>
            <View><Text style={styles.preferenceLabel}>Chapter images</Text><Text style={styles.imageHelp}>Choose images to use throughout this book.</Text></View>
            <View style={styles.imageGrid}>{bookImages.map((image, i) => <Pressable key={image.id} accessibilityRole="checkbox" accessibilityLabel={`Background image ${i + 1}`} accessibilityState={{checked:selectedImages.includes(image.id)}} aria-checked={selectedImages.includes(image.id)} onPress={() => toggleImage(image.id)} style={[styles.imageOption,selectedImages.includes(image.id) && styles.imageOptionSelected]}><Image source={image.thumbnail} style={styles.imageThumbnail} resizeMethod="resize"/>{selectedImages.includes(image.id) && <View style={styles.imageCheck}><Text style={styles.imageCheckText}>✓</Text></View>}</Pressable>)}</View>
            <Pressable accessibilityRole="button" accessibilityState={{busy:addingImages}} disabled={addingImages} onPress={() => void addImages()} style={styles.addImages}><Text style={styles.addImagesText}>{addingImages ? 'Adding images…' : '+ Add your images'}</Text></Pressable>
          </View>}
        </ScrollView> : <ScrollView contentContainerStyle={styles.settingsContent}>
          <View style={styles.preferenceGroup}>
            <View><Text style={styles.preferenceLabel}>Color palette</Text><Text style={styles.imageHelp}>Choose a coordinated set of colors for the app.</Text></View>
            <View>{backgrounds.map(value => <Pressable key={value} accessibilityRole="radio" accessibilityLabel={`${backgroundLabels[value]} palette`} accessibilityState={{checked:colorTheme===value}} aria-checked={colorTheme===value} onPress={() => {setColorTheme(value); savePreference('color-theme',value); if (background !== 'images') {setBackground(value); savePreference('background',value);}}} style={styles.choiceRow}>
              <Text style={styles.paletteName}>{backgroundLabels[value]}</Text><View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.paletteSwatches}><View style={[styles.paletteSwatch,{backgroundColor:palettes[value].accent}]}/><View style={[styles.paletteSwatch,{backgroundColor:palettes[value].paper}]}/><View style={[styles.paletteSwatch,{backgroundColor:palettes[value].white}]}/></View><Text style={styles.choiceCheck} accessible={false}>{colorTheme===value ? '✓' : ''}</Text>
            </Pressable>)}</View>
          </View>
          <View style={styles.preferenceGroup}><Text style={styles.preferenceLabel}>How the colors are used</Text><View style={styles.colorHints}>
            <Text style={styles.colorHint}><Text style={styles.colorHintStrong}>Primary</Text> · Buttons, icons and highlights.</Text>
            <Text style={styles.colorHint}><Text style={styles.colorHintStrong}>Secondary</Text> · The main app and reading background.</Text>
            <Text style={styles.colorHint}><Text style={styles.colorHintStrong}>Tertiary</Text> · Menus, controls and other surfaces.</Text>
          </View></View>
        </ScrollView>}
      </SafeAreaView></SafeAreaProvider>
    </Modal>
    <Modal visible={dictionaryWord !== null} transparent animationType="none" onShow={openDictionaryAnimation} onRequestClose={closeDictionary}>
      <View style={styles.dictionaryOverlay}>
        <Animated.View pointerEvents="none" style={[styles.dictionaryBackdrop, {opacity: dictionaryAnimation}]} />
        <Animated.View style={[styles.dictionarySheet, {transform: [{translateY: dictionaryAnimation.interpolate({inputRange:[0,1],outputRange:[height,0]})}]}]}>
        <View style={styles.settingsHeader}><Text accessibilityRole="header" style={styles.settingsTitle}>{dictionaryWord}</Text><Pressable accessibilityRole="button" accessibilityLabel="Close dictionary" onPress={closeDictionary} style={styles.profileButton}><Text style={styles.closeIcon}>×</Text></Pressable></View>
        <ScrollView contentContainerStyle={styles.dictionaryContent}>
          {dictionaryStatus === 'prompt' && <><Text style={styles.dictionaryBody}>Download the English dictionary once to look up words offline.</Text><Text style={styles.dictionaryMeta}>About 10 MB · Open English WordNet</Text><Pressable accessibilityRole="button" onPress={() => dictionaryWord && void showWord(dictionaryWord, dictionaryLanguage, true)} style={[styles.button,styles.buttonPrimary,styles.doneButton]}><Text style={styles.selectedText}>Download dictionary</Text></Pressable></>}
          {dictionaryStatus === 'loading' && <View style={styles.dictionaryLoading}><ActivityIndicator color={colors.accent}/><Text style={styles.dictionaryBody}>Preparing dictionary…</Text></View>}
          {dictionaryStatus === 'unsupported' && <Text style={styles.dictionaryBody}>{Platform.OS === 'web' ? 'Dictionary lookup is available in the mobile app.' : 'Sanskrit dictionary lookup is not available yet.'}</Text>}
          {dictionaryStatus === 'error' && <><Text style={styles.dictionaryBody}>{dictionaryError}</Text><Pressable accessibilityRole="button" onPress={() => dictionaryWord && void showWord(dictionaryWord, dictionaryLanguage, true)} style={[styles.button,styles.buttonPrimary,styles.doneButton]}><Text style={styles.selectedText}>Try again</Text></Pressable></>}
          {dictionaryStatus === 'results' && (meanings.length ? meanings.map(group => <View key={group.partOfSpeech} style={styles.dictionaryGroup}><Text style={styles.preferenceLabel}>{group.partOfSpeech}</Text>{group.definitions.map((definition, i) => <Text key={i} style={styles.dictionaryBody}>{i + 1}. {definition}</Text>)}</View>) : <Text style={styles.dictionaryBody}>No definition found for this word.</Text>)}
          {dictionaryLanguage === 'en' && <><Pressable accessibilityRole="button" onPress={() => setShowDictionaryLicense(value => !value)}><Text style={styles.dictionaryLink}>Dictionary source and license {showDictionaryLicense ? '▴' : '▾'}</Text></Pressable>{showDictionaryLicense && <><Text style={styles.dictionaryMeta}>Open English WordNet 2025, based on Princeton WordNet. Licensed under CC BY 4.0 and the Princeton WordNet license.</Text><Text style={styles.dictionaryMeta}>{wordnetNotice}</Text><Pressable accessibilityRole="link" onPress={() => void Linking.openURL('https://github.com/globalwordnet/english-wordnet/blob/2025-edition/LICENSE.md')}><Text style={styles.dictionaryLink}>View full license</Text></Pressable></>}</>}
        </ScrollView>
        </Animated.View>
      </View>
    </Modal>
    <Modal visible={editing !== null} transparent animationType="slide" onRequestClose={() => setEditing(null)}><View style={styles.overlay}><View style={styles.sheet}><Text style={styles.title}>Add a note</Text><TextInput accessibilityLabel="Your note" multiline value={note} onChangeText={setNote} placeholder="Write something…" placeholderTextColor={colors.muted} style={styles.input}/><View style={styles.sheetActions}><Pressable onPress={() => setEditing(null)} style={styles.button}><Text style={{color:colors.ink}}>Close</Text></Pressable><Pressable onPress={() => void saveNote()} style={[styles.button, styles.buttonPrimary]}><Text style={{color: colors.onAccent, fontWeight:'600'}}>Save note</Text></Pressable></View></View></View></Modal>
  </SafeAreaView>;
}
const createStyles = (colors: Palette) => StyleSheet.create({root:{flex:1,backgroundColor:colors.paper},loading:{flex:1,justifyContent:'center',backgroundColor:colors.paper},header:{paddingHorizontal:24,paddingTop:18,paddingBottom:16,flexDirection:'row',justifyContent:'space-between',alignItems:'center',borderBottomWidth:1,borderColor:colors.line},language:{paddingVertical:10,paddingHorizontal:14,backgroundColor:colors.white,borderRadius:24},languageText:{fontWeight:'600',color:colors.ink},profileButton:{width:44,height:44,borderRadius:22,alignItems:'center',justifyContent:'center'},profileGlyph:{width:24,height:24,transform:[{scale:0.85}]},profileHead:{position:'absolute',top:1,left:8,width:8,height:8,borderWidth:1.5,borderColor:colors.ink,borderRadius:4},profileShoulders:{position:'absolute',bottom:2,left:3,width:18,height:10,borderWidth:1.5,borderColor:colors.ink,borderTopLeftRadius:10,borderTopRightRadius:10,borderBottomWidth:0},settingsScreen:{flex:1,backgroundColor:colors.paper},settingsNavigationHeader:{minHeight:64,flexDirection:'row',alignItems:'center',paddingHorizontal:16,borderBottomWidth:1,borderColor:colors.line},settingsBackButton:{width:44,height:48,alignItems:'center',justifyContent:'center',marginRight:8},settingsNavigationTitle:{flex:1,fontSize:20,fontWeight:'600',color:colors.ink},settingsList:{paddingHorizontal:24,paddingTop:16},settingsListRow:{minHeight:80,flexDirection:'row',alignItems:'center',gap:16,paddingVertical:18,borderBottomWidth:1,borderColor:colors.line},choiceRow:{minHeight:68,flexDirection:'row',alignItems:'center',gap:16,paddingVertical:14,borderBottomWidth:1,borderColor:colors.line},choiceCheck:{fontSize:20,fontWeight:'600',color:colors.accent,minWidth:24,textAlign:'center'},paletteName:{flex:1,fontSize:16,color:colors.ink},paletteSwatches:{flexDirection:'row',gap:6},paletteSwatch:{width:24,height:24,borderRadius:12,borderWidth:1,borderColor:colors.line},colorHints:{gap:10},colorHint:{fontSize:14,lineHeight:21,color:colors.muted},colorHintStrong:{fontWeight:'600',color:colors.ink},settingsHeader:{flexDirection:'row',alignItems:'center',paddingHorizontal:20,paddingVertical:16,borderBottomWidth:1,borderColor:colors.line},settingsTitle:{flex:1,fontFamily:'serif',fontSize:24,color:colors.ink},backIcon:{fontSize:32,color:colors.ink,lineHeight:36},closeIcon:{fontSize:28,color:colors.muted},settingsMenu:{padding:24},settingsMenuRow:{minHeight:80,flexDirection:'row',alignItems:'center',gap:16,padding:20,borderRadius:16,backgroundColor:colors.white},settingsMenuText:{flex:1,gap:6},settingsMenuTitle:{fontSize:16,fontWeight:'600',color:colors.ink},settingsMenuDescription:{fontSize:14,color:colors.muted},settingsChevron:{fontSize:28,color:colors.muted},settingsContent:{gap:32,padding:24},preferenceGroup:{gap:16},preferenceLabel:{fontSize:14,fontWeight:'600',color:colors.ink},sizeOptions:{flexDirection:'row',gap:8},sizeOption:{flex:1,minHeight:88,borderRadius:12,backgroundColor:colors.paper,padding:12,alignItems:'center',justifyContent:'center',gap:8},selectedOption:{backgroundColor:colors.accent},selectedText:{color:colors.onAccent,fontWeight:'600'},sizeSample:{color:colors.ink},optionLabel:{fontSize:13,color:colors.muted},backgroundOption:{flex:1,alignItems:'center',gap:8,minHeight:72},imageSwatch:{overflow:'hidden',backgroundColor:colors.ink},swatchImage:{position:'absolute',width:'100%',height:'100%'},swatchCheck:{color:'#fff',fontSize:20,textShadowColor:'#000',textShadowRadius:4},imagePreview:{height:136,borderRadius:14,overflow:'hidden',justifyContent:'center',alignItems:'center',backgroundColor:'#181818'},imagePreviewText:{fontFamily:'serif',fontSize:20,color:'#fff'},blurHeading:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},blurSlider:{width:'100%',height:44,marginTop:8},blurLabels:{flexDirection:'row',justifyContent:'space-between'},imageHelp:{fontSize:13,lineHeight:20,color:colors.muted,marginTop:6},imageGrid:{flexDirection:'row',flexWrap:'wrap',gap:10},imageOption:{width:72,height:92,borderRadius:12,overflow:'hidden',borderWidth:2,borderColor:'transparent'},imageOptionSelected:{borderColor:colors.accent},imageThumbnail:{width:'100%',height:'100%'},imageCheck:{position:'absolute',right:4,top:4,width:22,height:22,borderRadius:11,backgroundColor:colors.accent,alignItems:'center',justifyContent:'center'},imageCheckText:{color:colors.onAccent,fontSize:14,fontWeight:'700'},addImages:{alignSelf:'flex-start',paddingVertical:10,paddingHorizontal:16,borderRadius:20,backgroundColor:colors.white},addImagesText:{color:colors.accent,fontWeight:'600'},swatch:{width:48,height:48,borderRadius:24,borderWidth:2,alignItems:'center',justifyContent:'center'},doneButton:{alignItems:'center'},main:{flex:1},fixedBackground:{position:'absolute',top:0,right:0,bottom:0,left:0,overflow:'hidden',backgroundColor:'#181818'},backgroundImage:{width:'100%',height:'100%'},backgroundScrim:{position:'absolute',top:0,right:0,bottom:0,left:0,backgroundColor:'rgba(0,0,0,0.64)'},transparentPage:{backgroundColor:'transparent'},imagePassage:{color:'#ffffff'},imageReference:{color:'#ffffff'},page:{backgroundColor:colors.paper,paddingHorizontal:28,paddingTop:24,paddingBottom:24},eyebrow:{fontSize:10,fontWeight:'700',letterSpacing:1.6,color:colors.accent},reading:{flex:1},readingContent:{flexGrow:1,justifyContent:'center',paddingVertical:24},passage:{fontSize:26,lineHeight:39,color:colors.ink,fontFamily:'serif'},passageInput:{padding:0,margin:0,textAlignVertical:'top'},referenceGroup:{alignItems:'flex-start',gap:12,flex:1},lookupButton:{maxWidth:'100%',paddingHorizontal:16,paddingVertical:10,borderRadius:20,backgroundColor:colors.white},lookupText:{fontSize:14,fontWeight:'600',color:colors.accent},reference:{fontSize:14,color:colors.muted},pageBottom:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:16},actions:{flexDirection:'column',gap:8},hiddenActions:{opacity:0},action:{width:44,height:44,borderRadius:22,backgroundColor:colors.white,alignItems:'center',justifyContent:'center'},heart:{fontSize:22,color:colors.accent},noteIcon:{fontSize:20,color:colors.ink},section:{flex:1,paddingHorizontal:28,paddingTop:36},title:{fontFamily:'serif',fontSize:32,color:colors.ink,marginTop:8,marginBottom:24},row:{paddingVertical:20,borderBottomWidth:1,borderColor:colors.line,flexDirection:'row',alignItems:'center',gap:16},rowLabel:{fontSize:10,letterSpacing:1,color:colors.accent,fontWeight:'700'},rowTitle:{fontSize:18,lineHeight:26,color:colors.ink,marginTop:8,fontFamily:'serif'},chapterProgress:{marginTop:16,gap:8},progressLabels:{flexDirection:'row',justifyContent:'space-between',gap:8},progressText:{fontSize:13,color:colors.muted},progressTrack:{height:4,borderRadius:2,backgroundColor:colors.line,overflow:'hidden'},progressFill:{height:'100%',borderRadius:2,backgroundColor:colors.accent},arrow:{fontSize:22,color:colors.muted},empty:{color:colors.muted,lineHeight:24,marginTop:24},nav:{flexDirection:'row',borderTopWidth:1,borderColor:colors.line,backgroundColor:colors.white,paddingVertical:12},navItem:{flex:1,alignItems:'center',padding:8},navText:{fontSize:13,color:colors.muted},navActive:{color:colors.accent,fontWeight:'700'},dot:{width:4,height:4,borderRadius:2,marginTop:6},dotActive:{backgroundColor:colors.accent},overlay:{flex:1,backgroundColor:'#0007',justifyContent:'flex-end'},dictionaryOverlay:{flex:1,justifyContent:'flex-end'},dictionaryBackdrop:{position:'absolute',top:0,right:0,bottom:0,left:0,backgroundColor:'#0007'},dictionarySheet:{backgroundColor:colors.white,borderTopLeftRadius:24,borderTopRightRadius:24,paddingHorizontal:24,paddingBottom:32,maxHeight:'75%'},dictionaryContent:{gap:20,paddingTop:8,paddingBottom:16},dictionaryLoading:{flexDirection:'row',alignItems:'center',gap:12},dictionaryGroup:{gap:10},dictionaryBody:{fontSize:16,lineHeight:24,color:colors.ink},dictionaryMeta:{fontSize:13,lineHeight:20,color:colors.muted},dictionaryLink:{fontSize:14,color:colors.accent,fontWeight:'600'},sheet:{backgroundColor:colors.white,borderTopLeftRadius:24,borderTopRightRadius:24,padding:24},input:{minHeight:120,textAlignVertical:'top',backgroundColor:colors.paper,borderRadius:12,padding:16,color:colors.ink,fontSize:16},sheetActions:{flexDirection:'row',justifyContent:'flex-end',gap:12,marginTop:16},button:{paddingVertical:12,paddingHorizontal:18,borderRadius:20},buttonPrimary:{backgroundColor:colors.accent}});
