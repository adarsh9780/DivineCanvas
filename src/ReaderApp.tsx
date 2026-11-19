import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Alert, Animated, AppState, Easing, FlatList, Image, LayoutAnimation, Linking, Modal, NativeModules, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View, useWindowDimensions, type GestureResponderEvent } from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SQLite from 'expo-sqlite';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Directory, File, Paths } from 'expo-file-system';
import { gitaImages } from './bookBackgrounds';
import { READER_WALKTHROUGH_KEY, readerWalkthroughSeen } from './readerWalkthrough';
import { chapterBackground, chapterImageKey, parseChapterImageOverrides, parseBookImageSeeds, shuffledBookSeed, clearBookImageOverrides, type BookImageSeeds, type ChapterImageOverrides } from './chapterBackgrounds';
import Svg, { Circle, Path } from 'react-native-svg';
import { FilterImage } from 'react-native-svg/filter-image';
import type { Filters } from 'react-native-svg/filter-image';
import Slider from '@react-native-community/slider';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { sharePassageImage } from './shareImage';
import { speechEngines, defaultSpeechEngineId } from './speech';
import type { GeneratedSpeech, SpeechEngine } from './speech/engine';
import { PARADEE_DOWNLOAD_BYTES } from './speech/paradee/assets';
import { isParadeeInstalled } from './speech/paradee/storage';
import { dictionaryAvailable, downloadDictionary, lookupWord, removeDictionary } from './dictionary';
import { isDoubleTap, selectedLookupWord, segmentPassage, selectionRange, type Tap, type TextSegment } from './lookupGesture';
import type { DictionaryMeaning } from './dictionaryEngine';
import { wordnetNotice } from './dictionaryNotice';
import { useAppLanguage } from './AppLanguage';
import { PassageBody } from './PassageBody';
import { bookDownloads, bookDownloaded, downloadBook, openBookDatabase, removeBookFile } from './bookDownloads';
import { books, GITA_BOOK_ID, type Book, type Passage, migrateLegacyPassageId } from './book';
import { CHAPTER_POSITION_PREFIX, chapterPositionPrefix, chapterPositionKey, bookPositionKey, chapterResumeIndex, chapterReadingProgress, legacyGitaPositionCopies, SAVE_POSITION_SQL } from './readingProgress';

import { backgrounds, backgroundLabels, palettes, fontSizes, parseAppearance, Background, ColorTheme, ReadingFontSize, Palette } from './readingAppearance';

const lucideNotice = `ISC License

Copyright (c) 2026 Lucide Icons and Contributors

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.`;

function newImageId() { return `user-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`; }
function newImageSeed() { return Math.floor(Math.random() * 4294967295) || 1; }

type UploadedImage = {id: string; filename: string; thumbFilename?: string};
type Saved = Record<string, string>;
type Screen = 'read' | 'chapters' | 'saved' | 'books';
const EMPTY_CHAPTER_POSITIONS: Record<number, string> = {};
type NavigationItem = {key: string; title: string; detail: string; idx: number; progress?: {percent: number; label: string}};

function AutoScrollCountdown({seconds, active, finished, colors}: {seconds: number; active: boolean; finished: boolean; colors: Palette}) {
  const {t} = useAppLanguage();
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

  return <View accessibilityRole="timer" accessibilityLabel={finished ? t("Auto-scroll finished") : active ? (t('Next passage in') + ` ${remaining} ` + t('seconds')) : t("Auto-scroll paused")} style={{minWidth:68,alignItems:'center',gap:5}}>
    <Text style={{fontSize:13,fontWeight:'600',color:colors.muted,fontVariant:['tabular-nums']}}>{finished ? t("Finished") : active ? `${remaining}${t('s')}` : t("Paused")}</Text>
    <View style={{height:2,width:48,borderRadius:1,backgroundColor:colors.line,overflow:'hidden'}}><Animated.View style={{height:2,width:48,backgroundColor:colors.accent,transform:[{scaleX:active ? progress : 1}]}}/></View>
  </View>;
}


export default function App() {
  const {appLanguage, setAppLanguage, t} = useAppLanguage();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height, width, fontScale } = useWindowDimensions();
  const list = useRef<FlatList<Passage>>(null);
  const db = useRef<SQLite.SQLiteDatabase | null>(null);
  const [ready, setReady] = useState(false);
  const [walkthroughSeen,setWalkthroughSeen] = useState(false);
  const [walkthroughVisible,setWalkthroughVisible] = useState(false);
  const [walkthroughSaving,setWalkthroughSaving] = useState(false);
  const readerView = useRef<React.ComponentRef<typeof View>>(null);
  const sharing = useRef(false);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [settingsPage, setSettingsPage] = useState<'menu' | 'reading' | 'appearance' | 'playback' | 'music' | 'downloads' | 'dictionary' | 'language' | 'credits' | 'privacy' | 'chapter-images' | 'chapter-select' | null>(null);
  const [showIconLicense, setShowIconLicense] = useState(false);
  const [background, setBackground] = useState<Background>('images');
  const [colorTheme, setColorTheme] = useState<ColorTheme>('paper');
  const [imageSeed, setImageSeed] = useState(1);
  const [chapterOverrides,setChapterOverrides] = useState<ChapterImageOverrides>({});
  const [bookImageSeeds,setBookImageSeeds] = useState<BookImageSeeds>({});
  const [shuffleMessage,setShuffleMessage] = useState('');
  const shuffleMessageTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  useEffect(() => () => {if (shuffleMessageTimer.current) clearTimeout(shuffleMessageTimer.current);},[]);
  const [pickerBookId,setPickerBookId] = useState(GITA_BOOK_ID);
  const [pickerChapter,setPickerChapter] = useState(1);
  const [chapterSearch,setChapterSearch] = useState('');
  const [imagePickerReturn,setImagePickerReturn] = useState<'reading'|null>(null);
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
  const [screen, setScreen] = useState<Screen>('books');
  const [immersive, setImmersive] = useState(false);
  function changeImmersive(value:boolean) {if (value===immersive) return; LayoutAnimation.easeInEaseOut(); setImmersive(value);}
  const [pinching, setPinching] = useState(false);
  const pinch = useRef<{distance:number; triggered:boolean}|null>(null);
  function pinchDistance(event:GestureResponderEvent) {const touches=event.nativeEvent.touches; return touches.length===2 ? Math.hypot(touches[0].pageX-touches[1].pageX,touches[0].pageY-touches[1].pageY) : null;}
  function startPinch(event:GestureResponderEvent) {
    if (screen!=='read' || settingsPage!==null || readerMenuOpen || dictionaryWord!==null) return;
    const distance=pinchDistance(event); if (distance===null || distance<20) return;
    pinch.current={distance,triggered:false}; setPinching(true); readerTap.current=null; touchStart.current=null;
  }
  function movePinch(event:GestureResponderEvent) {
    const gesture=pinch.current, distance=pinchDistance(event);
    if (!gesture || gesture.triggered || distance===null) return;
    if (distance-gesture.distance > Math.max(35,gesture.distance*0.25)) {gesture.triggered=true; changeImmersive(true);}
    else if (gesture.distance-distance > Math.max(35,gesture.distance*0.25)) {gesture.triggered=true; changeImmersive(false);}
  }
  function finishPinch(event:GestureResponderEvent) {if (event.nativeEvent.touches.length<2) {pinch.current=null; setPinching(false);}}
  const [sectionMenuOpen, setSectionMenuOpen] = useState(false);
  const [readerMenuOpen, setReaderMenuOpen] = useState(false);
  const [activeBookId, setActiveBookId] = useState(GITA_BOOK_ID);
  const activeBook = books.find(book => book.id === activeBookId) ?? books[0];
  const {passages, chapters} = activeBook;
  // The selected pool and uploaded photos are shared by all books.
  const activeImages = useMemo(() => bookImages.filter(image => selectedImages.includes(image.id)), [bookImages, selectedImages]);
  const pickerBook = books.find(book => book.id===pickerBookId) ?? books[0];
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(false);
  const [autoScrollSeconds, setAutoScrollSeconds] = useState(15);
  const [readAloud, setReadAloud] = useState(false);
  const readAloudRef = useRef(false);
  const readerTap = useRef<{x: number; y: number; time: number} | null>(null);
  const currentIndex = useRef(0);
  const [touchingReader, setTouchingReader] = useState(false);
  const [interactionCount, setInteractionCount] = useState(0);
  const continuationNavigator = useRef<{advance:()=>boolean; hasMore:()=>boolean} | null>(null);
  const [continuationPending, setContinuationPending] = useState(false);
  const registerContinuation = useCallback((navigator:{advance:()=>boolean; hasMore:()=>boolean}|null) => {continuationNavigator.current=navigator; setContinuationPending(!!navigator?.hasMore());}, []);
  const onContinuationChange = useCallback(() => {setContinuationPending(!!continuationNavigator.current?.hasMore()); setInteractionCount(value => value+1);}, []);
  const speechEngine = useRef<SpeechEngine | null>(null);
  const speechAbort = useRef<AbortController | null>(null);
  const speechFile = useRef<GeneratedSpeech | null>(null);
  const speechDownloadAbort = useRef<AbortController | null>(null);
  const [voiceInstalled, setVoiceInstalled] = useState(() => Platform.OS !== 'web' && isParadeeInstalled());
  const [voiceDownload, setVoiceDownload] = useState<number | null>(null);
  const [pendingVoiceStart, setPendingVoiceStart] = useState<{bookId:string; passageId:string; language:'en'|'hi'|'sa'; mode:'passage'|'continuous'} | null>(null);
  const [dictionaryInstalled, setDictionaryInstalled] = useState(() => dictionaryAvailable());
  const [dictionaryDownload, setDictionaryDownload] = useState<number | null>(null);
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
    musicPlayer.loop = true;
    musicPlayer.volume = narrating ? musicVolume * 0.5 : musicVolume;
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
  const [saved, setSaved] = useState<Saved>({});
  const [index, setIndex] = useState(0);
  const textDbs = useRef<Record<string,Promise<SQLite.SQLiteDatabase>>>({});
  const [installedBooks, setInstalledBooks] = useState<Record<string,boolean>>(() => Object.fromEntries(books.map(b => [b.id, bookDownloaded(b.id)])));
  const [bookInfo, setBookInfo] = useState<Book | null>(null);
  const [bookDownload, setBookDownload] = useState<{id:string; progress:number} | null>(null);
  const [textWindow, setTextWindow] = useState<{bookId:string; rows:Record<number,{en:string;sa:string;hi:string}>}>({bookId:'',rows:{}});
  const [savedText, setSavedText] = useState<Record<string,{en:string;sa:string;hi:string}>>({});
  const [bookTextError, setBookTextError] = useState(false);
  const windowRows = textWindow.bookId === activeBookId ? textWindow.rows : {};
  const currentText = windowRows[index];
  const currentPassage = useMemo(() => currentText ? {...passages[index], ...currentText} : passages[index], [passages, index, currentText]);
  const textReady = !!currentText;
  const getTextDb = useCallback((id:string) => {
    if (!textDbs.current[id]) textDbs.current[id] = openBookDatabase(id).catch(error => {delete textDbs.current[id]; throw error;});
    return textDbs.current[id];
  }, []);
  useEffect(() => {
    if (!ready || !installedBooks[activeBookId]) return;
    let cancelled = false;
    (async () => {
      const database = await getTextDb(activeBookId);
      const rows = await database.getAllAsync<{position:number;en:string;sa:string;hi:string}>('SELECT position, en, sa, hi FROM passages WHERE position BETWEEN ? AND ?', Math.max(0,index-3), index+3);
      if (!cancelled) {setBookTextError(false); setTextWindow({bookId:activeBookId,rows:Object.fromEntries(rows.map(row => [row.position,{en:row.en,sa:row.sa,hi:row.hi}]))});}
    })().catch(error => {console.warn('Could not load book text', error); if (!cancelled) setBookTextError(true);});
    return () => {cancelled = true;};
  }, [ready, activeBookId, index, installedBooks, getTextDb]);
  useEffect(() => {
    if (screen !== 'saved' || !installedBooks[activeBookId]) return;
    let cancelled = false;
    const ids = Object.keys(saved).filter(id => id.startsWith(activeBookId + ':'));
    (async () => {
      const database = await getTextDb(activeBookId);
      const found: Record<string,{en:string;sa:string;hi:string}> = {};
      for (let i=0; i<ids.length; i+=100) {
        const chunk = ids.slice(i,i+100);
        const rows = await database.getAllAsync<{id:string;en:string;sa:string;hi:string}>(`SELECT id,en,sa,hi FROM passages WHERE id IN (${chunk.map(() => '?').join(',')})`, chunk);
        for (const row of rows) found[row.id] = {en:row.en,sa:row.sa,hi:row.hi};
      }
      if (!cancelled) setSavedText(found);
    })().catch(error => console.warn('Could not load saved passage text', error));
    return () => {cancelled = true;};
  }, [screen, activeBookId, saved, installedBooks, getTextDb]);

  const [language, setLanguage] = useState<'en' | 'hi' | 'sa'>('hi');
  const [positionsByBook, setPositionsByBook] = useState<Record<string, Record<number, string>>>({});
  const [lastByBook, setLastByBook] = useState<Record<string, string>>({});
  const chapterPositions = positionsByBook[activeBook.id] ?? EMPTY_CHAPTER_POSITIONS;
  const positionWrites = useRef<Promise<void>>(Promise.resolve());
  const [editing, setEditing] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const activeSelection = useRef<{passageId:string; language:'en'|'hi'|'sa'; start:number; end:number; anchorStart:number; anchorEnd:number} | null>(null);
  const previousWordTap = useRef<Tap | null>(null);
  const protectSelectionUntil = useRef(0);
  const touchStart = useRef<{x:number; y:number; time:number; selection:NonNullable<typeof activeSelection.current>} | null>(null);
  const [selectedWord, setSelectedWord] = useState<typeof activeSelection.current>(null);
  const [dictionaryWord, setDictionaryWord] = useState<string | null>(null);
  const [dictionaryLanguage, setDictionaryLanguage] = useState<'en' | 'hi' | 'sa'>('en');
  const [dictionaryStatus, setDictionaryStatus] = useState<'prompt' | 'loading' | 'results' | 'error' | 'unsupported'>('prompt');
  const [dictionaryError, setDictionaryError] = useState('');
  const [meanings, setMeanings] = useState<DictionaryMeaning[]>([]);
  const [showDictionaryLicense, setShowDictionaryLicense] = useState(false);
  const dictionaryRequest = useRef(0);
  const [dictionaryAnimation] = useState(() => new Animated.Value(0));
  const dictionaryClosing = useRef(false);
  const [readerHeight, setReaderHeight] = useState(Math.max(200, height - 180));

  useEffect(() => { (async () => {
    try {
      const database = await SQLite.openDatabaseAsync('kgram.db');
      await database.execAsync('CREATE TABLE IF NOT EXISTS saves (id TEXT PRIMARY KEY NOT NULL, note TEXT NOT NULL DEFAULT ""); CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);');
      db.current = database;
      // Preserve the previous edition's bookmarks and positions using their first verse.
      // Keep the original records intact, and only migrate once so removed saves stay removed.
      const migration = await database.getFirstAsync<{value: string}>("SELECT value FROM settings WHERE key = 'gita-trust-migrated'");
      if (!migration) {
        const oldSaves = await database.getAllAsync<{id: string; note: string}>("SELECT id, note FROM saves WHERE id LIKE 'gita-1972:%'");
        for (const row of oldSaves) {
          const id = migrateLegacyPassageId(row.id);
          if (id) await database.runAsync('INSERT OR IGNORE INTO saves (id, note) VALUES (?, ?)', id, row.note);
        }
        const oldPositions = await database.getAllAsync<{key: string; value: string}>("SELECT key, value FROM settings WHERE key = 'position' OR key LIKE ?", `${CHAPTER_POSITION_PREFIX}%`);
        for (const row of oldPositions) {
          const id = migrateLegacyPassageId(row.value);
          if (id) await database.runAsync('UPDATE settings SET value = ? WHERE key = ?', id, row.key);
        }
        // The old app used 'hi' to represent Sanskrit.
        await database.runAsync("UPDATE settings SET value = 'sa' WHERE key = 'language' AND value = 'hi'");
        await database.runAsync("INSERT OR REPLACE INTO settings (key, value) VALUES ('gita-trust-migrated', '1')");
      }
      const rows = await database.getAllAsync<{id: string; note: string}>('SELECT id, note FROM saves');
      setSaved(Object.fromEntries(rows.map(row => [row.id, row.note])));
      // Migrate existing Gita progress without overwriting newer book-scoped values.
      const scopedMigration = await database.getFirstAsync<{value: string}>("SELECT value FROM settings WHERE key = 'book-progress-migrated'");
      if (!scopedMigration) {
        const oldPosition = await database.getFirstAsync<{value: string}>("SELECT value FROM settings WHERE key = 'position'");
        const oldChapters = await database.getAllAsync<{key: string; value: string}>('SELECT key, value FROM settings WHERE key LIKE ?', `${CHAPTER_POSITION_PREFIX}%`);
        for (const row of legacyGitaPositionCopies(GITA_BOOK_ID, books[0].passages, oldPosition?.value, oldChapters)) {
          await database.runAsync('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', row.key, row.value);
        }
        await database.runAsync("INSERT OR REPLACE INTO settings (key, value) VALUES ('book-progress-migrated', '1')");
      }
      const savedBook = await database.getFirstAsync<{value: string}>("SELECT value FROM settings WHERE key = 'active-book'");
      const selectedBook = books.find(book => book.id === savedBook?.value) ?? books[0];
      const allPositions: Record<string, Record<number, string>> = {};
      const allLast: Record<string, string> = {};
      for (const book of books) {
        const prefix = chapterPositionPrefix(book.id);
        const chapterRows = await database.getAllAsync<{key: string; value: string}>('SELECT key, value FROM settings WHERE key LIKE ?', `${prefix}%`);
        const positions: Record<number, string> = {};
        const position = await database.getFirstAsync<{value: string}>('SELECT value FROM settings WHERE key = ?', bookPositionKey(book.id));
        // Don't load a large book when it has never been opened. Index a read book once.
        const byId = chapterRows.length || position ? new Map(book.passages.map(p => [p.id, p.chapter])) : null;
        for (const row of chapterRows) {
          const chapter = Number(row.key.slice(prefix.length));
          if (byId?.get(row.value) === chapter) positions[chapter] = row.value;
        }
        allPositions[book.id] = positions;
        if (position && byId?.has(position.value)) allLast[book.id] = position.value;
      }
      setPositionsByBook(allPositions);
      setLastByBook(allLast);
      setActiveBookId(selectedBook.id);
      const last = selectedBook.passages.findIndex(p => p.id === allLast[selectedBook.id]);
      if (last >= 0) { currentIndex.current = last; setIndex(last); }
      const lang = await database.getFirstAsync<{value: string}>("SELECT value FROM settings WHERE key = 'language'");
      if (lang?.value === 'en' || lang?.value === 'hi' || lang?.value === 'sa') setLanguage(selectedBook.languages.includes(lang.value) ? lang.value : selectedBook.languages[0]);
      else if (!selectedBook.languages.includes('hi')) setLanguage(selectedBook.languages[0]);
      const appearanceRows = await database.getAllAsync<{key: string; value: string}>("SELECT key, value FROM settings WHERE key IN ('background', 'font-size', 'gita-backgrounds', 'chapter-background-overrides', 'chapter-background-seeds', 'reader-walkthrough-seen', 'color-theme', 'image-tone', 'image-blur', 'music-enabled', 'music-volume', 'auto-scroll-enabled', 'auto-scroll-seconds')");
      const values = Object.fromEntries(appearanceRows.map(row => [row.key, row.value]));
      setWalkthroughSeen(readerWalkthroughSeen(values[READER_WALKTHROUGH_KEY]));
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
      if (values['chapter-background-overrides']) setChapterOverrides(parseChapterImageOverrides(values['chapter-background-overrides']));
      if (values['chapter-background-seeds']) setBookImageSeeds(parseBookImageSeeds(values['chapter-background-seeds']));
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
    } catch { Alert.alert(t("Unable to open local storage"), t("Please restart the app and try again.")); }
  })(); }, [t]);

  const setting = useCallback(async (key: string, value: string) => { await db.current?.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', key, value); }, []);
  const preferenceWrites = useRef<Promise<void>>(Promise.resolve());
  const savePreference = useCallback((key: string, value: string) => {
    preferenceWrites.current = preferenceWrites.current.then(() => setting(key, value))
      .catch(() => Alert.alert(t("Setting could not be saved"), t("Please try selecting it again.")));
  }, [setting, t]);
  async function finishWalkthrough() {
    if (walkthroughSaving || !db.current) return;
    setWalkthroughSaving(true);
    try {
      await db.current.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',READER_WALKTHROUGH_KEY,'true');
      setWalkthroughSeen(true); setWalkthroughVisible(false);
    } catch {Alert.alert(appLanguage==='hi'?'सहेजा नहीं जा सका':'Could not save',appLanguage==='hi'?'कृपया फिर प्रयास करें।':'Please try again.');}
    finally {setWalkthroughSaving(false);}
  }
  async function resetWalkthrough() {
    if (walkthroughSaving || !db.current) return;
    setWalkthroughSaving(true);
    try {
      await db.current.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',READER_WALKTHROUGH_KEY,'false');
      setWalkthroughSeen(false);
      Alert.alert(appLanguage==='hi'?'परिचय रीसेट हो गया':'Walkthrough reset',appLanguage==='hi'?'अगली बार पुस्तक खोलने पर परिचय दिखाई देगा।':'The walkthrough will appear the next time you open a book.');
    } catch {Alert.alert(appLanguage==='hi'?'रीसेट नहीं हो सका':'Could not reset',appLanguage==='hi'?'कृपया फिर प्रयास करें।':'Please try again.');}
    finally {setWalkthroughSaving(false);}
  }
  function saveImagePreferences(selected: string[], uploaded: UploadedImage[], seed=imageSeed) {
    savePreference('gita-backgrounds', JSON.stringify({seed, selected, uploaded}));
  }
  function openChapterImages(origin:'reading'|null) {
    setPickerBookId(activeBook.id); setPickerChapter(passages[index]?.chapter ?? 1);
    setChapterSearch(''); setShuffleMessage(''); setImagePickerReturn(origin); setReaderMenuOpen(false); setSettingsPage('chapter-images');
  }
  function updateChapterImage(id:string|null) {
    const key=chapterImageKey(pickerBookId,pickerChapter);
    const next={...chapterOverrides};
    if (id===null) delete next[key]; else next[key]=id;
    setChapterOverrides(next); savePreference('chapter-background-overrides',JSON.stringify(next));
    if (id!==null && background!=='images') {setBackground('images'); savePreference('background','images');}
  }
  function showShuffleMessage(message:string) {
    if (shuffleMessageTimer.current) clearTimeout(shuffleMessageTimer.current);
    setShuffleMessage(message); AccessibilityInfo.announceForAccessibility(message);
    shuffleMessageTimer.current=setTimeout(() => setShuffleMessage(''),3500);
  }
  function shuffleChapterImages(book:Book, preferredChapter?:number) {
    const chapter=book.chapters.find(item => item.number===preferredChapter) ?? book.chapters[0];
    if (!chapter || !activeImages.length) return;
    const previous=bookImageSeeds[book.id] ?? imageSeed;
    const current=chapterBackground(bookImages,activeImages,book.id,chapter.number,previous,chapterOverrides);
    const seed=shuffledBookSeed(activeImages,previous,chapter.number,newImageSeed(),current?.id) ?? previous;
    const nextSeeds={...bookImageSeeds,[book.id]:seed};
    const nextOverrides=clearBookImageOverrides(chapterOverrides,book.id);
    // Persist the new order and cleared choices together, after earlier preference writes.
    preferenceWrites.current=preferenceWrites.current.then(async () => {
      if (!db.current) throw new Error('Settings unavailable');
      await db.current.runAsync('INSERT OR REPLACE INTO settings (key,value) VALUES (?,?),(?,?)','chapter-background-seeds',JSON.stringify(nextSeeds),'chapter-background-overrides',JSON.stringify(nextOverrides));
    }).catch(() => Alert.alert(t("Setting could not be saved"),t("Please try selecting it again.")));
    setBookImageSeeds(nextSeeds); setChapterOverrides(nextOverrides);
    showShuffleMessage(activeImages.length<2 ? (appLanguage==='hi'?'केवल एक चित्र चुना गया है।':'Only one image is selected.') : background!=='images' ? (appLanguage==='hi'?'चित्र बदल गए। देखने के लिए पृष्ठभूमि चित्र चालू करें।':'Images shuffled. Turn on image backgrounds to see them.') : (appLanguage==='hi'?`${t(book.title)} के सभी चित्र बदल दिए गए।`:`${t(book.title)} chapter images shuffled.`));
  }
  function closeSettingsPage() {
    if (settingsPage==='chapter-select') {setSettingsPage('chapter-images'); return;}
    if (settingsPage==='chapter-images') {setSettingsPage(imagePickerReturn); return;}
    setSettingsPage(settingsPage==='menu' ? null : 'menu');
  }
  function toggleImage(id: string) {
    const next = selectedImages.includes(id) ? selectedImages.filter(value => value !== id) : [...selectedImages, id];
    if (!next.length) { Alert.alert(t("Choose an image"), t("Keep at least one image selected.")); return; }
    setSelectedImages(next); saveImagePreferences(next, uploadedImages);
  }
  async function addImages() {
    if (addingImages) return;
    if (Platform.OS === 'web') { Alert.alert(t("Use the mobile app"), t("Adding your own images is available on iPhone and Android.")); return; }
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
      Alert.alert(t("Could not add images"), t("Please try choosing your photos again."));
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
    const book = books.find(candidate => candidate.id === activeBookId) ?? books[0];
    const passage = book.passages[i];
    const database = db.current;
    if (!passage || !database) return;
    const previousIndex = currentIndex.current;
    currentIndex.current = i;
    if (i !== previousIndex) { activeSelection.current = null; setSelectedWord(null); }
    previousWordTap.current = null;
    setIndex(i);
    setPositionsByBook(current => ({...current, [book.id]: {...current[book.id], [passage.chapter]: passage.id}}));
    setLastByBook(current => ({...current, [book.id]: passage.id}));
    // Keep rapid swipes in order; both positions are saved in one atomic statement.
    positionWrites.current = positionWrites.current.then(async () => {
      await database.runAsync(SAVE_POSITION_SQL, bookPositionKey(book.id), passage.id, chapterPositionKey(book.id, passage.chapter), passage.id);
    }).catch(() => Alert.alert(t("Reading position could not be saved"), t("Please try opening this passage again.")));
  }, [activeBookId, setSelectedWord, t]);
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
      Alert.alert(t("Could not share this passage"), t("Please try again."));
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
  async function showWord(word: string, lang: 'en' | 'hi' | 'sa', download = false) {
    if (dictionaryClosing.current) return;
    const request = ++dictionaryRequest.current;
    setDictionaryWord(word); setDictionaryLanguage(lang);
    if (lang !== 'en' || Platform.OS === 'web') { setDictionaryStatus('unsupported'); return; }
    if (!download && !dictionaryAvailable()) { setDictionaryStatus('prompt'); return; }
    setDictionaryStatus('loading');
    try {
      if (download) {
        setDictionaryDownload(0);
        try { await downloadDictionary(setDictionaryDownload); setDictionaryInstalled(true); }
        finally { setDictionaryDownload(null); }
      }
      // Let the loading indicator render before processing the downloaded archive.
      await new Promise<void>(resolve => setTimeout(resolve, 50));
      const result = await lookupWord(word);
      if (request === dictionaryRequest.current) { setMeanings(result); setDictionaryStatus('results'); }
    } catch {
      if (request === dictionaryRequest.current) {
        setDictionaryError(download ? (appLanguage === 'hi' ? 'डाउनलोड नहीं हो सका। इंटरनेट जाँचकर फिर प्रयास करें।' : 'Download failed. Check your connection and try again.') : (appLanguage === 'hi' ? 'शब्दकोश नहीं खुल सका। कृपया फिर प्रयास करें।' : 'Could not open the dictionary. Please try again.'));
        setDictionaryStatus('error');
      }
    }
  }
  function selectPassageWord(passage: Passage, segment: TextSegment, x: number, y: number, time: number) {
    protectSelectionUntil.current = time + 500;
    const nextTap = {time, x, y, passageId:`${passage.id}:${segment.start}`};
    const doubled = isDoubleTap(previousWordTap.current, nextTap);
    previousWordTap.current = doubled ? null : nextTap;
    const previous = activeSelection.current;
    if (doubled) {
      const next = {passageId:passage.id, language, start:segment.start, end:segment.end, anchorStart:segment.start, anchorEnd:segment.end};
      activeSelection.current = next;
      setSelectedWord(next);
      void Haptics.selectionAsync().catch(() => {});
      const word = selectedLookupWord(passage[language], segment.start, segment.end);
      if (word) void showWord(word, language);
    } else if (previous?.passageId === passage.id && previous.language === language) {
      const next = {...previous, ...selectionRange(previous.anchorStart, previous.anchorEnd, segment.start, segment.end)};
      activeSelection.current = next;
      setSelectedWord(next);
    }
  }
  async function copySelection(passage: Passage, time: number) {
    const selection = activeSelection.current;
    if (!selection || selection.passageId !== passage.id) return;
    protectSelectionUntil.current = time + 500;
    try {
      const copied = await Clipboard.setStringAsync(passage[selection.language].slice(selection.start, selection.end));
      if (copied === false) throw new Error('Clipboard unavailable');
      activeSelection.current = null;
      setSelectedWord(null);
    } catch { Alert.alert(t("Could not copy text"), t("Please try again.")); }
  }
  const stopNarration = useCallback(() => {
    speechAbort.current?.abort(); speechAbort.current = null;
    narrationPlayer.pause();
    const file = speechFile.current; speechFile.current = null;
    if (file) void file.dispose().catch(() => {});
    setNarrating(false);
  }, [narrationPlayer]);

  const stopReadAloud = useCallback(() => {
    readAloudRef.current = false;
    setReadAloud(false);
    stopNarration();
  }, [stopNarration]);

  useEffect(() => {
    const subscription = narrationPlayer.addListener('playbackStatusUpdate', status => {
      if (status.didJustFinish && speechFile.current) {
        const shouldAdvance = readAloudRef.current;
        stopNarration();
        if (shouldAdvance) {
          const next = currentIndex.current + 1;
          if (next < passages.length && list.current) {
            list.current.scrollToIndex({index:next, animated:true});
            rememberPosition(next);
          } else {
            stopReadAloud();
          }
        }
      } else if (status.error && speechAbort.current) {
        stopReadAloud();
        Alert.alert(t("Could not play narration"), status.error);
      }
    });
    return () => subscription.remove();
  }, [narrationPlayer, passages, rememberPosition, stopNarration, stopReadAloud, t]);

  useEffect(() => () => { stopNarration(); }, [index, language, screen, appActive, stopNarration]);

  const getSpeechEngine = useCallback(async () => {
    if (!speechEngine.current) speechEngine.current = await speechEngines.create(defaultSpeechEngineId);
    return speechEngine.current;
  }, []);
  const downloadVoice = useCallback(async () => {
    if (!runtimeAvailable) {Alert.alert(t("Development build needed"), t("This voice requires an app build with the speech runtime. Expo Go cannot run it.")); return;}
    if (speechDownloadAbort.current) return;
    const controller = new AbortController(); speechDownloadAbort.current = controller; setVoiceDownload(0);
    try {
      const engine = await getSpeechEngine();
      await engine.install({signal:controller.signal,onProgress:progress=>setVoiceDownload(Math.min(1,progress.completedBytes/(progress.totalBytes ?? PARADEE_DOWNLOAD_BYTES)))});
      if (!controller.signal.aborted) setVoiceInstalled(true);
    } catch (error) {
      setPendingVoiceStart(null);
      if (!controller.signal.aborted) Alert.alert(t("Voice download failed"), error instanceof Error ? error.message : t("Please try again."));
    } finally {speechDownloadAbort.current = null; setVoiceDownload(null);}
  }, [getSpeechEngine, runtimeAvailable, t]);

  const requestVoice = useCallback((passage: Passage, mode: 'passage' | 'continuous') => {
    if (!runtimeAvailable) {Alert.alert(t("Development build needed"), t("The offline voice requires an app build with the speech runtime. Expo Go cannot run it.")); return;}
    if (speechDownloadAbort.current) {Alert.alert(t("Download in progress"), t("The reading voice is already downloading.")); return;}
    Alert.alert(t("Download offline voice?"), t("Download the reading voice once (about 11 MB). It will work offline after installation."), [
      {text:t("Not now"), style:'cancel'},
      {text:t("Download"), onPress:() => {setPendingVoiceStart({bookId:activeBookId, passageId:passage.id, language, mode}); void downloadVoice();}},
    ]);
  }, [activeBookId, downloadVoice, language, runtimeAvailable, t]);

  function cancelVoiceDownload() {setPendingVoiceStart(null); speechDownloadAbort.current?.abort();}
  function deleteDictionary() {
    try {removeDictionary(); setDictionaryInstalled(false);}
    catch (error) {Alert.alert(t("Could not remove dictionary"), error instanceof Error ? error.message : t("Please try again."));}
  }
  async function installDictionaryFromSettings() {
    if (dictionaryDownload !== null || dictionaryInstalled) return;
    setDictionaryDownload(0);
    try { await downloadDictionary(setDictionaryDownload); setDictionaryInstalled(true); }
    catch (error) { Alert.alert(t("Dictionary download failed"), error instanceof Error ? error.message : t("Please try again.")); }
    finally { setDictionaryDownload(null); }
  }
  async function removeVoice() {
    try {stopReadAloud(); const engine=await getSpeechEngine(); await engine.uninstall(); setVoiceInstalled(false);}
    catch (error) {Alert.alert(t("Could not remove voice"), error instanceof Error ? error.message : t("Please try again."));}
  }
  const startNarration = useCallback(async (passage: Passage) => {
    if (!runtimeAvailable || !voiceInstalled) {
      stopReadAloud();
      requestVoice(passage, 'passage');
      return;
    }
    const controller=new AbortController(); speechAbort.current=controller; setNarrating(true);
    try {
      const engine=await getSpeechEngine();
      const voice = engine.info.voices.find(candidate => candidate.languages.includes(language));
      if (!voice) throw new Error(t("No voice is available for this language."));
      const result=await engine.synthesize({text:passage[language],language,voiceId:voice.id},controller.signal);
      if (controller.signal.aborted) {await result.dispose(); return;}
      speechFile.current=result;
      await setAudioModeAsync({playsInSilentMode:true,shouldPlayInBackground:false,interruptionMode:'mixWithOthers'});
      if (controller.signal.aborted) return;
      narrationPlayer.replace({uri:result.uri}); narrationPlayer.play();
    } catch(error) {
      if (!controller.signal.aborted) {
        stopReadAloud();
        Alert.alert(t("Could not read this passage"), error instanceof Error ? error.message : t("Please try again."));
      }
    }
  }, [getSpeechEngine, language, narrationPlayer, runtimeAvailable, stopReadAloud, voiceInstalled, requestVoice, t]);

  useEffect(() => {
    if (!pendingVoiceStart || !voiceInstalled || voiceDownload !== null || !textReady) return;
    const timer = setTimeout(() => {
      setPendingVoiceStart(null);
      if (screen !== 'read' || activeBookId !== pendingVoiceStart.bookId || passages[index]?.id !== pendingVoiceStart.passageId || language !== pendingVoiceStart.language) return;
      if (pendingVoiceStart.mode === 'continuous') {
        if (autoScrollEnabled) {setAutoScrollEnabled(false); savePreference('auto-scroll-enabled', 'false');}
        readAloudRef.current = true;
        setReadAloud(true);
      } else if (settingsPage === null && !readerMenuOpen && appActive) {
        void startNarration(currentPassage);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [pendingVoiceStart, voiceInstalled, voiceDownload, screen, activeBookId, passages, index, language, settingsPage, readerMenuOpen, appActive, currentPassage, textReady, startNarration, autoScrollEnabled, savePreference]);

  useEffect(() => {
    if (walkthroughVisible || !readAloud || !ready || !textReady || !appActive || screen !== 'read' || settingsPage !== null || readerMenuOpen || editing !== null || dictionaryWord !== null || sharingId !== null) return;
    const timer = setTimeout(() => { void startNarration(currentPassage); }, 0);
    return () => { clearTimeout(timer); stopNarration(); };
  }, [walkthroughVisible, readAloud, ready, appActive, screen, settingsPage, readerMenuOpen, editing, dictionaryWord, sharingId, index, passages, currentPassage, textReady, startNarration, stopNarration]);

  function toggleReadAloud(value: boolean) {
    if (!value) { stopReadAloud(); return; }
    if (!runtimeAvailable || !voiceInstalled) {
      requestVoice(currentPassage, 'continuous');
      return;
    }
    stopNarration();
    if (autoScrollEnabled) { setAutoScrollEnabled(false); savePreference('auto-scroll-enabled', 'false'); }
    readAloudRef.current = true;
    setReadAloud(true);
  }
  useEffect(() => () => { speechDownloadAbort.current?.abort(); speechAbort.current?.abort(); const engine=speechEngine.current; if (engine) void engine.dispose(); }, []);

  useEffect(() => {
    if (walkthroughVisible || !ready || !textReady || !autoScrollEnabled || readAloud || !appActive || screen !== 'read' || settingsPage !== null || readerMenuOpen || editing !== null || dictionaryWord !== null || sharingId !== null || selectedWord !== null || narrating || touchingReader || (index >= passages.length - 1 && !continuationPending)) return;
    const timer = setTimeout(() => {
      if (continuationNavigator.current?.advance()) return;
      const next = index + 1;
      if (!list.current) return;
      list.current.scrollToIndex({index:next, animated:true});
      rememberPosition(next);
    }, autoScrollSeconds * 1000);
    return () => clearTimeout(timer);
  }, [walkthroughVisible, ready, autoScrollEnabled, readAloud, autoScrollSeconds, appActive, screen, settingsPage, readerMenuOpen, editing, dictionaryWord, sharingId, selectedWord, narrating, touchingReader, index, interactionCount, rememberPosition, passages.length, textReady, continuationPending]);

  function jump(i: number) { if (i < 0) return; rememberPosition(i); setScreen('read'); }
  function openBook(book: Book, justDownloaded = false) {
    if (!justDownloaded && !installedBooks[book.id]) {void installBook(book); return;}
    stopReadAloud();
    const resume = book.passages.findIndex(p => p.id === lastByBook[book.id]);
    const next = Math.max(0, resume);
    currentIndex.current = next;
    activeSelection.current = null;
    setSelectedWord(null);
    setActiveBookId(book.id);
    if (!book.languages.includes(language)) setLanguage(book.languages[0]);
    setIndex(next);
    setScreen('read');
    if (!walkthroughSeen) setWalkthroughVisible(true);
    savePreference('active-book', book.id);
  }
  async function installBook(book:Book) {
    if (bookDownload) {Alert.alert(t("Download in progress"), t("Please wait for the current book to finish downloading.")); return;}
    setBookDownload({id:book.id,progress:0});
    try {
      await downloadBook(book.id, progress => setBookDownload({id:book.id,progress}));
      setInstalledBooks(current => ({...current,[book.id]:true}));

    } catch (error) {Alert.alert(t("Download failed"), error instanceof Error ? error.message : t("Check your connection and try again."));}
    finally {setBookDownload(null);}
  }
  function confirmRemoveBook(book:Book) {
    Alert.alert(t("Remove download?"), appLanguage === 'hi' ? `आप ${t(book.title)} फिर से डाउनलोड कर सकते हैं। पढ़ने की स्थिति और नोट्स इस डिवाइस पर रहेंगे।` : `You can download ${book.title} again. Your reading progress and notes will stay on this device.`, [
      {text:t("Cancel"),style:'cancel'},
      {text:t("Remove download"),style:'destructive',onPress:() => { void (async () => {
        try {
          const promise=textDbs.current[book.id]; delete textDbs.current[book.id];
          if (promise) await (await promise).closeAsync();
          removeBookFile(book.id);
          setInstalledBooks(current => ({...current,[book.id]:false}));
          setTextWindow({bookId:'',rows:{}});
        } catch {Alert.alert(t("Could not remove download"), t("Please try again."));}
      })();}},
    ]);
  }
  const localChapter = useCallback((title:string) => appLanguage === 'hi' ? t(title).replace(/Vol\. ([IVX]+) · Chapter (.+)/, 'खंड $1 · अध्याय $2') : title, [appLanguage,t]);
  const localProgress = useCallback((label:string) => {
    if (appLanguage !== 'hi') return label;
    return label.replace(/^Not started · (\d+) (?:verses|passages)$/, (_m,n) => `आरंभ नहीं किया · ${n} ${activeBook.progressUnit === 'verse' ? 'श्लोक' : 'अंश'}`)
      .replace(/^(?:Verses?|Passages?) ([\d–]+) of (\d+)$/, (_m,n,total) => `${activeBook.progressUnit === 'verse' ? 'श्लोक' : 'अंश'} ${n} / ${total}`);
  }, [appLanguage,activeBook.progressUnit]);
  const chapterItems = useMemo(() => chapters.map(c => ({
    key: String(c.number), title: localChapter(c.title), detail: c.detail ? (appLanguage === 'hi' ? c.detail.replace(/VOLUME ([IVX]+) · ENTRY (\d+)/, 'खंड $1 · प्रविष्टि $2') : c.detail) : `${appLanguage === 'hi' ? 'अध्याय' : 'CHAPTER'} ${String(c.number).padStart(2, '0')}`,
    progress: (() => {const result=chapterReadingProgress(passages, c.number, chapterPositions[c.number], activeBook.progressUnit); return {...result,label:localProgress(result.label)};})(),
    idx: chapterResumeIndex(passages, c.number, chapterPositions[c.number]),
  })), [chapters, passages, chapterPositions, activeBook.progressUnit, appLanguage, localChapter, localProgress]);
  const useBookImages = background === 'images';
  const currentBackground = chapterBackground(bookImages,activeImages,activeBook.id,passages[index]?.chapter ?? 1,bookImageSeeds[activeBook.id] ?? imageSeed,chapterOverrides);
  const pickerBackground = chapterBackground(bookImages,activeImages,pickerBookId,pickerChapter,bookImageSeeds[pickerBookId] ?? imageSeed,chapterOverrides);
  const autoScrollFinished = index >= passages.length - 1 && !continuationPending;
  const autoScrollRunning = !walkthroughVisible && ready && autoScrollEnabled && !readAloud && appActive && screen === 'read' && settingsPage === null && !readerMenuOpen && editing === null && dictionaryWord === null && sharingId === null && selectedWord === null && !narrating && !touchingReader && !autoScrollFinished;
  if (!ready) return <View style={styles.loading}><ActivityIndicator color={colors.accent}/></View>;
  return <SafeAreaView style={styles.root} edges={screen === 'read' ? (immersive ? ['left','right'] : ['top','left','right']) : undefined}
    onTouchStartCapture={startPinch}
    onTouchMoveCapture={movePinch}
    onTouchEndCapture={finishPinch}
    onTouchCancelCapture={finishPinch}
    onTouchCancel={() => {setTouchingReader(false); setInteractionCount(count => count + 1);}}
    onTouchStart={event => {
      setTouchingReader(true);
      const selection = activeSelection.current;
      touchStart.current = event.nativeEvent.touches.length===1 && selection && screen === 'read' && settingsPage === null && !readerMenuOpen && dictionaryWord === null ? {x:event.nativeEvent.pageX,y:event.nativeEvent.pageY,time:Date.now(),selection} : null;
    }}
    onTouchEnd={event => {
      setTouchingReader(false);
      setInteractionCount(count => count + 1);
      const start = touchStart.current;
      touchStart.current = null;
      if (!start || Date.now() - start.time > 350 || Math.hypot(event.nativeEvent.pageX - start.x, event.nativeEvent.pageY - start.y) > 12) return;
      // Let word and toolbar presses protect their selection before clearing an outside tap.
      setTimeout(() => {
        if (Date.now() < protectSelectionUntil.current || activeSelection.current !== start.selection) return;
        activeSelection.current = null;
        setSelectedWord(null);
      }, 0);
    }}><StatusBar animated hidden={screen === 'read' && immersive} style={colors.dark ? "light" : "dark"} />
    {!(screen === 'read' && immersive) && voiceDownload !== null && <View accessibilityRole="progressbar" accessibilityLabel={t("Downloading reading voice")} accessibilityValue={{min:0,max:100,now:Math.round(voiceDownload*100)}} style={styles.downloadBanner}><ActivityIndicator color={colors.accent}/><Text style={styles.downloadBannerText}>{t("Downloading voice ·")} {Math.round(voiceDownload*100)}%</Text><Pressable accessibilityRole="button" onPress={cancelVoiceDownload}><Text style={styles.downloadCancel}>{t("Cancel")}</Text></Pressable></View>}
    {!(screen === 'read' && immersive) && dictionaryDownload !== null && dictionaryWord === null && <View accessibilityRole="progressbar" accessibilityLabel={t("Downloading English dictionary")} accessibilityValue={{min:0,max:100,now:Math.round(dictionaryDownload*100)}} style={styles.downloadBanner}><ActivityIndicator color={colors.accent}/><Text style={styles.downloadBannerText}>{t("Downloading dictionary ·")} {Math.round(dictionaryDownload*100)}%</Text></View>}
    {screen === 'read' ? <>{!immersive && <>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel={t("Back to books")} onPress={() => {setImmersive(false); setScreen('books');}} style={styles.profileButton}><Text style={styles.readerBack}>‹</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t("Chapters")} onPress={() => setScreen('chapters')} style={styles.profileButton}>
          <Svg width={23} height={23} viewBox="0 0 24 24" fill="none" stroke={colors.ink} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><Path d="M4 6h2M4 12h2M4 18h2M10 6h10M10 12h10M10 18h10"/></Svg>
        </Pressable>
        <View style={{flex:1}}/>
        <Pressable accessibilityRole="button" accessibilityLabel={waitingForMusic ? t("Loading reading music") : musicFailed && musicEnabled ? t("Music unavailable. Tap to retry") : musicEnabled ? t("Mute reading music") : t("Unmute reading music")} accessibilityState={{disabled:waitingForMusic}} disabled={waitingForMusic} onPress={() => {if (musicFailed && musicEnabled) {retryMusic(); return;} const next = !musicEnabled; setMusicEnabled(next); if (!next) setMusicError(false); void setting('music-enabled', String(next));}} style={styles.profileButton}>{waitingForMusic ? <ActivityIndicator color={colors.ink} size="small"/> : musicFailed && musicEnabled ? <Text style={{color:colors.ink,fontSize:22,fontWeight:'600'}}>!</Text> : <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={colors.ink} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><Path d="M11 5 6 9H3v6h3l5 4V5Z"/>{musicEnabled ? <Path d="M15 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12"/> : <Path d="m16 9 5 6m0-6-5 6"/>}</Svg>}</Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`${appLanguage === 'hi' ? 'पाठ की भाषा बदलें। वर्तमान:' : 'Switch reading language. Current:'} ${language === 'en' ? t("English") : language === 'hi' ? t("Hindi") : t("Sanskrit")}`} onPress={() => { activeSelection.current = null; setSelectedWord(null); previousWordTap.current = null; const next = activeBook.languages[(activeBook.languages.indexOf(language) + 1) % activeBook.languages.length]; setLanguage(next); void setting('language', next); }} style={styles.language}><Text style={styles.languageText}>{language === 'en' ? t("English ▾") : language === 'hi' ? 'हिन्दी ▾' : 'संस्कृत ▾'}</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t("Book menu")} accessibilityState={{expanded:readerMenuOpen}} onPress={() => setReaderMenuOpen(true)} style={styles.profileButton}><Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={colors.ink} strokeWidth={2.5} strokeLinecap="round"><Path d="M5 12h.01M12 12h.01M19 12h.01"/></Svg></Pressable>
      </View>
      {readAloud ? <Pressable accessibilityRole="button" accessibilityLabel={t("Stop read aloud")} onPress={stopReadAloud} style={styles.playbackStatus}><Text style={styles.settingsMenuDescription}>{t("Reading aloud · tap to stop")}</Text></Pressable> : autoScrollEnabled && <View style={styles.playbackStatus}><AutoScrollCountdown key={`${index}-${interactionCount}-${autoScrollSeconds}-${autoScrollRunning}`} seconds={autoScrollSeconds} active={autoScrollRunning} finished={autoScrollFinished} colors={colors}/></View>}
    </>}</> : <View style={styles.settingsNavigationHeader}>
      {screen !== 'books' && <Pressable accessibilityRole="button" accessibilityLabel={t("Back to reader")} onPress={() => setScreen('read')} style={styles.settingsBackButton}><Text style={styles.backIcon}>‹</Text></Pressable>}
      {screen === 'books' ? <Pressable accessibilityRole="button" accessibilityLabel={t("Choose section, current section Books")} accessibilityState={{expanded:sectionMenuOpen}} onPress={() => setSectionMenuOpen(true)} style={{flex:1,flexDirection:'row',alignItems:'center',gap:8,minHeight:48}}><Text style={[styles.settingsNavigationTitle,{flex:0}]}>{t("Books")}</Text><Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={colors.ink} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Path d="m6 9 6 6 6-6"/></Svg></Pressable> : <Text accessibilityRole="header" style={styles.settingsNavigationTitle}>{screen === 'chapters' ? t("Chapters") : t("Saved passages")}</Text>}
      <Pressable accessibilityRole="button" accessibilityLabel={t("Open settings")} onPress={() => setSettingsPage('menu')} style={styles.profileButton}><Svg width={23} height={23} viewBox="0 0 24 24" fill="none" stroke={colors.ink} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><Path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><Circle cx={12} cy={12} r={3}/></Svg></Pressable>
    </View>}
    <View ref={readerView} collapsable={false} style={styles.main} onLayout={e => setReaderHeight(e.nativeEvent.layout.height)}
      onTouchStart={event => { readerTap.current = event.nativeEvent.touches.length===1 && readAloudRef.current && screen === 'read' && settingsPage === null ? {x:event.nativeEvent.pageX, y:event.nativeEvent.pageY, time:Date.now()} : null; }}
      onTouchCancel={() => { readerTap.current = null; }}
      onTouchEnd={event => {
        const tap = readerTap.current;
        readerTap.current = null;
        if (tap && Date.now() - tap.time <= 350 && Math.hypot(event.nativeEvent.pageX - tap.x, event.nativeEvent.pageY - tap.y) <= 12) stopReadAloud();
      }}>
      {screen === 'read' && useBookImages && activeImages.length > 0 && <View pointerEvents="none" style={styles.fixedBackground}>
        <Image source={currentBackground?.source} style={styles.backgroundImage} resizeMode="cover" />
        {imageFilters.length > 0 && <FilterImage key={`${width}-${readerHeight}`} source={currentBackground?.source} style={styles.filteredBackgroundImage} resizeMode="cover" filters={imageFilters}/>}
        <View style={styles.backgroundScrim}/>
      </View>}
      {screen === 'read' ? <FlatList key={`${activeBook.id}-${readerHeight}-${width}`} ref={list} data={passages} extraData={textWindow} initialScrollIndex={index} getItemLayout={(_, i) => ({length: readerHeight, offset: readerHeight * i, index: i})} pagingEnabled scrollEnabled={sharingId === null && !pinching} showsVerticalScrollIndicator={false} keyExtractor={p => p.id} onMomentumScrollEnd={e => { const next = Math.max(0, Math.min(passages.length - 1, Math.round(e.nativeEvent.contentOffset.y / readerHeight))); rememberPosition(next); }} renderItem={({item:metadata, index:rowIndex}) => { const loaded = windowRows[rowIndex] ? {...metadata,...windowRows[rowIndex]} : metadata; const item = loaded; const loading = !windowRows[rowIndex]; return <View style={[styles.page, useBookImages && styles.transparentPage, {height: readerHeight,paddingTop:immersive ? Math.max(24,insets.top+12) : 24,paddingBottom:Math.max(24,insets.bottom+12)}]}>
        {loading && <View style={{position:'absolute',alignSelf:'center',top:'45%'}}>{bookTextError ? <Text style={{color:colors.muted}}>{t("Could not load this passage. Please reopen the book.")}</Text> : <ActivityIndicator color={colors.accent}/>}</View>}

        <PassageBody key={`${item.id}-${language}-${fontSize}-${width}-${fontScale}-${loading}`} active={rowIndex===index} registerNavigation={registerContinuation} onPartChange={onContinuationChange} text={item[language]} fontSize={fontSize} textStyle={[styles.passage, useBookImages && styles.imagePassage]} continuationColor={useBookImages ? '#ffffff' : colors.muted}
          renderText={(chunk, offset, size) => <Text accessibilityLabel={chunk} accessibilityHint={t("Use the copy passage action to copy all text.")} accessibilityActions={[{name:'copyPassage', label:t("Copy passage")},{name:'toggleImmersive',label:immersive ? (appLanguage==='hi'?'रीडिंग नियंत्रण दिखाएँ':'Show reading controls') : (appLanguage==='hi'?'पूर्ण स्क्रीन में पढ़ें':'Read full screen')}]} onAccessibilityAction={event => {if (event.nativeEvent.actionName === 'toggleImmersive') changeImmersive(!immersive); if (event.nativeEvent.actionName === 'copyPassage') void Clipboard.setStringAsync(item[language]).catch(() => Alert.alert(t("Could not copy text"), t("Please try again.")));}} selectable={false} style={[styles.passage, useBookImages && styles.imagePassage, {fontSize:size,lineHeight:Math.round(size*1.5)}]}>
            {segmentPassage(chunk).map(local => {
              const segment = {...local,start:local.start+offset,end:local.end+offset};
              const selected = selectedWord?.passageId === item.id && selectedWord.language === language && segment.start >= selectedWord.start && segment.end <= selectedWord.end;
              return segment.word ? <Text key={segment.start} onPress={event => selectPassageWord(item, segment, event.nativeEvent.pageX, event.nativeEvent.pageY, Date.now())} style={selected ? {backgroundColor:colors.accent,color:colors.onAccent} : undefined}>{segment.text}</Text> : <Text key={segment.start} style={selected ? {backgroundColor:colors.accent,color:colors.onAccent} : undefined}>{segment.text}</Text>;
            })}
          </Text>}
          renderTools={() => selectedWord?.passageId === item.id && selectedWord.language === language && sharingId !== item.id && <View style={styles.selectionTools}>
            <Pressable accessibilityRole="button" accessibilityLabel={t("Copy selected text")} onPress={() => void copySelection(item, Date.now())} style={styles.selectionButton}><Text style={styles.selectionButtonText}>{t("Copy")}</Text></Pressable>
            {selectedLookupWord(item[language], selectedWord.start, selectedWord.end) && <Pressable accessibilityRole="button" onPress={() => {protectSelectionUntil.current = Date.now() + 500; const word = selectedLookupWord(item[language], selectedWord.start, selectedWord.end); if (word) void showWord(word, language);}} style={styles.selectionButton}><Text style={styles.selectionButtonText}>{t("Look up")}</Text></Pressable>}
            <Pressable accessibilityRole="button" accessibilityLabel={t("Clear selection")} onPress={() => {activeSelection.current = null; setSelectedWord(null);}} style={styles.selectionButton}><Text style={styles.selectionButtonText}>{t("Done")}</Text></Pressable>
            <Text style={styles.selectionHint}>{t("Tap another word to extend")}</Text>
          </View>} />
        {!immersive && <View><View style={styles.pageBottom}><View style={styles.referenceGroup}><Text accessibilityLabel={activeBook.id === GITA_BOOK_ID ? `${activeBook.title}, chapter ${item.chapter}, ${item.label}` : `${activeBook.title}, ${item.chapterTitle}, ${item.label}`} style={[styles.reference,useBookImages && styles.imageReference]}>{activeBook.id === GITA_BOOK_ID ? `${appLanguage === 'hi' ? 'गीता' : activeBook.shortTitle} ${item.chapter}.${item.label.replace(/^TEXTS?\s+/i, '')}` : `${localChapter(item.chapterTitle)} · ${appLanguage === 'hi' ? item.label.replace('PASSAGE','अंश') : item.label.toLowerCase()}`}</Text></View><View style={[styles.actions,sharingId === item.id && styles.hiddenActions]}><Pressable accessibilityRole="button" accessibilityLabel={narrating ? t("Stop reading aloud") : t("Read passage aloud")} onPress={() => {if (readAloud || readAloudRef.current) stopReadAloud(); else if (narrating) stopNarration(); else if (!loading) void startNarration(item);}} style={styles.action}><Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.accent} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">{narrating ? <Path d="M7 7h10v10H7z"/> : <Path d="M8 5v14l11-7L8 5z"/>}</Svg></Pressable><Pressable accessibilityRole="button" accessibilityLabel={Object.hasOwn(saved, item.id) ? t("Remove saved passage") : t("Save passage")} onPress={() => void toggle(item)} style={styles.action}><Text style={styles.heart}>{Object.hasOwn(saved, item.id) ? '♥' : '♡'}</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel={t("Share passage image")} accessibilityState={{busy:sharingId===item.id}} disabled={sharingId!==null || loading} onPress={() => void sharePassage(item)} style={styles.action}><Svg accessible={false} width={22} height={22} viewBox="0 0 24 24" fill="none"><Path d="M22 2 9.5 14.5M22 2l-7.5 20-5-7.5L2 9.5 22 2Z" stroke={colors.accent} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" /></Svg></Pressable>{Object.hasOwn(saved, item.id) && <Pressable accessibilityRole="button" accessibilityLabel={t("Edit note")} onPress={() => {setEditing(item.id); setNote(saved[item.id]);}} style={styles.action}><Text style={styles.noteIcon}>✎</Text></Pressable>}</View></View></View>}
      </View>; }}/> : screen === 'books' ? <View style={styles.section}>
        <FlatList data={books} keyExtractor={book => book.id} renderItem={({item}) => {
          const last = lastByBook[item.id] ? item.passages.find(p => p.id === lastByBook[item.id]) : undefined;
          const installed = !!installedBooks[item.id];
          const downloading = bookDownload?.id === item.id;
          const progress = downloading ? Math.round(bookDownload.progress*100) : 0;
          return <View style={styles.bookRow}>
            <Pressable accessibilityRole="button" accessibilityLabel={`${t(item.title)} ${installed ? (appLanguage==='hi' ? 'खोलें' : 'open') : (appLanguage==='hi' ? 'डाउनलोड करें' : 'download')}`} onPress={() => openBook(item)} onLongPress={() => setBookInfo(item)} style={{flexDirection:'row',alignItems:'center',gap:18,flex:1}}>
              <View style={{width:76,height:114,borderRadius:5,overflow:'hidden'}}>
                <Image source={item.cover} style={styles.bookCover} resizeMode="cover" blurRadius={installed ? 0 : 3} accessibilityIgnoresInvertColors accessible={false}/>
                {downloading && <View accessibilityRole="progressbar" accessibilityLabel={`${t(item.title)} ${appLanguage==='hi'?'डाउनलोड हो रही है':'downloading'}`} accessibilityValue={{min:0,max:100,now:progress}} style={{position:'absolute',top:0,bottom:0,left:0,right:0,backgroundColor:'rgba(0,0,0,0.48)',alignItems:'center',justifyContent:'center'}}><Text style={{color:'#fff',fontSize:17,fontWeight:'700'}}>{progress}%</Text><View style={{width:48,height:3,backgroundColor:'rgba(255,255,255,0.4)',marginTop:8,borderRadius:2}}><View style={{width:`${progress}%`,height:3,backgroundColor:'#fff',borderRadius:2}}/></View></View>}
              </View>
              <View style={{flex:1}}><Text style={styles.bookTitle}>{t(item.title)}</Text><Text style={styles.bookDetail}>{!installed ? `${(bookDownloads[item.id].bytes/1000000).toFixed(1)} MB · ${item.languages.includes('hi') ? t("Hindi, English & Sanskrit") : t("English & Sanskrit")}` : last ? `${appLanguage==='hi'?'जारी रखें':'Continue'} · ${localChapter(last.chapterTitle)}` : `${item.chapters.length} ${appLanguage==='hi'?'अध्याय':'chapters'}`}</Text></View>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`${t(item.title)} ${appLanguage==='hi'?'की जानकारी':'information'}`} onPress={() => setBookInfo(item)} style={{width:44,height:48,alignItems:'center',justifyContent:'center'}}><Svg width={24} height={24} viewBox="0 0 24 24" fill={colors.muted}><Circle cx={5} cy={12} r={1.8}/><Circle cx={12} cy={12} r={1.8}/><Circle cx={19} cy={12} r={1.8}/></Svg></Pressable>
            {!installed ? <Pressable accessibilityRole="button" accessibilityLabel={`${t(item.title)} ${appLanguage==='hi'?'डाउनलोड करें':'download'}`} accessibilityState={{busy:downloading}} onPress={() => {if (!downloading) void installBook(item);}} style={{width:48,height:48,alignItems:'center',justifyContent:'center'}}><Svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke={colors.accent} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><Path d="M12 3v12m-5-5 5 5 5-5M5 19h14"/></Svg></Pressable> : <Pressable accessibilityRole="button" accessibilityLabel={`${t(item.title)} ${appLanguage==='hi'?'खोलें':'open'}`} onPress={() => openBook(item)} style={{width:48,height:48,alignItems:'center',justifyContent:'center'}}><Text accessible={false} style={styles.arrow}>›</Text></Pressable>}
          </View>;
        }}/>
      </View> : <View style={styles.section}><FlatList<NavigationItem> data={screen === 'chapters' ? chapterItems : passages.filter(p => Object.hasOwn(saved, p.id)).map(p => ({key: p.id, title: (savedText[p.id]?.[language] ?? p[language]) || p.label, detail: saved[p.id] || p.label, progress: undefined, idx: passages.indexOf(p)}))} keyExtractor={item => item.key} ListEmptyComponent={<Text style={styles.empty}>{t("Nothing saved yet. Tap the heart while reading to save a passage.")}</Text>} renderItem={({item}) => <Pressable accessibilityRole="button" onPress={() => jump(item.idx)} style={styles.row}><View style={{flex: 1}}><Text style={styles.rowLabel}>{item.detail}</Text><Text style={styles.rowTitle} numberOfLines={2}>{item.title}</Text>{item.progress && <View style={styles.chapterProgress}>
          <View style={styles.progressLabels}><Text style={styles.progressText}>{item.progress.label}</Text><Text style={styles.progressText}>{item.progress.percent}%</Text></View>
          <View accessibilityRole="progressbar" accessibilityLabel={`${appLanguage==='hi'?'पढ़ने की स्थिति':'Reading position'}: ${item.progress.label}`} accessibilityValue={{min:0,max:100,now:item.progress.percent}} style={styles.progressTrack}><View style={[styles.progressFill,{width:`${item.progress.percent}%`}]}/></View>
        </View>}</View><Text style={styles.arrow}>↗</Text></Pressable>}/></View>}
    </View>
    <Modal visible={walkthroughVisible} transparent animationType="fade" onRequestClose={() => void finishWalkthrough()}>
      <SafeAreaProvider><SafeAreaView style={{flex:1,backgroundColor:'#0009',justifyContent:'center',padding:24}}>
        <ScrollView contentContainerStyle={{flexGrow:1,justifyContent:'center'}}><View accessibilityViewIsModal style={{backgroundColor:colors.white,borderRadius:20,padding:24,gap:20,maxWidth:480,width:'100%',alignSelf:'center',shadowColor:'#000',shadowOpacity:0.2,shadowRadius:20,shadowOffset:{width:0,height:8},elevation:10}}>
          <View style={{gap:8}}><Text accessibilityRole="header" style={{fontSize:22,fontWeight:'700',color:colors.ink}}>{appLanguage==='hi'?'पूरी स्क्रीन पर पढ़ें':'Read full screen'}</Text><Text style={{fontSize:15,lineHeight:23,color:colors.muted}}>{appLanguage==='hi'?'पढ़ते समय दो उंगलियों से स्क्रीन पर पिंच करें।':'Use two fingers while reading to change the view.'}</Text></View>
          <View style={{gap:16}}><View style={{flexDirection:'row',alignItems:'center',gap:16}}><Svg width={38} height={38} viewBox="0 0 24 24" fill="none" stroke={colors.accent} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><Path d="M8 8 3 3m0 0v4m0-4h4M16 16l5 5m0 0v-4m0 4h-4"/></Svg><View style={{flex:1,gap:4}}><Text style={styles.settingsMenuTitle}>{appLanguage==='hi'?'उंगलियाँ फैलाएँ':'Spread fingers apart'}</Text><Text style={styles.settingsMenuDescription}>{appLanguage==='hi'?'पूरी स्क्रीन पर पढ़ें।':'Hide controls for full-screen reading.'}</Text></View></View>
          <View style={{flexDirection:'row',alignItems:'center',gap:16}}><Svg width={38} height={38} viewBox="0 0 24 24" fill="none" stroke={colors.accent} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><Path d="M3 3l5 5m0 0V4m0 4H4m17 13-5-5m0 0v4m0-4h4"/></Svg><View style={{flex:1,gap:4}}><Text style={styles.settingsMenuTitle}>{appLanguage==='hi'?'उंगलियाँ पास लाएँ':'Pinch fingers together'}</Text><Text style={styles.settingsMenuDescription}>{appLanguage==='hi'?'रीडिंग नियंत्रण वापस लाएँ।':'Bring the reading controls back.'}</Text></View></View></View>
          <Text style={{fontSize:13,lineHeight:20,color:colors.muted}}>{appLanguage==='hi'?'इसे आप सेटिंग में फिर से देख सकते हैं।':'You can reset this guide in Settings.'}</Text>
          <View style={{flexDirection:'row',alignItems:'center',justifyContent:'flex-end',gap:12,flexWrap:'wrap'}}><Pressable accessibilityRole="button" disabled={walkthroughSaving} onPress={() => void finishWalkthrough()} style={styles.button}><Text style={{fontSize:15,color:colors.muted}}>{appLanguage==='hi'?'छोड़ें':'Skip'}</Text></Pressable><Pressable accessibilityRole="button" disabled={walkthroughSaving} onPress={() => void finishWalkthrough()} style={[styles.button,styles.buttonPrimary]}><Text style={{fontSize:15,fontWeight:'600',color:colors.onAccent}}>{appLanguage==='hi'?'समझ गया':'Got it'}</Text></Pressable></View>
        </View></ScrollView>
      </SafeAreaView></SafeAreaProvider>
    </Modal>
    <Modal visible={sectionMenuOpen} transparent animationType="none" onRequestClose={() => setSectionMenuOpen(false)}>
      <View style={{flex:1}}><Pressable accessibilityRole="button" accessibilityLabel={t("Close section menu")} onPress={() => setSectionMenuOpen(false)} style={{position:'absolute',top:0,bottom:0,left:0,right:0}}/>
        <SafeAreaView pointerEvents="box-none" style={{flex:1}}><View style={{position:'absolute',top:insets.top+58,left:16,width:220,backgroundColor:colors.white,borderColor:colors.line,borderWidth:1,borderRadius:14,overflow:'hidden',shadowColor:'#000',shadowOpacity:0.14,shadowRadius:12,shadowOffset:{width:0,height:5},elevation:8}}>
          <Pressable accessibilityRole="button" accessibilityLabel={t("Books, current section")} onPress={() => setSectionMenuOpen(false)} style={{minHeight:52,paddingHorizontal:16,flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><Text style={{fontSize:16,fontWeight:'600',color:colors.ink}}>{t("Books")}</Text><Text style={{fontSize:18,color:colors.accent}}>✓</Text></Pressable>
          <View style={{height:StyleSheet.hairlineWidth,backgroundColor:colors.line,marginHorizontal:16}}/>
          <Pressable accessibilityRole="button" accessibilityLabel={t("Open Prashnavali")} onPress={() => {setSectionMenuOpen(false); setTimeout(() => router.push({pathname:'/prashnavali',params:{theme:colorTheme}}),150);}} style={{minHeight:52,paddingHorizontal:16,justifyContent:'center'}}><Text style={{fontSize:16,color:colors.ink}}>{t("Prashnavali")}</Text></Pressable>
        </View></SafeAreaView>
      </View>
    </Modal>
    <Modal visible={bookInfo !== null} transparent animationType="slide" onRequestClose={() => setBookInfo(null)}>
      <View style={styles.overlay}><Pressable accessibilityRole="button" accessibilityLabel={t("Close book information")} onPress={() => setBookInfo(null)} style={{position:'absolute',top:0,bottom:0,left:0,right:0}}/><View style={[styles.sheet,{padding:24,gap:16}]}>
        {bookInfo && <><Text accessibilityRole="header" style={styles.bookTitle}>{appLanguage === 'hi' ? `${t(bookInfo.title)} के बारे में` : `About ${bookInfo.title}`}</Text>
          <Text style={styles.bookDetail}>{bookInfo.id === GITA_BOOK_ID ? t("Sanskrit with Hindi and English translations by Hansi Gita Bhawan Trust.") : t("Sanskrit and English from the Itihasa corpus. This historic edition was digitised using OCR and may contain errors; some source passages contain multiple verses.")}</Text>
          <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(bookInfo.id === GITA_BOOK_ID ? 'https://gitabhawan.org.in/gita/research' : 'https://aclanthology.org/2021.wat-1.22/')} style={styles.button}><Text style={{color:colors.accent}}>{t("View source and credits ↗")}</Text></Pressable>
          {installedBooks[bookInfo.id] && <Pressable accessibilityRole="button" onPress={() => {const book=bookInfo; setBookInfo(null); setTimeout(() => confirmRemoveBook(book), 400);}} style={[styles.button,{borderWidth:1,borderColor:colors.line,alignItems:'center'}]}><Text style={{color:colors.accent,fontWeight:'600'}}>{t("Remove download")}</Text></Pressable>}
        </>}
      </View></View>
    </Modal>
    {screen==='read' && settingsPage===null && !readerMenuOpen && !!shuffleMessage && <View pointerEvents="none" style={{position:'absolute',top:insets.top+70,alignSelf:'center',maxWidth:'85%',paddingVertical:10,paddingHorizontal:16,borderRadius:22,backgroundColor:colors.white,borderWidth:1,borderColor:colors.line,shadowColor:'#000',shadowOpacity:0.14,shadowRadius:8,shadowOffset:{width:0,height:3},elevation:5}}><Text accessibilityLiveRegion="polite" style={{color:colors.ink,fontSize:14,textAlign:'center'}}>{shuffleMessage}</Text></View>}
    {readerMenuOpen && <View style={styles.readerMenuOverlay}>
      <Pressable accessibilityRole="button" accessibilityLabel={t("Close book menu")} onPress={() => setReaderMenuOpen(false)} style={styles.readerMenuBackdrop}/>
      <View style={styles.sheet}>
        <Text accessibilityRole="header" style={styles.readerMenuTitle}>{t(activeBook.title)}</Text>
        <Pressable accessibilityRole="button" onPress={() => {setReaderMenuOpen(false); setScreen('saved');}} style={styles.settingsListRow}><Text style={styles.readerMenuItem}>{t("Saved verses and notes")}</Text><Text style={styles.settingsChevron}>›</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => openChapterImages(null)} style={styles.settingsListRow}><Text style={styles.readerMenuItem}>{appLanguage==='hi'?'अध्याय के चित्र':'Chapter images'}</Text><Text style={styles.settingsChevron}>›</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => {setReaderMenuOpen(false); shuffleChapterImages(activeBook,passages[index]?.chapter);}} style={styles.settingsListRow}><Text style={styles.readerMenuItem}>{appLanguage==='hi'?'चित्रों को फिर से बदलें':'Shuffle images'}</Text><Text style={styles.settingsChevron}>↻</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => {setReaderMenuOpen(false); setSettingsPage('menu');}} style={styles.settingsListRow}><Text style={styles.readerMenuItem}>{t("Settings")}</Text><Text style={styles.settingsChevron}>›</Text></Pressable>
      </View>
    </View>}
    <Modal visible={settingsPage !== null} animationType="slide" onRequestClose={closeSettingsPage}>
      <SafeAreaProvider><SafeAreaView style={styles.settingsScreen}>
        <View style={styles.settingsNavigationHeader}>
          <Pressable accessibilityRole="button" accessibilityLabel={settingsPage === 'menu' ? t("Back to reader") : t("Back to settings")} onPress={closeSettingsPage} style={styles.settingsBackButton}><Text style={styles.backIcon}>‹</Text></Pressable>
          <Text accessibilityRole="header" style={styles.settingsNavigationTitle}>{settingsPage === 'chapter-images' ? (appLanguage==='hi'?'अध्याय के चित्र':'Chapter images') : settingsPage === 'chapter-select' ? (appLanguage==='hi'?'अध्याय चुनें':'Choose chapter') : settingsPage === 'language' ? t("App language") : settingsPage === 'credits' ? t("Credits") : settingsPage === 'privacy' ? (appLanguage === 'hi' ? 'गोपनीयता' : 'Privacy') : settingsPage === 'reading' ? t("Reading customisation") : settingsPage === 'appearance' ? t("App appearance") : settingsPage === 'playback' ? t("Reading playback") : settingsPage === 'music' ? t("Music") : settingsPage === 'downloads' ? t("Downloaded resources") : settingsPage === 'dictionary' ? t("Dictionary") : t("Settings")}</Text>
        </View>
        {settingsPage === 'menu' ? <ScrollView contentContainerStyle={styles.settingsList}>
          <Pressable accessibilityRole="button" accessibilityLabel={t("App language")} onPress={() => setSettingsPage('language')} style={styles.settingsListRow}>
            <View style={styles.settingsMenuText}><Text style={styles.settingsMenuTitle}>{t("App language")}</Text><Text style={styles.settingsMenuDescription}>{t("Choose the language used in menus and settings.")}</Text></View><Text style={styles.settingsChevron}>›</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={t("Reading customisation")} onPress={() => setSettingsPage('reading')} style={styles.settingsListRow}>
            <View style={styles.settingsMenuText}><Text style={styles.settingsMenuTitle}>{t("Reading customisation")}</Text><Text style={styles.settingsMenuDescription}>{t("Adjust text size and reading background.")}</Text></View><Text style={styles.settingsChevron}>›</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={t("App appearance")} onPress={() => setSettingsPage('appearance')} style={styles.settingsListRow}>
            <View style={styles.settingsMenuText}><Text style={styles.settingsMenuTitle}>{t("App appearance")}</Text><Text style={styles.settingsMenuDescription}>{t("Choose the colors used throughout the app.")}</Text></View><Text style={styles.settingsChevron}>›</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={t("Reading playback")} onPress={() => setSettingsPage('playback')} style={styles.settingsListRow}>
            <View style={styles.settingsMenuText}><Text style={styles.settingsMenuTitle}>{t("Reading playback")}</Text><Text style={styles.settingsMenuDescription}>{t("Manage read aloud and auto-scroll.")}</Text></View><Text style={styles.settingsChevron}>›</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={t("Music")} onPress={() => setSettingsPage('music')} style={styles.settingsListRow}>
            <View style={styles.settingsMenuText}><Text style={styles.settingsMenuTitle}>{t("Music")}</Text><Text style={styles.settingsMenuDescription}>{t("Control background music and volume.")}</Text></View><Text style={styles.settingsChevron}>›</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={t("Dictionary")} onPress={() => setSettingsPage('dictionary')} style={styles.settingsListRow}>
            <View style={styles.settingsMenuText}><Text style={styles.settingsMenuTitle}>{t("Dictionary")}</Text><Text style={styles.settingsMenuDescription}>{t("Manage offline definitions and source information.")}</Text></View><Text style={styles.settingsChevron}>›</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={t("Downloaded resources")} onPress={() => setSettingsPage('downloads')} style={styles.settingsListRow}>
            <View style={styles.settingsMenuText}><Text style={styles.settingsMenuTitle}>{t("Downloaded resources")}</Text><Text style={styles.settingsMenuDescription}>{t("Manage the offline voice and dictionary.")}</Text></View><Text style={styles.settingsChevron}>›</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={appLanguage === 'hi' ? 'गोपनीयता' : 'Privacy'} onPress={() => setSettingsPage('privacy')} style={styles.settingsListRow}>
            <View style={styles.settingsMenuText}><Text style={styles.settingsMenuTitle}>{appLanguage === 'hi' ? 'गोपनीयता' : 'Privacy'}</Text><Text style={styles.settingsMenuDescription}>{appLanguage === 'hi' ? 'आपका डेटा, डाउनलोड और संपर्क जानकारी।' : 'Your data, downloads and contact information.'}</Text></View><Text style={styles.settingsChevron}>›</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={appLanguage==='hi'?'पढ़ने का परिचय रीसेट करें':'Reset reading walkthrough'} accessibilityState={{disabled:walkthroughSaving}} disabled={walkthroughSaving} onPress={() => void resetWalkthrough()} style={styles.settingsListRow}><View style={styles.settingsMenuText}><Text style={styles.settingsMenuTitle}>{appLanguage==='hi'?'पढ़ने का परिचय रीसेट करें':'Reset reading walkthrough'}</Text><Text style={styles.settingsMenuDescription}>{appLanguage==='hi'?'पुस्तक दोबारा खोलने पर पिंच का परिचय देखें।':'Show the pinch gesture guide the next time you open a book.'}</Text></View><Text style={styles.settingsChevron}>↻</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={t("Credits")} onPress={() => setSettingsPage('credits')} style={styles.settingsListRow}>
            <View style={styles.settingsMenuText}><Text style={styles.settingsMenuTitle}>{t("Credits")}</Text><Text style={styles.settingsMenuDescription}>{t("Books, music, voice and other sources.")}</Text></View><Text style={styles.settingsChevron}>›</Text>
          </Pressable>
        </ScrollView> : settingsPage === 'language' ? <ScrollView contentContainerStyle={styles.settingsList}>
          <Text style={styles.imageHelp}>{t("Choose the language used in menus and settings.")} {appLanguage === 'hi' ? 'पुस्तक के पाठ की भाषा अलग से चुनी जाती है।' : t("The reading language is chosen separately.")}</Text>
          {([['en',t("English")],['hi','हिंदी']] as const).map(([value,label]) => <Pressable key={value} accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{checked:appLanguage===value}} onPress={() => void setAppLanguage(value)} style={styles.choiceRow}><Text style={styles.settingsMenuTitle}>{label}</Text>{appLanguage===value && <Text style={styles.choiceCheck}>✓</Text>}</Pressable>)}
        </ScrollView> : settingsPage === 'privacy' ? <ScrollView contentContainerStyle={styles.settingsList}>
          <Text style={styles.imageHelp}>{appLanguage === 'hi' ? 'गोपनीयता नीति का प्रारूप · 18 नवंबर 2026' : 'Privacy policy draft · 18 November 2026'}</Text>
          {[
            ["Your device", "आपका डिवाइस", "Reading progress, saved passages, notes, preferences and downloaded content are stored on your device. Photos you select for backgrounds are copied into the app. Your device or backup provider may include app data in backups according to your settings.", "पढ़ने की स्थिति, सहेजे गए अंश, नोट्स, प्राथमिकताएँ और डाउनलोड की गई सामग्री आपके डिवाइस पर रहती है। पृष्ठभूमि के लिए चुने गए चित्रों की प्रतियाँ ऐप में रखी जाती हैं। आपकी सेटिंग के अनुसार डिवाइस या बैकअप सेवा ऐप डेटा का बैकअप ले सकती है।"],
            ["Downloads", "डाउनलोड", "Book files come from GitHub, the optional dictionary from en-word.net, and optional voice files from Hugging Face and GitHub. These services may receive your IP address, requested file, request time and other technical details and retain logs under their own policies. Downloads may use mobile data.", "पुस्तकें GitHub से, वैकल्पिक शब्दकोश en-word.net से और वैकल्पिक वॉइस फ़ाइलें Hugging Face और GitHub से डाउनलोड होती हैं। इन सेवाओं को आपका IP पता, फ़ाइल का नाम, अनुरोध का समय और तकनीकी जानकारी मिल सकती है; वे अपनी नीतियों के अनुसार लॉग रख सकती हैं। डाउनलोड में मोबाइल डेटा लग सकता है।"],
            ["On-device features", "डिवाइस पर चलने वाली सुविधाएँ", "The voice model reads text and the dictionary looks up words on your device. These features do not send the passage or lookup word to a remote service. An internet connection is needed to download their files first.", "वॉइस मॉडल पाठ पढ़ता है और शब्दकोश शब्दों का अर्थ आपके डिवाइस पर खोजता है। ये सुविधाएँ अंश या खोजा गया शब्द किसी दूरस्थ सेवा को नहीं भेजतीं। पहली बार फ़ाइलें डाउनलोड करने के लिए इंटरनेट चाहिए।"],
            ["Photos, copy and sharing", "चित्र, कॉपी और शेयर", "Choosing photos is optional. Copy puts the selected text on your device clipboard. Sharing opens the system share sheet; the app you choose receives what you share and applies its own privacy policy. External links open other services and their policies apply.", "चित्र चुनना वैकल्पिक है। कॉपी करने पर चुना हुआ पाठ डिवाइस के क्लिपबोर्ड पर जाता है। शेयर करने पर सिस्टम की शेयर सूची खुलती है; चुने गए ऐप को साझा की गई सामग्री मिलती है और उसकी अपनी गोपनीयता नीति लागू होती है। बाहरी लिंक पर संबंधित सेवा की नीति लागू होती है।"],
            ["Accounts and analytics", "खाते और विश्लेषण", "This version does not require a DivineCanvas account and has no advertising or analytics feature. We do not sell your personal information. Other services you choose to use have their own privacy policies.", "इस संस्करण में DivineCanvas खाता आवश्यक नहीं है और विज्ञापन या विश्लेषण की सुविधा नहीं है। हम आपकी व्यक्तिगत जानकारी नहीं बेचते। आपके द्वारा उपयोग की जाने वाली अन्य सेवाओं की अपनी गोपनीयता नीतियाँ हैं।"],
            ["Deleting data", "डेटा हटाना", "You can remove downloaded books, the dictionary and the voice model in the app. Removing a book keeps its notes and progress. Uninstalling normally removes local app data; device or cloud backups may remain and can be managed with your backup provider. Third-party services control their own logs.", "आप ऐप में डाउनलोड की गई पुस्तकें, शब्दकोश और वॉइस मॉडल हटा सकते हैं। पुस्तक हटाने पर उसके नोट्स और पढ़ने की स्थिति बनी रहती है। ऐप हटाने पर आम तौर पर स्थानीय डेटा हट जाता है; डिवाइस या क्लाउड बैकअप रह सकते हैं, जिन्हें आप अपनी बैकअप सेवा में प्रबंधित कर सकते हैं। अन्य सेवाएँ अपने लॉग स्वयं नियंत्रित करती हैं।"],
            ["Questions", "सवाल", "For privacy questions or requests, contact tanyamaurya2001@gmail.com. We will update this policy if our practices change.", "गोपनीयता से संबंधित सवालों या अनुरोधों के लिए tanyamaurya2001@gmail.com पर संपर्क करें। हमारी प्रक्रिया बदलने पर हम यह नीति अपडेट करेंगे।"],
          ].map(([enTitle, hiTitle, enText, hiText]) => <View key={enTitle} style={styles.settingsCredits}><Text accessibilityRole="header" style={styles.settingsMenuTitle}>{appLanguage === 'hi' ? hiTitle : enTitle}</Text><Text style={styles.settingsCreditText}>{appLanguage === 'hi' ? hiText : enText}</Text></View>)}
        </ScrollView> : settingsPage === 'credits' ? <ScrollView contentContainerStyle={styles.settingsList}>
          <View style={styles.settingsCredits}>
            <Text style={styles.settingsMenuTitle}>{t("Books")}</Text>
            <Text style={styles.settingsCreditText}>{t("Bhagavad Gita Hindi and English translations by Hansi Gita Bhawan Trust.")}</Text>
            <Text accessibilityRole="link" onPress={() => void Linking.openURL('https://gitabhawan.org.in/gita/research')} style={styles.settingsCreditLink}>{t("View source and terms ↗")}</Text>
            <Text style={styles.settingsCreditText}>{t("Ramayana and Mahabharata: Itihasa corpus by Rahul Aralikatte and colleagues, based on Manmatha Nath Dutt’s English translations. OCR text may contain errors.")}</Text>
            <Text accessibilityRole="link" onPress={() => void Linking.openURL('https://aclanthology.org/2021.wat-1.22/')} style={styles.settingsCreditLink}>{t("Itihasa source ↗")}</Text>
            <Text style={styles.settingsCreditText}>{t("Ramcharitmanas passages: WirelessAlien/Ramcharitmanas, sourced from the IIT Kanpur Ramcharitmanas project. Board reference: Chalisa Sangrah. Meanings are original summaries.")}</Text>
            <Text accessibilityRole="link" onPress={() => void Linking.openURL('https://github.com/WirelessAlien/Ramcharitmanas')} style={styles.settingsCreditLink}>{appLanguage==='hi' ? 'प्रश्नावली पाठ का स्रोत ↗' : 'Prashnavali passage source ↗'}</Text>
            <Text accessibilityRole="link" onPress={() => void Linking.openURL('https://chalisasangrah.in/Prashnavali')} style={styles.settingsCreditLink}>{appLanguage==='hi' ? 'प्रश्नावली का संदर्भ ↗' : 'Prashnavali board reference ↗'}</Text>
          </View>
          <View style={styles.settingsCredits}>
            <Text style={styles.settingsMenuTitle}>{t("Reading voice")} · {t("Music")}</Text>
            <Text style={styles.settingsCreditText}>{t("Reading voice: Paradee by Sahil Mahendrakar.")}</Text>
            <Text accessibilityRole="link" onPress={() => void Linking.openURL('https://github.com/sahilmahendrakar/paradee')} style={styles.settingsCreditLink}>{t("Voice source ↗")}</Text>
            <Text style={styles.settingsCreditText}>{t("“Krishna Flute Music” by Alex Morgan, licensed under Creative Commons Attribution 4.0.")}</Text>
            <Text accessibilityRole="link" onPress={() => void Linking.openURL('https://freemusicarchive.org/music/alex-morgan/world-devotional-music/krishna-flute-music/')} style={styles.settingsCreditLink}>{t("Music source ↗")}</Text>
            <Text accessibilityRole="link" onPress={() => void Linking.openURL('https://creativecommons.org/licenses/by/4.0/')} style={styles.settingsCreditLink}>{t("License ↗")}</Text>
          </View>
          <View style={styles.settingsCredits}>
            <Text style={styles.settingsMenuTitle}>{t("Dictionary")}</Text>
            <Text style={styles.settingsCreditText}>{t("Open English WordNet 2025, based on Princeton WordNet. Licensed under CC BY 4.0 and the Princeton WordNet license.")}</Text>
            <Text accessibilityRole="button" accessibilityState={{expanded:showDictionaryLicense}} onPress={() => setShowDictionaryLicense(value => !value)} style={styles.settingsCreditLink}>{showDictionaryLicense ? t("Hide full notice") : t("View full notice")}</Text>
            {showDictionaryLicense && <Text style={styles.settingsCreditText}>{wordnetNotice}</Text>}
            <Text accessibilityRole="link" onPress={() => void Linking.openURL('https://github.com/globalwordnet/english-wordnet/blob/2025-edition/LICENSE.md')} style={styles.settingsCreditLink}>{t("Dictionary source and license ↗")}</Text>
          </View>
          <View style={styles.settingsCredits}>
            <Text style={styles.settingsCreditText}>{appLanguage === 'hi' ? 'पठन के चित्र परियोजना स्वामी द्वारा उपलब्ध कराए गए हैं।' : 'Reading images were supplied by the project owner.'}</Text>
            <Text style={styles.settingsCreditText}>{t("Settings icon by Lucide Icons and Contributors.")}</Text>
            <Text accessibilityRole="button" accessibilityState={{expanded:showIconLicense}} onPress={() => setShowIconLicense(value => !value)} style={styles.settingsCreditLink}>{showIconLicense ? t("Hide icon license") : t("View icon license")}</Text>
            {showIconLicense && <Text style={styles.settingsCreditText}>{lucideNotice}</Text>}
          </View>
        </ScrollView> : settingsPage === 'dictionary' ? <ScrollView contentContainerStyle={styles.settingsList}>
          <View style={styles.settingsListRow}>
            <View style={styles.settingsMenuText}><Text style={styles.settingsMenuTitle}>{t("English dictionary")}</Text><Text style={styles.settingsMenuDescription}>{dictionaryDownload !== null ? `${appLanguage === 'hi' ? 'डाउनलोड हो रहा है' : 'Downloading'} ${Math.round(dictionaryDownload*100)}%` : dictionaryInstalled ? t("Downloaded · about 10 MB") : t("Not downloaded · about 10 MB")}</Text></View>
            {dictionaryDownload === null && <Pressable accessibilityRole="button" accessibilityLabel={dictionaryInstalled ? t("Remove English dictionary") : t("Download English dictionary")} onPress={() => {if (dictionaryInstalled) deleteDictionary(); else void installDictionaryFromSettings();}}><Text style={styles.downloadCancel}>{dictionaryInstalled ? t("Remove") : t("Download")}</Text></Pressable>}
          </View>
          <Text style={styles.imageHelp}>{t("Double-tap an English word while reading to look it up. Hindi and Sanskrit dictionaries are not available yet.")}</Text>
        </ScrollView> : settingsPage === 'downloads'  ? <ScrollView contentContainerStyle={styles.settingsList}>
          <View style={styles.settingsListRow}><View style={styles.settingsMenuText}><Text style={styles.settingsMenuTitle}>{t("Reading voice")}</Text><Text style={styles.settingsMenuDescription}>{voiceDownload !== null ? `${appLanguage === 'hi' ? 'डाउनलोड हो रहा है' : 'Downloading'} ${Math.round(voiceDownload*100)}%` : voiceInstalled ? t("Downloaded · about 11 MB") : t("Not downloaded · about 11 MB")}</Text></View>
            {voiceDownload !== null ? <Pressable accessibilityRole="button" onPress={cancelVoiceDownload}><Text style={styles.downloadCancel}>{t("Cancel")}</Text></Pressable> : <Pressable accessibilityRole="button" onPress={() => void (voiceInstalled ? removeVoice() : downloadVoice())}><Text style={styles.downloadCancel}>{voiceInstalled ? t("Remove") : t("Download")}</Text></Pressable>}
          </View>
          <View style={styles.settingsListRow}><View style={styles.settingsMenuText}><Text style={styles.settingsMenuTitle}>{t("English dictionary")}</Text><Text style={styles.settingsMenuDescription}>{dictionaryDownload !== null ? `${appLanguage === 'hi' ? 'डाउनलोड हो रहा है' : 'Downloading'} ${Math.round(dictionaryDownload*100)}%` : dictionaryInstalled ? t("Downloaded · about 10 MB") : t("Not downloaded · about 10 MB")}</Text></View>
            {dictionaryInstalled && dictionaryDownload === null && <Pressable accessibilityRole="button" accessibilityLabel={t("Remove English dictionary")} onPress={deleteDictionary}><Text style={styles.downloadCancel}>{t("Remove")}</Text></Pressable>}
          </View>
          <Text style={styles.imageHelp}>{t("The dictionary can be downloaded when you double-tap an English word. Removing a resource does not remove your saved verses or notes.")}</Text>
        </ScrollView> : settingsPage === 'playback' ? <ScrollView contentContainerStyle={styles.settingsList}>
          <View style={styles.settingsListRow}>
            <View style={styles.settingsMenuText}><Text style={styles.settingsMenuTitle}>{t("Read aloud")}</Text><Text style={styles.settingsMenuDescription}>{t("Read each passage and move to the next when finished. Tap the reader to stop.")}</Text></View>
            <Switch accessibilityLabel={t("Read aloud")} value={readAloud} onValueChange={toggleReadAloud} trackColor={{true: colors.accent}} />
          </View>
          <View style={styles.settingsListRow}>
            <View style={styles.settingsMenuText}><Text style={styles.settingsMenuTitle}>{t("Reading voice")}</Text><Text style={styles.settingsMenuDescription}>{voiceDownload !== null ? `${appLanguage === 'hi' ? 'डाउनलोड हो रहा है' : 'Downloading'} ${Math.round(voiceDownload*100)}%` : voiceInstalled ? t("Paradee voice is available offline.") : t("Download an offline voice (about 11 MB).")}</Text></View>
            {voiceDownload !== null ? <Pressable accessibilityRole="button" accessibilityLabel={t("Cancel voice download")} onPress={cancelVoiceDownload}><Text style={{color:colors.accent}}>{t("Cancel")}</Text></Pressable> : <Pressable accessibilityRole="button" accessibilityLabel={voiceInstalled ? t("Remove reading voice") : t("Download reading voice")} onPress={() => void (voiceInstalled ? removeVoice() : downloadVoice())}><Text style={{color:colors.accent,fontWeight:'600'}}>{voiceInstalled ? t("Remove") : t("Download")}</Text></Pressable>}
          </View>
          {!runtimeAvailable && <Text style={styles.imageHelp}>{t("Reading aloud requires a development build.")}</Text>}
          <View style={styles.settingsListRow}>
            <View style={styles.settingsMenuText}><Text style={styles.settingsMenuTitle}>{t("Auto-scroll")}</Text><Text style={styles.settingsMenuDescription}>{t("Move to the next passage after a chosen time.")}</Text></View>
            <Switch accessibilityLabel={t("Auto-scroll")} value={autoScrollEnabled} onValueChange={value => {if (value) stopReadAloud(); setAutoScrollEnabled(value); savePreference('auto-scroll-enabled', String(value));}} trackColor={{true: colors.accent}} />
          </View>
          <View style={{paddingVertical:18}}>
            <View style={styles.blurHeading}><Text style={styles.settingsMenuTitle}>{t("Time per passage")}</Text><Text style={styles.settingsMenuDescription}>{autoScrollSeconds} {t("seconds")}</Text></View>
            <Slider accessibilityLabel={t("Time per passage")} accessibilityValue={{min:5,max:60,now:autoScrollSeconds,text:`${autoScrollSeconds} ${t("seconds")}`}} minimumValue={5} maximumValue={60} step={1} value={autoScrollSeconds} onValueChange={setAutoScrollSeconds} onSlidingComplete={value => {setAutoScrollSeconds(value); savePreference('auto-scroll-seconds', String(value));}} minimumTrackTintColor={colors.accent} maximumTrackTintColor={colors.line} thumbTintColor={colors.accent} tapToSeek style={styles.blurSlider}/>
            <Text style={styles.settingsMenuDescription}>{t("Timed scrolling pauses while you interact. Read aloud advances after the voice finishes instead.")}</Text>
          </View>
        </ScrollView> : settingsPage === 'music' ? <ScrollView contentContainerStyle={styles.settingsList}>
          <View style={styles.settingsListRow}>
            <View style={styles.settingsMenuText}><Text style={styles.settingsMenuTitle}>{t("Reading music")}</Text><Text style={styles.settingsMenuDescription}>{t("Play instrumental music while reading.")}</Text></View>
            <Switch accessibilityLabel={t("Reading music")} value={musicEnabled} onValueChange={value => {setMusicEnabled(value); void setting('music-enabled', String(value));}} trackColor={{true: colors.accent}} />
          </View>
          <View style={{paddingVertical: 18}}>
            <View style={styles.blurHeading}><Text style={styles.settingsMenuTitle}>{t("Music volume")}</Text><Text style={styles.settingsMenuDescription}>{Math.round(musicVolume * 100)}%</Text></View>
            <Slider accessibilityLabel={t("Music volume")} accessibilityValue={{min:0,max:100,now:Math.round(musicVolume*100)}} minimumValue={0} maximumValue={1} step={0.01} value={musicVolume} onValueChange={setMusicVolume} onSlidingComplete={value => {setMusicVolume(value); void setting('music-volume', String(value));}} minimumTrackTintColor={colors.accent} maximumTrackTintColor={colors.line} thumbTintColor={colors.accent} tapToSeek style={styles.blurSlider}/>

          </View>
        </ScrollView> : settingsPage === 'chapter-select' ? <View style={{flex:1,paddingHorizontal:24}}>
          <TextInput accessibilityLabel={appLanguage==='hi'?'अध्याय खोजें':'Search chapters'} value={chapterSearch} onChangeText={setChapterSearch} placeholder={appLanguage==='hi'?'अध्याय संख्या या नाम खोजें':'Search chapter number or title'} placeholderTextColor={colors.muted} style={{color:colors.ink,borderBottomWidth:1,borderColor:colors.line,paddingVertical:14,fontSize:16}} />
          <FlatList keyboardShouldPersistTaps="handled" data={pickerBook.chapters.filter(chapter => `${chapter.number} ${chapter.title} ${chapter.detail ?? ''}`.toLowerCase().includes(chapterSearch.trim().toLowerCase()))} keyExtractor={chapter => String(chapter.number)} renderItem={({item}) => <Pressable accessibilityRole="button" accessibilityState={{selected:pickerChapter===item.number}} onPress={() => {setPickerChapter(item.number); setSettingsPage('chapter-images');}} style={styles.settingsListRow}><View style={styles.settingsMenuText}><Text style={styles.settingsMenuTitle}>{appLanguage==='hi'?'अध्याय':'Chapter'} {item.number}</Text><Text style={styles.settingsMenuDescription}>{localChapter(item.title)}</Text></View>{pickerChapter===item.number && <Text style={styles.choiceCheck}>✓</Text>}</Pressable>} />
        </View> : settingsPage === 'chapter-images' ? <ScrollView contentContainerStyle={styles.settingsContent}>
          <View><Text style={styles.preferenceLabel}>{appLanguage==='hi'?'पुस्तक':'Book'}</Text><Text style={[styles.settingsMenuTitle,{marginTop:8}]}>{t(pickerBook.title)}</Text><Text style={styles.imageHelp}>{appLanguage==='hi'?'हर पुस्तक और अध्याय का चुनाव अलग से सहेजा जाता है।':'Choices are saved separately for each book and chapter.'}</Text>
            {imagePickerReturn==='reading' && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8,paddingVertical:12}}>{books.map(book => <Pressable key={book.id} accessibilityRole="radio" accessibilityState={{checked:pickerBookId===book.id}} onPress={() => {setPickerBookId(book.id);setPickerChapter(book.chapters[0]?.number ?? 1);setShuffleMessage('');}} style={[styles.language,pickerBookId===book.id && styles.selectedOption]}><Text style={[styles.languageText,pickerBookId===book.id && styles.selectedText]}>{t(book.title)}</Text></Pressable>)}</ScrollView>}
          </View>
          <Pressable accessibilityRole="button" onPress={() => {setChapterSearch('');setSettingsPage('chapter-select');}} style={styles.settingsListRow}><View style={styles.settingsMenuText}><Text style={styles.settingsMenuTitle}>{appLanguage==='hi'?'अध्याय':'Chapter'} {pickerChapter}</Text><Text style={styles.settingsMenuDescription}>{localChapter(pickerBook.chapters.find(chapter => chapter.number===pickerChapter)?.title ?? '')}</Text></View><Text style={styles.settingsChevron}>›</Text></Pressable>
          {pickerBackground && <View style={styles.imagePreview}><Image source={pickerBackground.source} style={styles.backgroundImage} resizeMode="cover" /></View>}
          <View><Text style={styles.preferenceLabel}>{appLanguage==='hi'?'इस अध्याय के लिए चित्र':'Image for this chapter'}</Text><Text style={styles.imageHelp}>{appLanguage==='hi'?'एक चित्र चुनें या अपने आप चुना गया चित्र उपयोग करें।':'Choose an image or use the automatic assignment.'}</Text></View>
          <Pressable accessibilityRole="radio" accessibilityState={{checked:!chapterOverrides[chapterImageKey(pickerBookId,pickerChapter)]}} onPress={() => updateChapterImage(null)} style={styles.choiceRow}><Text style={styles.paletteName}>{appLanguage==='hi'?'अपने आप चुनें':'Automatic'}</Text>{!chapterOverrides[chapterImageKey(pickerBookId,pickerChapter)] && <Text style={styles.choiceCheck}>✓</Text>}</Pressable>
          <View style={styles.imageGrid}>{bookImages.map((image,i) => {const chosen=chapterOverrides[chapterImageKey(pickerBookId,pickerChapter)]===image.id; return <Pressable key={image.id} accessibilityRole="radio" accessibilityLabel={`${appLanguage==='hi'?'चित्र':'Image'} ${i+1}`} accessibilityState={{checked:chosen}} onPress={() => updateChapterImage(image.id)} style={[styles.imageOption,chosen && styles.imageOptionSelected]}><Image source={image.thumbnail} style={styles.imageThumbnail} resizeMethod="resize"/>{chosen && <View style={styles.imageCheck}><Text style={styles.imageCheckText}>✓</Text></View>}</Pressable>;})}</View>
          <View><Pressable accessibilityRole="button" onPress={() => shuffleChapterImages(pickerBook,pickerChapter)} style={({pressed}) => [styles.button,{alignSelf:'flex-start',borderWidth:1,borderColor:colors.line,backgroundColor:pressed ? colors.line : 'transparent'}]}><Text style={{color:colors.accent,fontWeight:'600'}}>{appLanguage==='hi'?'इस पुस्तक के चित्र बदलें':'Shuffle this book’s images'}</Text></Pressable><Text style={styles.imageHelp}>{appLanguage==='hi'?'इस पुस्तक के सभी अध्यायों के चित्र फिर से चुने जाएँगे, जिनमें आपके चुने चित्र भी शामिल हैं।':'Reshuffles all chapters in this book, including your chosen images.'}</Text>{!!shuffleMessage && <Text accessibilityLiveRegion="polite" style={{color:colors.accent,fontSize:14,fontWeight:'600',marginTop:10}}>{shuffleMessage}</Text>}</View>
        </ScrollView> : settingsPage === 'reading' ? <ScrollView contentContainerStyle={styles.settingsContent}>
          <View style={styles.preferenceGroup}><View><Text style={styles.preferenceLabel}>{t("Text size")}</Text><Text style={styles.imageHelp}>{t("Choose a comfortable size for reading.")}</Text></View><View style={styles.sizeOptions}>
            {fontSizes.map((size,i) => <Pressable key={size} accessibilityRole="button" accessibilityLabel={`${[t("Small"),t("Default"),t("Large")][i]} ${appLanguage==='hi'?'अक्षर':'text'}`} accessibilityState={{selected:fontSize===size}} onPress={() => {setFontSize(size); savePreference('font-size',String(size));}} style={[styles.sizeOption,fontSize===size && styles.selectedOption]}><Text style={[styles.sizeSample,{fontSize:18+i*4},fontSize===size && styles.selectedText]}>Aa</Text><Text style={[styles.optionLabel,fontSize===size && styles.selectedText]}>{[t("Small"),t("Default"),t("Large")][i]}</Text></Pressable>)}
          </View></View>
          <View style={styles.preferenceGroup}><View><Text style={styles.preferenceLabel}>{t("Reading background")}</Text><Text style={styles.imageHelp}>{t("Choose what appears behind the text.")}</Text></View>
            <View>
              <Pressable accessibilityRole="radio" accessibilityLabel={t("No image")} accessibilityState={{checked:background!=='images'}} aria-checked={background!=='images'} onPress={() => {setBackground(colorTheme); savePreference('background',colorTheme);}} style={styles.choiceRow}><View style={styles.settingsMenuText}><Text style={styles.settingsMenuTitle}>{t("No image")}</Text><Text style={styles.settingsMenuDescription}>{t("Use your app background color.")}</Text></View>{background !== 'images' && <Text style={styles.choiceCheck}>✓</Text>}</Pressable>
              <Pressable accessibilityRole="radio" accessibilityLabel={t("With images")} accessibilityState={{checked:background==='images'}} aria-checked={background==='images'} onPress={() => {setBackground('images'); savePreference('background','images');}} style={styles.choiceRow}><View style={styles.settingsMenuText}><Text style={styles.settingsMenuTitle}>{t("With images")}</Text><Text style={styles.settingsMenuDescription}>{t("Show an image behind each chapter.")}</Text></View>{background === 'images' && <Text style={styles.choiceCheck}>✓</Text>}</Pressable>
            </View>
          </View>
          <Pressable accessibilityRole="button" onPress={() => openChapterImages('reading')} style={styles.settingsListRow}><View style={styles.settingsMenuText}><Text style={styles.settingsMenuTitle}>{appLanguage==='hi'?'अध्याय के चित्र':'Chapter images'}</Text><Text style={styles.settingsMenuDescription}>{appLanguage==='hi'?'हर अध्याय के लिए चुनें या चित्र बदलें।':'Choose an image for a chapter or shuffle them.'}</Text></View><Text style={styles.settingsChevron}>›</Text></Pressable>
          {background === 'images' && <View style={styles.preferenceGroup}>
            <View><Text style={styles.preferenceLabel}>{t("Image style")}</Text><Text style={styles.imageHelp}>{t("Choose the look of your reading background.")}</Text></View>
            <View style={styles.imagePreview} accessible accessibilityLabel={`${appLanguage==='hi'?'पृष्ठभूमि की झलक':'Background preview'}, ${imageTone === 'color' ? t("Color") : t("Black and white")}, ${t("Blur")} ${imageBlur} / 8`}>
              <View pointerEvents="none" style={styles.fixedBackground}><FilterImage source={currentBackground?.source} style={styles.backgroundImage} resizeMode="cover" filters={imageFilters}/><View style={styles.backgroundScrim}/></View>
              <Text style={styles.imagePreviewText}>{t("A moment to read.")}</Text>
            </View>
            <View>
              {([['color',t("Color")],['monochrome',t("Black and white")]] as const).map(([value,label]) => <Pressable key={value} accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{checked:imageTone===value}} aria-checked={imageTone===value} onPress={() => {setImageTone(value); savePreference('image-tone',value);}} style={styles.choiceRow}><Text style={styles.paletteName}>{label}</Text>{imageTone===value && <Text style={styles.choiceCheck}>✓</Text>}</Pressable>)}
            </View>
            <View><View style={styles.blurHeading}><Text style={styles.preferenceLabel}>{t("Blur")}</Text><Text style={styles.imageHelp}>{imageBlur === 0 ? t("None") : `${imageBlur} / 8`}</Text></View><Text style={styles.imageHelp}>{t("Soften the image behind the text.")}</Text>
              <Slider accessibilityLabel={t("Background blur")} accessibilityValue={{min:0,max:8,now:imageBlur,text:imageBlur === 0 ? t("No blur") : `${appLanguage === 'hi' ? 'धुंधलापन' : 'Blur level'} ${imageBlur} / 8`}} minimumValue={0} maximumValue={8} step={1} value={imageBlur} onValueChange={setImageBlur} onSlidingComplete={value => {setImageBlur(value); savePreference('image-blur',String(value));}} minimumTrackTintColor={colors.accent} maximumTrackTintColor={colors.line} thumbTintColor={colors.accent} tapToSeek style={styles.blurSlider}/>
              <View style={styles.blurLabels}><Text style={styles.optionLabel}>{t("None")}</Text><Text style={styles.optionLabel}>{t("More")}</Text></View>
            </View>
          </View>}
          {background === 'images' && <View style={styles.preferenceGroup}>
            <View><Text style={styles.preferenceLabel}>{t("Chapter images")}</Text><Text style={styles.imageHelp}>{appLanguage==='hi'?'सभी पुस्तकों में अपने आप चुनने के लिए चित्र।':'Images used for automatic selection across all books.'}</Text></View>
            <View style={styles.imageGrid}>{bookImages.map((image, i) => <Pressable key={image.id} accessibilityRole="checkbox" accessibilityLabel={`${appLanguage === 'hi' ? 'पृष्ठभूमि चित्र' : 'Background image'} ${i + 1}`} accessibilityState={{checked:selectedImages.includes(image.id)}} aria-checked={selectedImages.includes(image.id)} onPress={() => toggleImage(image.id)} style={[styles.imageOption,selectedImages.includes(image.id) && styles.imageOptionSelected]}><Image source={image.thumbnail} style={styles.imageThumbnail} resizeMethod="resize"/>{selectedImages.includes(image.id) && <View style={styles.imageCheck}><Text style={styles.imageCheckText}>✓</Text></View>}</Pressable>)}</View>
            <Pressable accessibilityRole="button" accessibilityState={{busy:addingImages}} disabled={addingImages} onPress={() => void addImages()} style={styles.addImages}><Text style={styles.addImagesText}>{addingImages ? t("Adding images…") : t("+ Add your images")}</Text></Pressable>
          </View>}
        </ScrollView> : <ScrollView contentContainerStyle={styles.settingsContent}>
          <View style={styles.preferenceGroup}>
            <View><Text style={styles.preferenceLabel}>{t("Color palette")}</Text><Text style={styles.imageHelp}>{t("Choose a coordinated set of colors for the app.")}</Text></View>
            <View>{backgrounds.map(value => <Pressable key={value} accessibilityRole="radio" accessibilityLabel={`${t(backgroundLabels[value])} ${appLanguage === 'hi' ? 'रंग योजना' : 'palette'}`} accessibilityState={{checked:colorTheme===value}} aria-checked={colorTheme===value} onPress={() => {setColorTheme(value); savePreference('color-theme',value); if (background !== 'images') {setBackground(value); savePreference('background',value);}}} style={styles.choiceRow}>
              <Text style={styles.paletteName}>{t(backgroundLabels[value])}</Text><View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.paletteSwatches}><View style={[styles.paletteSwatch,{backgroundColor:palettes[value].accent}]}/><View style={[styles.paletteSwatch,{backgroundColor:palettes[value].paper}]}/><View style={[styles.paletteSwatch,{backgroundColor:palettes[value].white}]}/></View><Text style={styles.choiceCheck} accessible={false}>{colorTheme===value ? '✓' : ''}</Text>
            </Pressable>)}</View>
          </View>
          <View style={styles.preferenceGroup}><Text style={styles.preferenceLabel}>{t("How the colors are used")}</Text><View style={styles.colorHints}>
            <Text style={styles.colorHint}><Text style={styles.colorHintStrong}>{t("Primary")}</Text> {t("· Buttons, icons and highlights.")}</Text>
            <Text style={styles.colorHint}><Text style={styles.colorHintStrong}>{t("Secondary")}</Text> {t("· The main app and reading background.")}</Text>
            <Text style={styles.colorHint}><Text style={styles.colorHintStrong}>{t("Tertiary")}</Text> {t("· Menus, controls and other surfaces.")}</Text>
          </View></View>
        </ScrollView>}
      </SafeAreaView></SafeAreaProvider>
    </Modal>
    <Modal visible={dictionaryWord !== null} transparent animationType="none" onShow={openDictionaryAnimation} onRequestClose={closeDictionary}>
      <View style={styles.dictionaryOverlay}>
        <Animated.View pointerEvents="none" style={[styles.dictionaryBackdrop, {opacity: dictionaryAnimation}]} />
        <Animated.View style={[styles.dictionarySheet, {transform: [{translateY: dictionaryAnimation.interpolate({inputRange:[0,1],outputRange:[height,0]})}]}]}>
        <View style={styles.settingsHeader}><Text accessibilityRole="header" style={styles.settingsTitle}>{dictionaryWord}</Text><Pressable accessibilityRole="button" accessibilityLabel={t("Close dictionary")} onPress={closeDictionary} style={styles.profileButton}><Text style={styles.closeIcon}>×</Text></Pressable></View>
        <ScrollView contentContainerStyle={styles.dictionaryContent}>
          {dictionaryStatus === 'prompt' && <><Text style={styles.dictionaryBody}>{t("Download the English dictionary once to look up words offline.")}</Text><Text style={styles.dictionaryMeta}>{t("About 10 MB")}</Text><Pressable accessibilityRole="button" onPress={() => dictionaryWord && void showWord(dictionaryWord, dictionaryLanguage, true)} style={[styles.button,styles.buttonPrimary,styles.doneButton]}><Text style={styles.selectedText}>{t("Download dictionary")}</Text></Pressable></>}
          {dictionaryStatus === 'loading' && <View style={styles.dictionaryLoading}><ActivityIndicator color={colors.accent}/><Text style={styles.dictionaryBody}>{dictionaryDownload !== null ? `${t("Downloading dictionary ·")} ${Math.round(dictionaryDownload*100)}%` : t("Looking up word…")}</Text></View>}
          {dictionaryStatus === 'unsupported' && <Text style={styles.dictionaryBody}>{Platform.OS === 'web' ? t("Dictionary lookup is available in the mobile app.") : dictionaryLanguage === 'hi' ? t("Hindi dictionary lookup is not available yet.") : t("Sanskrit dictionary lookup is not available yet.")}</Text>}
          {dictionaryStatus === 'error' && <><Text style={styles.dictionaryBody}>{dictionaryError}</Text><Pressable accessibilityRole="button" onPress={() => dictionaryWord && void showWord(dictionaryWord, dictionaryLanguage, true)} style={[styles.button,styles.buttonPrimary,styles.doneButton]}><Text style={styles.selectedText}>{t("Try again")}</Text></Pressable></>}
          {dictionaryStatus === 'results' && (meanings.length ? meanings.map(group => <View key={group.partOfSpeech} style={styles.dictionaryGroup}><Text style={styles.preferenceLabel}>{group.partOfSpeech}</Text>{group.definitions.map((definition, i) => <Text key={i} style={styles.dictionaryBody}>{i + 1}. {definition}</Text>)}</View>) : <Text style={styles.dictionaryBody}>{t("No definition found for this word.")}</Text>)}
        </ScrollView>
        </Animated.View>
      </View>
    </Modal>
    <Modal visible={editing !== null} transparent animationType="slide" onRequestClose={() => setEditing(null)}><View style={styles.overlay}><View style={styles.sheet}><Text style={styles.title}>{t("Add a note")}</Text><TextInput accessibilityLabel={t("Your note")} multiline value={note} onChangeText={setNote} placeholder={t("Write something…")} placeholderTextColor={colors.muted} style={styles.input}/><View style={styles.sheetActions}><Pressable onPress={() => setEditing(null)} style={styles.button}><Text style={{color:colors.ink}}>{t("Close")}</Text></Pressable><Pressable onPress={() => void saveNote()} style={[styles.button, styles.buttonPrimary]}><Text style={{color: colors.onAccent, fontWeight:'600'}}>{t("Save note")}</Text></Pressable></View></View></View></Modal>
  </SafeAreaView>;
}
const createStyles = (colors: Palette) => StyleSheet.create({root:{flex:1,backgroundColor:colors.paper},loading:{flex:1,justifyContent:'center',backgroundColor:colors.paper},downloadBanner:{minHeight:48,flexDirection:"row",alignItems:"center",paddingHorizontal:20,gap:12,backgroundColor:colors.white},downloadBannerText:{flex:1,color:colors.ink,fontSize:14},downloadCancel:{color:colors.accent,fontSize:14,fontWeight:"600"},header:{paddingHorizontal:16,paddingTop:8,paddingBottom:8,flexDirection:'row',justifyContent:'space-between',alignItems:'center',borderBottomWidth:1,borderColor:colors.line},language:{paddingVertical:10,paddingHorizontal:14,backgroundColor:colors.white,borderRadius:24},languageText:{fontWeight:'600',color:colors.ink},readerBack:{fontSize:34,lineHeight:40,color:colors.ink},playbackStatus:{minHeight:30,alignItems:"center",justifyContent:"center",paddingBottom:6},readerMenuOverlay:{position:"absolute",top:0,right:0,bottom:0,left:0,justifyContent:"flex-end",zIndex:10},readerMenuBackdrop:{position:"absolute",top:0,right:0,bottom:0,left:0,backgroundColor:"#0007"},readerMenuTitle:{fontFamily:"serif",fontSize:22,color:colors.ink,marginBottom:8},readerMenuItem:{flex:1,fontSize:16,fontWeight:"600",color:colors.ink},profileButton:{width:44,height:44,borderRadius:22,alignItems:'center',justifyContent:'center'},profileGlyph:{width:24,height:24,transform:[{scale:0.85}]},profileHead:{position:'absolute',top:1,left:8,width:8,height:8,borderWidth:1.5,borderColor:colors.ink,borderRadius:4},profileShoulders:{position:'absolute',bottom:2,left:3,width:18,height:10,borderWidth:1.5,borderColor:colors.ink,borderTopLeftRadius:10,borderTopRightRadius:10,borderBottomWidth:0},settingsScreen:{flex:1,backgroundColor:colors.paper},settingsNavigationHeader:{minHeight:64,flexDirection:'row',alignItems:'center',paddingHorizontal:16,borderBottomWidth:1,borderColor:colors.line},settingsBackButton:{width:44,height:48,alignItems:'center',justifyContent:'center',marginRight:8},settingsNavigationTitle:{flex:1,fontSize:20,fontWeight:'600',color:colors.ink},settingsList:{paddingHorizontal:24,paddingTop:16,paddingBottom:32},settingsCredits:{paddingTop:24,paddingBottom:16,gap:8},settingsCreditText:{fontSize:13,lineHeight:20,color:colors.muted},settingsCreditLink:{fontSize:13,lineHeight:20,color:colors.accent,textDecorationLine:"underline",alignSelf:"flex-start"},settingsListRow:{minHeight:80,flexDirection:'row',alignItems:'center',gap:16,paddingVertical:18,borderBottomWidth:1,borderColor:colors.line},choiceRow:{minHeight:68,flexDirection:'row',alignItems:'center',gap:16,paddingVertical:14,borderBottomWidth:1,borderColor:colors.line},choiceCheck:{fontSize:20,fontWeight:'600',color:colors.accent,minWidth:24,textAlign:'center'},paletteName:{flex:1,fontSize:16,color:colors.ink},paletteSwatches:{flexDirection:'row',gap:6},paletteSwatch:{width:24,height:24,borderRadius:12,borderWidth:1,borderColor:colors.line},colorHints:{gap:10},colorHint:{fontSize:14,lineHeight:21,color:colors.muted},colorHintStrong:{fontWeight:'600',color:colors.ink},settingsHeader:{flexDirection:'row',alignItems:'center',paddingHorizontal:20,paddingVertical:16,borderBottomWidth:1,borderColor:colors.line},settingsTitle:{flex:1,fontFamily:'serif',fontSize:24,color:colors.ink},backIcon:{fontSize:32,color:colors.ink,lineHeight:36},closeIcon:{fontSize:28,color:colors.muted},settingsMenu:{padding:24},settingsMenuRow:{minHeight:80,flexDirection:'row',alignItems:'center',gap:16,padding:20,borderRadius:16,backgroundColor:colors.white},settingsMenuText:{flex:1,gap:6},settingsMenuTitle:{fontSize:16,fontWeight:'600',color:colors.ink},settingsMenuDescription:{fontSize:14,color:colors.muted},settingsChevron:{fontSize:28,color:colors.muted},settingsContent:{gap:32,padding:24},preferenceGroup:{gap:16},preferenceLabel:{fontSize:14,fontWeight:'600',color:colors.ink},sizeOptions:{flexDirection:'row',gap:8},sizeOption:{flex:1,minHeight:88,borderRadius:12,backgroundColor:colors.paper,padding:12,alignItems:'center',justifyContent:'center',gap:8},selectedOption:{backgroundColor:colors.accent},selectedText:{color:colors.onAccent,fontWeight:'600'},sizeSample:{color:colors.ink},optionLabel:{fontSize:13,color:colors.muted},backgroundOption:{flex:1,alignItems:'center',gap:8,minHeight:72},imageSwatch:{overflow:'hidden',backgroundColor:colors.ink},swatchImage:{position:'absolute',width:'100%',height:'100%'},swatchCheck:{color:'#fff',fontSize:20,textShadowColor:'#000',textShadowRadius:4},imagePreview:{height:136,borderRadius:14,overflow:'hidden',justifyContent:'center',alignItems:'center',backgroundColor:'#181818'},imagePreviewText:{fontFamily:'serif',fontSize:20,color:'#fff'},blurHeading:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},blurSlider:{width:'100%',height:44,marginTop:8},blurLabels:{flexDirection:'row',justifyContent:'space-between'},imageHelp:{fontSize:13,lineHeight:20,color:colors.muted,marginTop:6},imageGrid:{flexDirection:'row',flexWrap:'wrap',gap:10},imageOption:{width:72,height:92,borderRadius:12,overflow:'hidden',borderWidth:2,borderColor:'transparent'},imageOptionSelected:{borderColor:colors.accent},imageThumbnail:{width:'100%',height:'100%'},imageCheck:{position:'absolute',right:4,top:4,width:22,height:22,borderRadius:11,backgroundColor:colors.accent,alignItems:'center',justifyContent:'center'},imageCheckText:{color:colors.onAccent,fontSize:14,fontWeight:'700'},addImages:{alignSelf:'flex-start',paddingVertical:10,paddingHorizontal:16,borderRadius:20,backgroundColor:colors.white},addImagesText:{color:colors.accent,fontWeight:'600'},swatch:{width:48,height:48,borderRadius:24,borderWidth:2,alignItems:'center',justifyContent:'center'},doneButton:{alignItems:'center'},main:{flex:1},fixedBackground:{position:'absolute',top:0,right:0,bottom:0,left:0,overflow:'hidden',backgroundColor:'#181818'},backgroundImage:{width:'100%',height:'100%'},filteredBackgroundImage:{position:'absolute',width:'100%',height:'100%'},backgroundScrim:{position:'absolute',top:0,right:0,bottom:0,left:0,backgroundColor:'rgba(0,0,0,0.64)'},transparentPage:{backgroundColor:'transparent'},imagePassage:{color:'#ffffff'},imageReference:{color:'#ffffff'},page:{backgroundColor:colors.paper,paddingHorizontal:28,paddingTop:24,paddingBottom:24},eyebrow:{fontSize:10,fontWeight:'700',letterSpacing:1.6,color:colors.accent},reading:{flex:1},readingContent:{flexGrow:1,justifyContent:'center',paddingVertical:24},passage:{fontSize:26,lineHeight:39,color:colors.ink,fontFamily:'serif',textAlign:'center'},selectionTools:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:8,marginTop:24},selectionButton:{paddingHorizontal:14,paddingVertical:10,borderRadius:20,backgroundColor:colors.white},selectionButtonText:{fontSize:14,fontWeight:'600',color:colors.accent},selectionHint:{fontSize:12,color:colors.muted,flexBasis:'100%',marginTop:2},referenceGroup:{alignItems:'flex-start',gap:12,flex:1},lookupButton:{maxWidth:'100%',paddingHorizontal:16,paddingVertical:10,borderRadius:20,backgroundColor:colors.white},lookupText:{fontSize:14,fontWeight:'600',color:colors.accent},reference:{fontSize:14,color:colors.muted},pageBottom:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:16},actions:{flexDirection:'column',gap:8},hiddenActions:{opacity:0},action:{width:44,height:44,borderRadius:22,backgroundColor:colors.white,alignItems:'center',justifyContent:'center'},heart:{fontSize:22,color:colors.accent},noteIcon:{fontSize:20,color:colors.ink},section:{flex:1,paddingHorizontal:28,paddingTop:12},title:{fontFamily:'serif',fontSize:32,color:colors.ink,marginTop:8,marginBottom:24},row:{paddingVertical:20,borderBottomWidth:1,borderColor:colors.line,flexDirection:'row',alignItems:'center',gap:16},rowLabel:{fontSize:10,letterSpacing:1,color:colors.accent,fontWeight:'700'},rowTitle:{fontSize:18,lineHeight:26,color:colors.ink,marginTop:8,fontFamily:'serif'},bookRow:{minHeight:148,paddingVertical:16,borderBottomWidth:1,borderColor:colors.line,flexDirection:"row",alignItems:"center",gap:18},bookCover:{width:76,height:114,borderRadius:5,backgroundColor:colors.line},bookTitle:{fontSize:19,lineHeight:26,color:colors.ink,fontFamily:"serif"},bookDetail:{fontSize:13,lineHeight:20,color:colors.muted,marginTop:6},chapterProgress:{marginTop:16,gap:8},progressLabels:{flexDirection:'row',justifyContent:'space-between',gap:8},progressText:{fontSize:13,color:colors.muted},progressTrack:{height:4,borderRadius:2,backgroundColor:colors.line,overflow:'hidden'},progressFill:{height:'100%',borderRadius:2,backgroundColor:colors.accent},arrow:{fontSize:22,color:colors.muted},empty:{color:colors.muted,lineHeight:24,marginTop:24},nav:{flexDirection:'row',borderTopWidth:1,borderColor:colors.line,backgroundColor:colors.white,paddingVertical:12},navItem:{flex:1,alignItems:'center',padding:8},navText:{fontSize:13,color:colors.muted},navActive:{color:colors.accent,fontWeight:'700'},dot:{width:4,height:4,borderRadius:2,marginTop:6},dotActive:{backgroundColor:colors.accent},overlay:{flex:1,backgroundColor:'#0007',justifyContent:'flex-end'},dictionaryOverlay:{flex:1,justifyContent:'flex-end'},dictionaryBackdrop:{position:'absolute',top:0,right:0,bottom:0,left:0,backgroundColor:'#0007'},dictionarySheet:{backgroundColor:colors.white,borderTopLeftRadius:24,borderTopRightRadius:24,paddingHorizontal:24,paddingBottom:32,maxHeight:'75%'},dictionaryContent:{gap:20,paddingTop:8,paddingBottom:16},dictionaryLoading:{flexDirection:'row',alignItems:'center',gap:12},dictionaryGroup:{gap:10},dictionaryBody:{fontSize:16,lineHeight:24,color:colors.ink},dictionaryMeta:{fontSize:13,lineHeight:20,color:colors.muted},dictionaryLink:{fontSize:14,color:colors.accent,fontWeight:'600'},sheet:{backgroundColor:colors.white,borderTopLeftRadius:24,borderTopRightRadius:24,padding:24},input:{minHeight:120,textAlignVertical:'top',backgroundColor:colors.paper,borderRadius:12,padding:16,color:colors.ink,fontSize:16},sheetActions:{flexDirection:'row',justifyContent:'flex-end',gap:12,marginTop:16},button:{paddingVertical:12,paddingHorizontal:18,borderRadius:20},buttonPrimary:{backgroundColor:colors.accent}});
