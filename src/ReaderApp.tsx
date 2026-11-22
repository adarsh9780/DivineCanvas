import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Alert, Animated, AppState, Easing, FlatList, Image, LayoutAnimation, Linking, NativeModules, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View, useWindowDimensions, type GestureResponderEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SQLite from 'expo-sqlite';
import { useAudioPlaylist, useAudioPlaylistStatus, type AudioSource } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Directory, File, Paths } from 'expo-file-system';
import { gitaImages } from './bookBackgrounds';
import { MenuView } from '@expo/ui/community/menu';
import { BottomSheet, Column, Host, ListItem, RNHostView } from '@expo/ui';
import { accessibilityValue as swiftAccessibilityValue, padding as swiftPadding } from '@expo/ui/swift-ui/modifiers';
import { semantics as composeSemantics } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { SafeAreaView as TabSafeAreaView } from 'react-native-screens/experimental';
import { MIGRATE_NOTES_SQL } from './verseAnnotations';
import { PRASHNAVALI_WALKTHROUGH_KEY, READER_WALKTHROUGH_KEY, readerWalkthroughSeen } from './readerWalkthrough';
import { chapterBackground, chapterImageKey, parseChapterImageOverrides, parseBookImageSeeds, shuffledBookSeed, clearBookImageOverrides, type BookImageSeeds, type ChapterImageOverrides } from './chapterBackgrounds';
import Svg, { Circle, Path } from 'react-native-svg';
import { FilterImage } from 'react-native-svg/filter-image';
import type { Filters } from 'react-native-svg/filter-image';
import Slider from '@react-native-community/slider';
import { StatusBar } from 'expo-status-bar';
import { usePathname, useRouter } from 'expo-router';
import { ReaderSectionsContext, type SettingsPage } from './ReaderSections';
import { sharePassageImage } from './shareImage';
import { DEFAULT_MUSIC_ID, MUSIC_TRACKS, downloadMusic, musicDownloaded, musicUri, removeMusic, removeRetiredMusic, type MusicTrack } from './musicLibrary';
import { moveAvailableMusic, musicDropTarget, normalizeMusicOrder, shuffleSelectedMusic, toggleShuffleExclusion } from './musicQueue';
import { MusicReorderRow } from './MusicReorderRow';
import { ChapterScrubber } from './ChapterScrubber';
import { MusicPreview } from './MusicPreview';
import { speechEngines, defaultSpeechEngineId } from './speech';
import type { SpeechEngine } from './speech/engine';
import { configureReadingAudio, setReadingMusicVolume, shouldPlayReadingMusic, PassageAudioQueue } from './readingAudioSession';
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
import { CHAPTER_POSITION_PREFIX, chapterPositionPrefix, chapterPositionKey, bookPositionKey, chapterResumeIndex, chapterBounds, chapterReadingProgress, legacyGitaPositionCopies, SAVE_POSITION_SQL } from './readingProgress';

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

function ReaderBottomArea({children, paddingBottom}: React.PropsWithChildren<{paddingBottom:number}>) {
  if (Platform.OS === 'android') return <View style={{flex:0,paddingBottom}}>{children}</View>;
  return <TabSafeAreaView edges={{bottom:true}} style={{flex:0,paddingBottom}}>{children}</TabSafeAreaView>;
}

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


export default function ReaderProvider({children}:{children:React.ReactNode}) {
  const {appLanguage, setAppLanguage, t} = useAppLanguage();
  const router = useRouter();
  const pathname = usePathname();
  const isBooksActive = pathname==='/' || pathname==='/reader';
  const insets = useSafeAreaInsets();
  const { height, width, fontScale } = useWindowDimensions();
  const isWideIPad = Platform.OS === 'ios' && Platform.isPad && width >= 700;
  const list = useRef<FlatList<Passage>>(null);
  const pendingChapterJump = useRef<number|null>(null);
  const db = useRef<SQLite.SQLiteDatabase | null>(null);
  const [ready, setReady] = useState(false);
  const [walkthroughSeen,setWalkthroughSeen] = useState(false);
  const [walkthroughVisible,setWalkthroughVisible] = useState(false);
  const [walkthroughSheetOpen,setWalkthroughSheetOpen] = useState(false);
  const [walkthroughSaving,setWalkthroughSaving] = useState(false);
  const readerView = useRef<React.ComponentRef<typeof View>>(null);
  const sharing = useRef(false);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [splitSettingsStack, setSplitSettingsStack] = useState<SettingsPage[]>(['language']);
  function openSettingsPage(page:Exclude<SettingsPage,'menu'>) {
    if (isWideIPad) {
      setSplitSettingsStack(current => pathname.startsWith('/settings') ? [...current,page] : ['reading',page]);
      if (!pathname.startsWith('/settings')) router.navigate('/settings');
    } else router.push({pathname:'/settings/[page]',params:{page}});
  }
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
  const [defaultImmersive, setDefaultImmersive] = useState(false);
  function changeImmersive(value:boolean) {if (value===immersive) return; LayoutAnimation.easeInEaseOut(); setImmersive(value);}
  const [pinching, setPinching] = useState(false);
  const pinch = useRef<{distance:number; triggered:boolean}|null>(null);
  function pinchDistance(event:GestureResponderEvent) {const touches=event.nativeEvent.touches; return touches.length===2 ? Math.hypot(touches[0].pageX-touches[1].pageX,touches[0].pageY-touches[1].pageY) : null;}
  function startPinch(event:GestureResponderEvent) {
    if (screen!=='read' || !isBooksActive || readerMenuOpen || dictionaryWord!==null) return;
    const distance=pinchDistance(event); if (distance===null || distance<20) return;
    pinch.current={distance,triggered:false}; setPinching(true); touchStart.current=null;
  }
  function movePinch(event:GestureResponderEvent) {
    const gesture=pinch.current, distance=pinchDistance(event);
    if (!gesture || gesture.triggered || distance===null) return;
    if (distance-gesture.distance > Math.max(35,gesture.distance*0.25)) {gesture.triggered=true; changeImmersive(true);}
    else if (gesture.distance-distance > Math.max(35,gesture.distance*0.25)) {gesture.triggered=true; changeImmersive(false);}
  }
  function finishPinch(event:GestureResponderEvent) {if (event.nativeEvent.touches.length<2) {pinch.current=null; setPinching(false);}}
  const [readerMenuOpen, setReaderMenuOpen] = useState(false);
  const savedFromReaderMenu = useRef(false);
  const activateBookScreen = useCallback((next:Screen) => {setScreen(next); if (next === 'books') setImmersive(false); if (next === 'read' && savedFromReaderMenu.current) {savedFromReaderMenu.current=false; setReaderMenuOpen(true);}}, [setReaderMenuOpen]);
  const settingsScrollPositions = useRef<Record<string,number>>({});
  function settingsScrollProps(page:string) {return {contentOffset:{x:0,y:settingsScrollPositions.current[page] ?? 0},scrollEventThrottle:16,onScroll:(event:NativeSyntheticEvent<NativeScrollEvent>) => {settingsScrollPositions.current[page]=Math.max(0,event.nativeEvent.contentOffset.y);}};}
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
  const [backgroundReadingAudio, setBackgroundReadingAudio] = useState(false);
  const [narrationOwnsControls, setNarrationOwnsControls] = useState(false);
  const [remoteReadingPaused, setRemoteReadingPaused] = useState(false);

  const currentIndex = useRef(0);
  const [touchingReader, setTouchingReader] = useState(false);
  const [chapterScrubbing,setChapterScrubbing] = useState(false);
  const [languageControlWidth,setLanguageControlWidth] = useState(110);
  const [webAudioMenuOpen,setWebAudioMenuOpen] = useState(false);
  const [interactionCount, setInteractionCount] = useState(0);
  const continuationNavigator = useRef<{advance:()=>boolean; hasMore:()=>boolean} | null>(null);
  const [continuationPending, setContinuationPending] = useState(false);
  const registerContinuation = useCallback((navigator:{advance:()=>boolean; hasMore:()=>boolean}|null) => {continuationNavigator.current=navigator; setContinuationPending(!!navigator?.hasMore());}, []);
  const onContinuationChange = useCallback(() => {setContinuationPending(!!continuationNavigator.current?.hasMore()); setInteractionCount(value => value+1);}, [setInteractionCount]);
  const speechEngine = useRef<SpeechEngine | null>(null);
  const speechWork = useRef<Promise<unknown>>(Promise.resolve());
  const narrationQueue = useRef<{
    queue: PassageAudioQueue;
    bookId: string;
    background: boolean;
    language: 'en' | 'hi' | 'sa';
  } | null>(null);
  const speechDownloadAbort = useRef<AbortController | null>(null);
  const [voiceInstalled, setVoiceInstalled] = useState(() => Platform.OS !== 'web' && isParadeeInstalled());
  const [voiceDownload, setVoiceDownload] = useState<number | null>(null);
  const [pendingVoiceStart, setPendingVoiceStart] = useState<{bookId:string; passageId:string; language:'en'|'hi'|'sa'} | null>(null);
  const [dictionaryInstalled, setDictionaryInstalled] = useState(() => dictionaryAvailable());
  const [dictionaryDownload, setDictionaryDownload] = useState<number | null>(null);
  const [narrating, setNarrating] = useState(false);
  const narrationPlayer = useAudioPlaylist({ updateInterval: 250 });
  const runtimeAvailable = Platform.OS !== 'web' && !!NativeModules.Onnxruntime;
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [musicVolume, setMusicVolume] = useState(0.2);
  const [musicOrder,setMusicOrder] = useState<string[]>(() => MUSIC_TRACKS.map(track => track.id));
  const [musicExcluded,setMusicExcluded] = useState<string[]>([]);
  const [downloadedMusic,setDownloadedMusic] = useState<Record<string,boolean>>(() => Object.fromEntries(MUSIC_TRACKS.map(track => [track.id,musicDownloaded(track)])));
  const [musicDownloads,setMusicDownloads] = useState<Record<string,number>>({});
  const [musicDragging,setMusicDragging] = useState(false);
  const previewScope=`${pathname}:${isWideIPad ? splitSettingsStack.join('/') : ''}`;
  const [previewState,setPreviewState] = useState<{id:string;scope:string} | null>(null);
  const previewMusic=previewState?.scope===previewScope ? previewState.id : null;
  const setPreviewMusic=(id:string | null) => setPreviewState(id ? {id,scope:previewScope} : null);
  const musicRowLayouts=useRef<Record<string,{y:number;height:number}>>({});
  const [currentMusic,setCurrentMusic] = useState(DEFAULT_MUSIC_ID);
  const musicQueue = useMemo(() => musicOrder.filter(id => downloadedMusic[id]),[musicOrder,downloadedMusic]);
  const playableMusic = useMemo(() => musicQueue.filter(id => !musicExcluded.includes(id)),[musicQueue,musicExcluded]);
  const [appActive, setAppActive] = useState(AppState.currentState == null || AppState.currentState === 'active');
  const backgroundPlaybackAvailable = Platform.OS !== 'web' &&
    typeof narrationPlayer.setRemotePlaybackCompanion === 'function' &&
    typeof narrationPlayer.resetRemoteTransport === 'function';
  const nativeBackgroundAudio = backgroundPlaybackAvailable && backgroundReadingAudio;
  const readingAudioAllowed = appActive || nativeBackgroundAudio;
  const readingOpen = screen === 'read' && pathname === '/reader';
  const musicEntries = useMemo(() => playableMusic.flatMap(id => {
    const track = MUSIC_TRACKS.find(item => item.id === id);
    if (!track) return [];
    if (id === DEFAULT_MUSIC_ID) {
      return [{ track, source: { assetId: require('../assets/audio/krishna-flute.mp3'), name: track.title } as AudioSource }];
    }
    const uri = musicUri(track);
    return uri ? [{ track, source: { uri, name: track.title } as AudioSource }] : [];
  }), [playableMusic]);
  const musicPlayer = useAudioPlaylist({ sources: musicEntries.map(entry => entry.source), loop: 'all' });
  const reportedMusicStatus = useAudioPlaylistStatus(musicPlayer);
  const musicStatus = reportedMusicStatus.id === musicPlayer.id ? reportedMusicStatus : musicPlayer.currentStatus;
  const [musicError, setMusicError] = useState(false);
  const [musicAttempt, setMusicAttempt] = useState(0);
  const musicCanFollowNarration = nativeBackgroundAudio && narrationOwnsControls;
  const musicAllowed = shouldPlayReadingMusic(readingOpen, appActive, musicCanFollowNarration && readAloud, remoteReadingPaused);
  const waitingForMusic = ready && musicEnabled && appActive && musicAllowed && !!musicEntries.length && !musicStatus.isLoaded && !musicError;
  const musicFailed = musicError;

  useEffect(() => {
    if (!waitingForMusic) return;
    const timer = setTimeout(() => setMusicError(true), 60_000);
    return () => clearTimeout(timer);
  }, [waitingForMusic, musicAttempt, musicPlayer]);

  function retryMusic() {
    const uri = musicEntries.find(entry => entry.track.id === currentMusic);
    if (currentMusic !== DEFAULT_MUSIC_ID && !uri) {
      setDownloadedMusic(current => ({ ...current, [currentMusic]: false }));
      setCurrentMusic(DEFAULT_MUSIC_ID);
      Alert.alert(appLanguage === 'hi' ? 'गीत उपलब्ध नहीं है' : 'Track unavailable', appLanguage === 'hi' ? 'कृपया इसे फिर से डाउनलोड करें।' : 'Please download it again.');
      return;
    }
    setMusicError(false);
    musicPlayer.skipTo(Math.max(0, musicPlayer.currentIndex));
    setMusicAttempt(attempt => attempt + 1);
  }

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => setAppActive(state === 'active'));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!nativeBackgroundAudio) return;
    narrationPlayer.setRemotePlaybackCompanion(musicEnabled && readingOpen && musicEntries.length && !musicError ? musicPlayer : null);
    return () => narrationPlayer.setRemotePlaybackCompanion(null);
  }, [narrationPlayer, musicPlayer, musicEnabled, nativeBackgroundAudio, readingOpen, musicEntries.length, musicError]);

  useEffect(() => {
    setReadingMusicVolume(musicPlayer, narrating ? musicVolume * 0.5 : musicVolume);
  }, [musicPlayer, musicVolume, narrating]);

  useEffect(() => {
    const index = musicEntries.findIndex(entry => entry.track.id === currentMusic);
    if (index > -1 && index !== musicPlayer.currentIndex) musicPlayer.skipTo(index);
  }, [musicEntries, musicPlayer, currentMusic]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const status = musicPlayer.addListener('playlistStatusUpdate', event => {
      if ('error' in event && event.error) setMusicError(true);
    });
    const tracks = musicPlayer.addListener('trackChanged', () => {
      const entry = musicEntries[musicPlayer.currentIndex];
      if (readingOpen && entry) setCurrentMusic(entry.track.id);
    });
    return () => { status.remove(); tracks.remove(); };
  }, [musicPlayer, musicEntries, readingOpen]);

  useEffect(() => {
    if (!ready || !musicEnabled || !musicAllowed || !musicEntries.length || musicFailed) {
      musicPlayer.pause();
      return;
    }
    let cancelled = false;
    // Let narration finish configuring the shared session when it is starting or owns the lock screen.
    const narrationManagesAudio = musicCanFollowNarration || (nativeBackgroundAudio && readAloudRef.current);
    const audioReady = narrationManagesAudio ? Promise.resolve() : configureReadingAudio(false);
    void audioReady.then(() => {
      if (cancelled) return;
      const state = AppState.currentState;
      if (!shouldPlayReadingMusic(
        readingOpen, state == null || state === 'active', musicCanFollowNarration && readAloudRef.current,
        narrationPlayer.remoteTransportPaused === true,
      )) return;
      if (!musicPlayer.playing) musicPlayer.play();
    }).catch(error => {
      if (!cancelled) {
        console.warn('Unable to start reading music:', error);
        setMusicError(true);
      }
    });
    return () => { cancelled = true; };
  }, [musicPlayer, narrationPlayer, ready, musicEnabled, musicAllowed, readingOpen, musicCanFollowNarration, nativeBackgroundAudio, musicEntries.length, musicFailed, musicAttempt]);

  const [saved, setSaved] = useState<Saved>({});
  const [notes, setNotes] = useState<Record<string,string>>({});
  const pendingLikes = useRef(new Set<string>());
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
  useEffect(() => {
    if (!walkthroughVisible || walkthroughSeen || screen !== 'read' || pathname !== '/reader' || !textReady) return;
    // Let the reader and its navigation transition become visible before the guide appears.
    const timer=setTimeout(() => setWalkthroughSheetOpen(true), 700);
    return () => clearTimeout(timer);
  },[walkthroughVisible,walkthroughSeen,screen,pathname,textReady]);
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
    const ids = [...new Set([...Object.keys(saved),...Object.keys(notes)])].filter(id => id.startsWith(activeBookId + ':'));
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
  }, [screen, activeBookId, saved, notes, installedBooks, getTextDb]);

  const [language, setLanguage] = useState<'en' | 'hi' | 'sa'>('hi');
  const [positionsByBook, setPositionsByBook] = useState<Record<string, Record<number, string>>>({});
  const [lastByBook, setLastByBook] = useState<Record<string, string>>({});
  const chapterPositions = positionsByBook[activeBook.id] ?? EMPTY_CHAPTER_POSITIONS;
  const positionWrites = useRef<Promise<void>>(Promise.resolve());
  const [editing, setEditing] = useState<string | null>(null);
  const activeSelection = useRef<{passageId:string; language:'en'|'hi'|'sa'; start:number; end:number; anchorStart:number; anchorEnd:number} | null>(null);
  const previousWordTap = useRef<Tap | null>(null);
  const passageTapStart = useRef<{x:number;y:number;time:number;passageId:string}|null>(null);
  const ignorePassageTap = useRef(false);
  const pendingLanguageTap = useRef<{tap:Tap; timer:ReturnType<typeof setTimeout>}|null>(null);
  useEffect(() => () => {
    if (pendingLanguageTap.current) clearTimeout(pendingLanguageTap.current.timer);
    pendingLanguageTap.current=null;
    passageTapStart.current=null;
    ignorePassageTap.current=false;
  }, [screen, index, language, activeBookId, isBooksActive]);
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
  const [readerHeight, setReaderHeight] = useState(Math.max(200, height - 180));

  useEffect(() => { (async () => {
    try {
      removeRetiredMusic();
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
      await database.execAsync(MIGRATE_NOTES_SQL);
      const rows = await database.getAllAsync<{id: string; note: string}>('SELECT id, note FROM saves');
      const noteRows = await database.getAllAsync<{id:string;note:string}>('SELECT id, note FROM verse_notes');
      setSaved(Object.fromEntries(rows.map(row => [row.id, row.note])));
      setNotes(Object.fromEntries(noteRows.map(row => [row.id,row.note])));
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
      const appearanceRows = await database.getAllAsync<{key: string; value: string}>("SELECT key, value FROM settings WHERE key IN ('background', 'font-size', 'gita-backgrounds', 'chapter-background-overrides', 'chapter-background-seeds', 'reader-walkthrough-seen', 'default-fullscreen', 'color-theme', 'image-tone', 'image-blur', 'music-enabled', 'music-volume', 'music-order', 'music-excluded', 'music-current', 'background-reading-audio', 'auto-scroll-enabled', 'auto-scroll-seconds')");
      const values = Object.fromEntries(appearanceRows.map(row => [row.key, row.value]));
      setWalkthroughSeen(readerWalkthroughSeen(values[READER_WALKTHROUGH_KEY]));
      setDefaultImmersive(values['default-fullscreen'] === 'true');
      if (values['auto-scroll-enabled'] === 'true') setAutoScrollEnabled(true);
      const savedScrollSeconds = Number(values['auto-scroll-seconds']);
      if (Number.isInteger(savedScrollSeconds) && savedScrollSeconds >= 5 && savedScrollSeconds <= 60) setAutoScrollSeconds(savedScrollSeconds);
      setBackgroundReadingAudio(values['background-reading-audio'] === 'true');
      if (values['music-enabled'] === 'false') setMusicEnabled(false);
      let savedOrder=MUSIC_TRACKS.map(track => track.id);
      try {savedOrder=normalizeMusicOrder(values['music-order'] ? JSON.parse(values['music-order']) : null,savedOrder);} catch { /* Use the default order. */ }
      setMusicOrder(savedOrder);
      let excluded:string[]=[];
      try {const parsed:unknown=JSON.parse(values['music-excluded'] ?? '[]'); if (Array.isArray(parsed)) excluded=parsed.filter((id):id is string => typeof id==='string' && MUSIC_TRACKS.some(track => track.id===id));} catch { /* Include all tracks. */ }
      const available=savedOrder.filter(id => {const track=MUSIC_TRACKS.find(item => item.id===id); return !!track && musicDownloaded(track);});
      if (!available.some(id => !excluded.includes(id))) excluded=[];
      setMusicExcluded(excluded);
      const allowed=available.filter(id => !excluded.includes(id));
      const savedMusic=values['music-current'];
      if (savedMusic && allowed.includes(savedMusic)) setCurrentMusic(savedMusic);
      else if (allowed.length) setCurrentMusic(allowed[0]);
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
  async function installMusic(track:MusicTrack) {
    if (musicDownloads[track.id]!==undefined || musicDownloaded(track)) return;
    setMusicDownloads(current => ({...current,[track.id]:0}));
    try {
      await downloadMusic(track,progress => setMusicDownloads(current => ({...current,[track.id]:progress})));
      setDownloadedMusic(current => ({...current,[track.id]:true}));
    } catch (error) {Alert.alert(appLanguage==='hi'?'संगीत डाउनलोड नहीं हो सका':'Could not download music',error instanceof Error ? error.message : t('Please try again.'));}
    finally {setMusicDownloads(current => {const next={...current}; delete next[track.id]; return next;});}
  }
  function deleteMusic(track:MusicTrack) {
    try {
      if (previewMusic===track.id) setPreviewMusic(null);
      removeMusic(track);
      const nextExcluded=musicExcluded.filter(id => id!==track.id);
      const remaining=musicQueue.filter(id => id!==track.id && !nextExcluded.includes(id));
      if (!remaining.length) {
        const included=nextExcluded.filter(id => id!==DEFAULT_MUSIC_ID); setMusicExcluded(included); savePreference('music-excluded',JSON.stringify(included));
      } else if (nextExcluded.length!==musicExcluded.length) {setMusicExcluded(nextExcluded); savePreference('music-excluded',JSON.stringify(nextExcluded));}
      if (currentMusic===track.id) {const next=remaining[0] ?? DEFAULT_MUSIC_ID; setCurrentMusic(next); savePreference('music-current',next);}
      setDownloadedMusic(current => ({...current,[track.id]:false}));
    } catch {Alert.alert(appLanguage==='hi'?'संगीत हटाया नहीं जा सका':'Could not remove music',t('Please try again.'));}
  }
  function shuffleMusic() {
    const order = shuffleSelectedMusic(musicOrder, playableMusic);
    setMusicOrder(order);
    savePreference('music-order', JSON.stringify(order));
    const first = order.find(id => playableMusic.includes(id));
    if (first) {
      setMusicError(false);
      setCurrentMusic(first);
      savePreference('music-current', first);
    }
  }
  function selectMusic(track:MusicTrack) {
    const id=track.id;
    if (!musicDownloaded(track)) {setDownloadedMusic(current => ({...current,[id]:false})); Alert.alert(appLanguage==='hi'?'गीत उपलब्ध नहीं है':'Track unavailable',appLanguage==='hi'?'कृपया इसे फिर से डाउनलोड करें।':'Please download it again.'); return;}
    const next=toggleShuffleExclusion(musicExcluded,id,musicQueue);
    if (!next) {Alert.alert(appLanguage==='hi'?'एक गीत चुनें':'Keep one track',appLanguage==='hi'?'कम से कम एक गीत चुनें।':'Choose at least one track.'); return;}
    setMusicExcluded(next); savePreference('music-excluded',JSON.stringify(next));
    if (next.includes(currentMusic)) {const first=musicQueue.find(item => !next.includes(item)); if (first) {setMusicError(false); setCurrentMusic(first); savePreference('music-current',first);}}
  }
  const reorderMusicTo=useCallback((id:string,target:string) => {
    if (id===target) return;
    const next=moveAvailableMusic(musicOrder,musicQueue,id,target); setMusicOrder(next); savePreference('music-order',JSON.stringify(next));
    const title=MUSIC_TRACKS.find(track => track.id===id)?.title ?? id;
    AccessibilityInfo.announceForAccessibility(`${title}: ${appLanguage==='hi'?'क्रम':'position'} ${next.filter(item => musicQueue.includes(item)).indexOf(id)+1} / ${musicQueue.length}`);
  },[musicOrder,musicQueue,savePreference,appLanguage,setMusicOrder]);
  const reorderMusic=useCallback((id:string, direction:-1|1) => {
    const index=musicQueue.indexOf(id); const target=musicQueue[index+direction];
    if (target) reorderMusicTo(id,target);
  },[musicQueue,reorderMusicTo]);
  const dropMusic=useCallback((id:string,dy:number) => {
    const target=musicDropTarget(musicQueue,musicRowLayouts.current,id,dy);
    reorderMusicTo(id,target);
  },[musicQueue,reorderMusicTo]);
  async function finishWalkthrough() {
    if (walkthroughSeen || walkthroughSaving || !db.current) return;
    setWalkthroughSaving(true);
    try {
      await db.current.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',READER_WALKTHROUGH_KEY,'true');
      setWalkthroughSeen(true); setWalkthroughVisible(false); setWalkthroughSheetOpen(false);
    } catch {Alert.alert(appLanguage==='hi'?'सहेजा नहीं जा सका':'Could not save',appLanguage==='hi'?'कृपया फिर प्रयास करें।':'Please try again.');}
    finally {setWalkthroughSaving(false);}
  }
  async function resetWalkthrough(kind:'reader'|'prashnavali') {
    if (walkthroughSaving || !db.current) return;
    setWalkthroughSaving(true);
    try {
      await db.current.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',kind==='reader' ? READER_WALKTHROUGH_KEY : PRASHNAVALI_WALKTHROUGH_KEY,'false');
      if (kind==='reader') setWalkthroughSeen(false);
      Alert.alert(appLanguage==='hi'?'परिचय रीसेट हो गया':'Walkthrough reset',kind==='reader' ? (appLanguage==='hi'?'अगली बार पुस्तक खोलने पर परिचय दिखाई देगा।':'The walkthrough will appear the next time you open a book.') : (appLanguage==='hi'?'अगली बार प्रश्नावली खोलने पर परिचय दिखाई देगा।':'The walkthrough will appear the next time you open Prashnavali.'));
    } catch {Alert.alert(appLanguage==='hi'?'रीसेट नहीं हो सका':'Could not reset',appLanguage==='hi'?'कृपया फिर प्रयास करें।':'Please try again.');}
    finally {setWalkthroughSaving(false);}
  }
  function saveImagePreferences(selected: string[], uploaded: UploadedImage[], seed=imageSeed) {
    savePreference('gita-backgrounds', JSON.stringify({seed, selected, uploaded}));
  }
  function openChapterImages(origin:'reading'|null) {
    setPickerBookId(activeBook.id); setPickerChapter(passages[index]?.chapter ?? 1);
    setChapterSearch(''); setShuffleMessage(''); setImagePickerReturn(origin); setReaderMenuOpen(false); if (origin===null && !isWideIPad) router.navigate({pathname:'/settings/[page]',params:{page:'chapter-images'}}); else openSettingsPage('chapter-images');
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
  const closeSettingsPage = useCallback(() => {if (isWideIPad && pathname.startsWith('/settings') && splitSettingsStack.length > 1) setSplitSettingsStack(current => current.slice(0,-1)); else if (router.canGoBack()) router.back();},[isWideIPad,pathname,router,splitSettingsStack.length]);
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
    if (!db.current || pendingLikes.current.has(p.id)) return;
    pendingLikes.current.add(p.id);
    try {
      if (Object.hasOwn(saved, p.id)) {
        await db.current.runAsync('DELETE FROM saves WHERE id = ?', p.id);
        setSaved(current => {const next={...current}; delete next[p.id]; return next;});
      } else {
        await db.current.runAsync('INSERT OR IGNORE INTO saves (id, note) VALUES (?, ?)', p.id, '');
        setSaved(current => ({...current,[p.id]:''}));
      }
    } catch {Alert.alert(t("Could not save"),t("Please try again."));}
    finally {pendingLikes.current.delete(p.id);}
  }
  function openNote(id:string) {setEditing(id); router.push('/note-editor');}
  async function saveNote(note:string):Promise<boolean> {
    if (!editing || !db.current) return false;
    try {
      const id=editing;
      if (note.trim()) {
        await db.current.runAsync('INSERT OR REPLACE INTO verse_notes (id,note) VALUES (?,?)',id,note);
        setNotes(current => ({...current,[id]:note}));
      } else {
        await db.current.runAsync('DELETE FROM verse_notes WHERE id = ?',id);
        setNotes(current => {const next={...current}; delete next[id]; return next;});
      }
      return true;
    } catch {Alert.alert(t("Could not save"),t("Please try again.")); return false;}
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
  }, [activeBookId, setSelectedWord, setIndex, setPositionsByBook, setLastByBook, t]);
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
  function closeDictionary() { router.back(); }
  function clearDictionary() { dictionaryRequest.current++; setDictionaryWord(null); }
  function openBookInfo(book:Book) { setBookInfo(book); router.push('/book-info'); }
  async function showWord(word: string, lang: 'en' | 'hi' | 'sa', download = false) {
    if (dictionaryWord === null) router.push('/dictionary-sheet');
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
  const clearNarrationControls = useCallback(() => {
    narrationPlayer.clearLockScreenControls();
    narrationPlayer.resetRemoteTransport?.();
    setNarrationOwnsControls(false);
    setRemoteReadingPaused(false);
    void configureReadingAudio(false).catch(error => console.warn('Unable to restore foreground audio:', error));
  }, [narrationPlayer, setNarrationOwnsControls, setRemoteReadingPaused]);

  const stopNarration = useCallback(() => {
    const session = narrationQueue.current;
    narrationQueue.current = null;
    if (session?.background) clearNarrationControls();
    session?.queue.dispose();
    setNarrating(false);
  }, [clearNarrationControls, setNarrating]);

  const stopReadAloud = useCallback(() => {
    readAloudRef.current = false;
    setReadAloud(false);
    stopNarration();
  }, [stopNarration, setReadAloud]);

  useEffect(() => {
    const positions = narrationPlayer.addListener('trackChanged', () => {
      // Native insertion/removal can emit intermediate indices. Read the
      // actual current item after the command has finished.
      queueMicrotask(() => narrationQueue.current?.queue.syncPosition());
    });
    const status = narrationPlayer.addListener('playlistStatusUpdate', event => {
      if ('error' in event && event.error && narrationQueue.current) {
        console.warn('Could not play narration:', event.error);
        stopReadAloud();
      } else if (event.didJustFinish) {
        narrationQueue.current?.queue.finishTrack();
      }
    });
    const remote = backgroundPlaybackAvailable ? narrationPlayer.addListener('remotePlaybackUpdate', ({ playing }) => {
      if (!narrationQueue.current?.background) return;
      narrationQueue.current.queue.setRemotePlaying(playing);
      readAloudRef.current = playing;
      setReadAloud(playing);
      setNarrating(playing);
      setRemoteReadingPaused(!playing);
    }) : undefined;
    return () => { positions.remove(); status.remove(); remote?.remove(); };
  }, [backgroundPlaybackAvailable, narrationPlayer, stopReadAloud]);

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
  }, [getSpeechEngine, runtimeAvailable, t, setVoiceDownload, setVoiceInstalled, setPendingVoiceStart]);

  const requestVoice = useCallback((passage: Passage) => {
    if (!runtimeAvailable) {Alert.alert(t("Development build needed"), t("The offline voice requires an app build with the speech runtime. Expo Go cannot run it.")); return;}
    if (speechDownloadAbort.current) {Alert.alert(t("Download in progress"), t("The reading voice is already downloading.")); return;}
    Alert.alert(t("Download offline voice?"), t("Download the reading voice once (about 11 MB). It will work offline after installation."), [
      {text:t("Not now"), style:'cancel'},
      {text:t("Download"), onPress:() => {setPendingVoiceStart({bookId:activeBookId, passageId:passage.id, language}); void downloadVoice();}},
    ]);
  }, [activeBookId, downloadVoice, language, runtimeAvailable, t, setPendingVoiceStart]);

  function cancelVoiceDownload() {setPendingVoiceStart(null); speechDownloadAbort.current?.abort();}
  function deleteDictionary() {
    try {removeDictionary(); setDictionaryInstalled(false);}
    catch (error) {Alert.alert(t("Could not remove dictionary"), error instanceof Error ? error.message : t("Please try again."));}
  }
  async function installDictionaryFromSettings() {
    if (dictionaryDownload !== null || dictionaryInstalled) return;
    setDictionaryDownload(0);
    try { await downloadDictionary(setDictionaryDownload); setDictionaryInstalled(true); }
    catch { Alert.alert(t("Dictionary download failed"), appLanguage === 'hi' ? 'शब्दकोश डाउनलोड नहीं हो सका। इंटरनेट कनेक्शन जाँचें और कुछ देर बाद फिर प्रयास करें।' : 'The dictionary could not be downloaded. Check your internet connection and try again later.'); }
    finally { setDictionaryDownload(null); }
  }
  async function removeVoice() {
    try {stopReadAloud(); await speechWork.current; const engine=await getSpeechEngine(); await engine.uninstall(); setVoiceInstalled(false);}
    catch (error) {Alert.alert(t("Could not remove voice"), error instanceof Error ? error.message : t("Please try again."));}
  }
  const narrationAllowed = ready && readingOpen && readingAudioAllowed && !walkthroughVisible &&
    !readerMenuOpen && editing === null && dictionaryWord === null && sharingId === null;

  useEffect(() => {
    const session = narrationQueue.current;
    if (!session || (narrationAllowed && session.bookId === activeBookId && session.language === language && session.background === nativeBackgroundAudio &&
        session.queue.position === index)) return;
    const timer = setTimeout(() => {
      if (narrationQueue.current === session) stopNarration();
    }, 0);
    return () => clearTimeout(timer);
  }, [narrationAllowed, activeBookId, language, index, nativeBackgroundAudio, stopNarration]);

  useEffect(() => {
    if (!pendingVoiceStart || !voiceInstalled || voiceDownload !== null || !textReady || !narrationAllowed) return;
    const timer = setTimeout(() => {
      setPendingVoiceStart(null);
      if (activeBookId !== pendingVoiceStart.bookId || passages[index]?.id !== pendingVoiceStart.passageId || language !== pendingVoiceStart.language) return;
      if (autoScrollEnabled) {
        setAutoScrollEnabled(false);
        savePreference('auto-scroll-enabled', 'false');
      }
      readAloudRef.current = true;
      setReadAloud(true);
    }, 0);
    return () => clearTimeout(timer);
  }, [pendingVoiceStart, voiceInstalled, voiceDownload, textReady, narrationAllowed, activeBookId, passages, index, language, autoScrollEnabled, savePreference]);

  const narrationMetadata = useCallback((position: number) => {
    const passage = passages[position];
    const reference = activeBookId === GITA_BOOK_ID
      ? `${passage.chapter}.${passage.label.replace(/^TEXTS?\s+/i, '')}`
      : `${passage.chapterTitle} · ${passage.label}`;
    return { title: `${t(activeBook.title)} · ${reference}`, artist: 'DivineCanvas' };
  }, [passages, activeBookId, activeBook.title, t]);

  const prepareNarrationPlayback = useCallback(async (queue: PassageAudioQueue, background: boolean) => {
    if (narrationQueue.current?.queue !== queue || !readAloudRef.current) return false;
    await configureReadingAudio(background);
    if (narrationQueue.current?.queue !== queue || !readAloudRef.current) return false;
    const state = AppState.currentState;
    if (!background && state != null && state !== 'active') return false;
    if (background) {
      narrationPlayer.setActiveForLockScreen(true, narrationMetadata(currentIndex.current), {
        showPreviousTrack: true,
        showNextTrack: true,
      });
      setNarrationOwnsControls(true);
    }
    return true;
  }, [narrationPlayer, narrationMetadata, setNarrationOwnsControls]);

  useEffect(() => {
    if (!narrationAllowed || !readAloud || !textReady || !voiceInstalled || !runtimeAvailable) return;
    const timer = setTimeout(() => {
      if (narrationQueue.current || !readAloudRef.current) return;
      const queue: PassageAudioQueue = new PassageAudioQueue({
        player: narrationPlayer,
        start: index,
        count: passages.length,
        generate: (position, signal) => {
          const task = speechWork.current.then(async () => {
            if (signal.aborted) throw new Error('Speech cancelled.');
            const engine = await getSpeechEngine();
            const voice = engine.info.voices.find(candidate => candidate.languages.includes(language));
            if (!voice) throw new Error(t('No voice is available for this language.'));
            const database = await getTextDb(activeBookId);
            const row = await database.getFirstAsync<{en:string;hi:string;sa:string}>(
              'SELECT en, hi, sa FROM passages WHERE position = ?', position
            );
            if (signal.aborted) throw new Error('Speech cancelled.');
            if (!row?.[language]?.trim()) throw new Error(t('Could not read this passage'));
            return engine.synthesize({ text: row[language], language, voiceId: voice.id }, signal);
          });
          speechWork.current = task.catch(() => {});
          return task;
        },
        beforePlay: () => prepareNarrationPlayback(queue, nativeBackgroundAudio),
        onPosition: position => {
          // Save even if the reader view is unavailable while the phone is locked.
          rememberPosition(position);
          if (AppState.currentState === 'active') list.current?.scrollToIndex({ index: position, animated: false });
        },
        onFinish: stopReadAloud,
        onError: error => {
          stopReadAloud();
          console.warn('Could not read this passage:', error);
          if (AppState.currentState === 'active') Alert.alert(t('Could not read this passage'), error instanceof Error ? error.message : t('Please try again.'));
        },
      });
      narrationQueue.current = { queue, bookId: activeBookId, background: nativeBackgroundAudio, language };
      setNarrating(true);
      void queue.start();
    }, 0);
    return () => clearTimeout(timer);
  }, [narrationAllowed, readAloud, textReady, voiceInstalled, runtimeAvailable, index, passages.length, activeBookId, language, narrationPlayer, getSpeechEngine, getTextDb, nativeBackgroundAudio, prepareNarrationPlayback, rememberPosition, stopReadAloud, t]);

  useEffect(() => {
    if (!narrationOwnsControls || !nativeBackgroundAudio) return;
    narrationPlayer.updateLockScreenMetadata(narrationMetadata(index));
  }, [narrationOwnsControls, nativeBackgroundAudio, narrationPlayer, narrationMetadata, index]);

  useEffect(() => {
    if (!appActive || !readingOpen) return;
    const frame = requestAnimationFrame(() => {
      if (narrationQueue.current) list.current?.scrollToIndex({ index: currentIndex.current, animated: false });
    });
    return () => cancelAnimationFrame(frame);
  }, [appActive, readingOpen]);

  function toggleReadAloud(value: boolean) {
    if (!value) { stopReadAloud(); return; }
    if (!readingOpen) {
      openBook(activeBook, false, true);
      return;
    }
    if (!runtimeAvailable || !voiceInstalled) {
      requestVoice(currentPassage);
      return;
    }
    if (autoScrollEnabled) {
      setAutoScrollEnabled(false);
      savePreference('auto-scroll-enabled', 'false');
    }
    readAloudRef.current = true;
    setReadAloud(true);
    const session = narrationQueue.current;
    if (session?.queue.position === index) {
      narrationPlayer.resetRemoteTransport?.();
      setRemoteReadingPaused(false);
      void prepareNarrationPlayback(session.queue, session.background).then(canPlay => {
        if (!canPlay || !readAloudRef.current) return;
        session.queue.resume();
        setNarrating(true);
      }).catch(error => {
        if (narrationQueue.current !== session) return;
        stopReadAloud();
        console.warn('Could not resume read-aloud:', error);
      });
    }
  }

  function pauseReadAloud() {
    readAloudRef.current = false;
    const session = narrationQueue.current;
    if (session?.queue.hasStarted) {
      session.queue.pause();
      if (session.background) clearNarrationControls();
      setNarrating(false);
    } else {
      stopNarration();
    }
    setReadAloud(false);
  }

  useEffect(() => () => {
    speechDownloadAbort.current?.abort();
    narrationQueue.current?.queue.dispose();
    const engine = speechEngine.current;
    if (engine) void engine.dispose();
  }, []);

  useEffect(() => {
    if (walkthroughVisible || !ready || !textReady || !autoScrollEnabled || readAloud || !appActive || screen !== 'read' || !isBooksActive || readerMenuOpen || editing !== null || dictionaryWord !== null || sharingId !== null || selectedWord !== null || narrating || touchingReader || (index >= passages.length - 1 && !continuationPending)) return;
    const timer = setTimeout(() => {
      if (continuationNavigator.current?.advance()) return;
      const next = index + 1;
      if (!list.current) return;
      list.current.scrollToIndex({index:next, animated:true});
      rememberPosition(next);
    }, autoScrollSeconds * 1000);
    return () => clearTimeout(timer);
  }, [walkthroughVisible, ready, autoScrollEnabled, readAloud, autoScrollSeconds, appActive, screen, isBooksActive, readerMenuOpen, editing, dictionaryWord, sharingId, selectedWord, narrating, touchingReader, index, interactionCount, rememberPosition, passages.length, textReady, continuationPending]);

  function jump(i: number) { if (i < 0) return; pendingChapterJump.current=i; rememberPosition(i); setScreen('read'); router.back(); }
  function selectChapter(i:number) {
    if (i<0) return;
    pendingChapterJump.current=i;
    rememberPosition(i);
    router.back();
  }
  useEffect(() => {
    if (!isBooksActive || pendingChapterJump.current===null) return;
    const target=pendingChapterJump.current;
    const frame=requestAnimationFrame(() => {
      if (!list.current) return;
      list.current.scrollToIndex({index:target,animated:false});
      pendingChapterJump.current=null;
    });
    return () => cancelAnimationFrame(frame);
  },[isBooksActive,index]);
  function openBook(book: Book, justDownloaded = false, startReading = false) {
    if (!justDownloaded && !installedBooks[book.id]) {void installBook(book, startReading); return;}
    stopReadAloud();
    const resume = book.passages.findIndex(p => p.id === lastByBook[book.id]);
    const next = Math.max(0, resume);
    currentIndex.current = next;
    activeSelection.current = null;
    setSelectedWord(null);
    setActiveBookId(book.id);
    if (!book.languages.includes(language)) setLanguage(book.languages[0]);
    setIndex(next);
    setImmersive(defaultImmersive);
    setScreen('read');
    if (startReading) {
      router.navigate('/reader');
      if (runtimeAvailable && voiceInstalled) {
        if (autoScrollEnabled) {
          setAutoScrollEnabled(false);
          savePreference('auto-scroll-enabled', 'false');
        }
        readAloudRef.current = true;
        setReadAloud(true);
      } else {
        requestVoice(book.passages[next]);
      }
    } else {
      router.push('/reader');
    }
    if (!walkthroughSeen) {setWalkthroughSheetOpen(false); setWalkthroughVisible(true);}
    savePreference('active-book', book.id);
  }
  async function installBook(book:Book, startReading = false) {
    if (bookDownload) {Alert.alert(t("Download in progress"), t("Please wait for the current book to finish downloading.")); return;}
    setBookDownload({id:book.id,progress:0});
    try {
      await downloadBook(book.id, progress => setBookDownload({id:book.id,progress}));
      setInstalledBooks(current => ({...current,[book.id]:true}));
      if (startReading) openBook(book, true, true);
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
  const autoScrollRunning = !walkthroughVisible && ready && autoScrollEnabled && !readAloud && appActive && screen === 'read' && isBooksActive && !readerMenuOpen && editing === null && dictionaryWord === null && sharingId === null && selectedWord === null && !narrating && !touchingReader && !autoScrollFinished;
  if (!ready) return <View style={styles.loading}><ActivityIndicator color={colors.accent}/></View>;
  const settingsIcons = {
    language:{ios:'globe',android:'language'}, reading:{ios:'book',android:'menu_book'},
    appearance:{ios:'paintpalette',android:'palette'}, playback:{ios:'play.circle',android:'play_circle'},
    music:{ios:'music.note',android:'music_note'}, dictionary:{ios:'character.book.closed',android:'dictionary'},
    downloads:{ios:'arrow.down.circle',android:'download'}, privacy:{ios:'hand.raised',android:'privacy_tip'},
    walkthroughs:{ios:'questionmark.circle',android:'help_outline'}, credits:{ios:'info.circle',android:'info'},
  } as const;
  const settingsIcon = (page:keyof typeof settingsIcons) => <SymbolView name={{...settingsIcons[page],web:settingsIcons[page].android}} size={22} tintColor={colors.accent} accessible={false}/>;
  const renderSettingsPage = (settingsPage:SettingsPage, inSplit = false) => <SafeAreaView style={styles.settingsScreen} edges={!inSplit && settingsPage !== 'menu' ? ['left','right','bottom'] : ['top','left','right','bottom']}>
        {inSplit && (settingsPage === 'chapter-images' || settingsPage === 'chapter-select') && <View style={styles.settingsNavigationHeader}>
          {(!inSplit || settingsPage === 'chapter-images' || settingsPage === 'chapter-select') && <Pressable accessibilityRole="button" accessibilityLabel={t("Back to settings")} onPress={closeSettingsPage} style={styles.settingsBackButton}><Text style={styles.backIcon}>‹</Text></Pressable>}
          <Text accessibilityRole="header" style={styles.settingsNavigationTitle}>{settingsPage === 'chapter-images' ? (appLanguage==='hi'?'अध्याय के चित्र':'Chapter images') : settingsPage === 'chapter-select' ? (appLanguage==='hi'?'अध्याय चुनें':'Choose chapter') : settingsPage === 'walkthroughs' ? (appLanguage==='hi'?'परिचय':'Walkthroughs') : settingsPage === 'language' ? t("App language") : settingsPage === 'credits' ? t("Credits") : settingsPage === 'privacy' ? (appLanguage === 'hi' ? 'गोपनीयता' : 'Privacy') : settingsPage === 'reading' ? t("Reading customisation") : settingsPage === 'appearance' ? t("App appearance") : settingsPage === 'playback' ? t("Reading playback") : settingsPage === 'music' ? t("Music") : settingsPage === 'downloads' ? t("Downloaded resources") : settingsPage === 'dictionary' ? t("Dictionary") : t("Settings")}</Text>
        </View>}
        {settingsPage === 'menu' ? <ScrollView {...settingsScrollProps('menu')} contentContainerStyle={styles.settingsList}>
          <Pressable accessibilityRole="button" accessibilityLabel={t("App language")} onPress={() => openSettingsPage('language')} style={({pressed}) => [styles.settingsListRow, pressed && {opacity:0.65}]}>
            {settingsIcon('language')}<View style={styles.settingsMenuText}><Text style={styles.settingsMenuTitle}>{t("App language")}</Text><Text style={styles.settingsMenuDescription}>{t("Choose the language used in menus and settings.")}</Text></View>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={t("Reading customisation")} onPress={() => openSettingsPage('reading')} style={({pressed}) => [styles.settingsListRow, pressed && {opacity:0.65}]}>
            {settingsIcon('reading')}<View style={styles.settingsMenuText}><Text style={styles.settingsMenuTitle}>{t("Reading customisation")}</Text><Text style={styles.settingsMenuDescription}>{t("Adjust text size and reading background.")}</Text></View>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={t("App appearance")} onPress={() => openSettingsPage('appearance')} style={({pressed}) => [styles.settingsListRow, pressed && {opacity:0.65}]}>
            {settingsIcon('appearance')}<View style={styles.settingsMenuText}><Text style={styles.settingsMenuTitle}>{t("App appearance")}</Text><Text style={styles.settingsMenuDescription}>{t("Choose the colors used throughout the app.")}</Text></View>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={t("Reading playback")} onPress={() => openSettingsPage('playback')} style={({pressed}) => [styles.settingsListRow, pressed && {opacity:0.65}]}>
            {settingsIcon('playback')}<View style={styles.settingsMenuText}><Text style={styles.settingsMenuTitle}>{t("Reading playback")}</Text><Text style={styles.settingsMenuDescription}>{t("Manage read aloud and auto-scroll.")}</Text></View>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={t("Music")} onPress={() => openSettingsPage('music')} style={({pressed}) => [styles.settingsListRow, pressed && {opacity:0.65}]}>
            {settingsIcon('music')}<View style={styles.settingsMenuText}><Text style={styles.settingsMenuTitle}>{t("Music")}</Text><Text style={styles.settingsMenuDescription}>{t("Control background music and volume.")}</Text></View>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={t("Dictionary")} onPress={() => openSettingsPage('dictionary')} style={({pressed}) => [styles.settingsListRow, pressed && {opacity:0.65}]}>
            {settingsIcon('dictionary')}<View style={styles.settingsMenuText}><Text style={styles.settingsMenuTitle}>{t("Dictionary")}</Text><Text style={styles.settingsMenuDescription}>{t("Manage offline definitions and source information.")}</Text></View>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={t("Downloaded resources")} onPress={() => openSettingsPage('downloads')} style={({pressed}) => [styles.settingsListRow, pressed && {opacity:0.65}]}>
            {settingsIcon('downloads')}<View style={styles.settingsMenuText}><Text style={styles.settingsMenuTitle}>{t("Downloaded resources")}</Text><Text style={styles.settingsMenuDescription}>{t("Manage the offline voice and dictionary.")}</Text></View>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={appLanguage === 'hi' ? 'गोपनीयता' : 'Privacy'} onPress={() => openSettingsPage('privacy')} style={({pressed}) => [styles.settingsListRow, pressed && {opacity:0.65}]}>
            {settingsIcon('privacy')}<View style={styles.settingsMenuText}><Text style={styles.settingsMenuTitle}>{appLanguage === 'hi' ? 'गोपनीयता' : 'Privacy'}</Text><Text style={styles.settingsMenuDescription}>{appLanguage === 'hi' ? 'आपका डेटा, डाउनलोड और संपर्क जानकारी।' : 'Your data, downloads and contact information.'}</Text></View>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => openSettingsPage('walkthroughs')} style={({pressed}) => [styles.settingsListRow, pressed && {opacity:0.65}]}>{settingsIcon('walkthroughs')}<View style={styles.settingsMenuText}><Text style={styles.settingsMenuTitle}>{appLanguage==='hi'?'परिचय':'Walkthroughs'}</Text><Text style={styles.settingsMenuDescription}>{appLanguage==='hi'?'पढ़ने और प्रश्नावली के परिचय फिर से देखें।':'Manage guides for reading and Prashnavali.'}</Text></View></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={t("Credits")} onPress={() => openSettingsPage('credits')} style={({pressed}) => [styles.settingsListRow, pressed && {opacity:0.65}]}>
            {settingsIcon('credits')}<View style={styles.settingsMenuText}><Text style={styles.settingsMenuTitle}>{t("Credits")}</Text><Text style={styles.settingsMenuDescription}>{t("Books, music, voice and other sources.")}</Text></View>
          </Pressable>
        </ScrollView> : settingsPage === 'walkthroughs' ? <ScrollView {...settingsScrollProps('walkthroughs')} contentContainerStyle={styles.settingsList}>
          <Text style={styles.imageHelp}>{appLanguage==='hi'?'किसी परिचय को रीसेट करें ताकि वह अगली बार संबंधित अनुभाग खोलने पर दिखाई दे।':'Reset a guide to see it the next time you open its section.'}</Text>
          <Pressable accessibilityRole="button" accessibilityState={{disabled:walkthroughSaving}} disabled={walkthroughSaving} onPress={() => void resetWalkthrough('reader')} style={({pressed}) => [styles.settingsListRow, pressed && {opacity:0.65}]}><View style={styles.settingsMenuText}><Text style={styles.settingsMenuTitle}>{appLanguage==='hi'?'पढ़ने का परिचय रीसेट करें':'Reset reading walkthrough'}</Text><Text style={styles.settingsMenuDescription}>{appLanguage==='hi'?'पूरी स्क्रीन पर पढ़ने के लिए पिंच करना सीखें।':'Learn the full-screen reading gestures.'}</Text></View><Text style={styles.settingsChevron}>↻</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityState={{disabled:walkthroughSaving}} disabled={walkthroughSaving} onPress={() => void resetWalkthrough('prashnavali')} style={({pressed}) => [styles.settingsListRow, pressed && {opacity:0.65}]}><View style={styles.settingsMenuText}><Text style={styles.settingsMenuTitle}>{appLanguage==='hi'?'प्रश्नावली का परिचय रीसेट करें':'Reset Prashnavali walkthrough'}</Text><Text style={styles.settingsMenuDescription}>{appLanguage==='hi'?'प्रश्नावली का उपयोग करना सीखें।':'Learn how to use the Prashnavali board.'}</Text></View><Text style={styles.settingsChevron}>↻</Text></Pressable>
        </ScrollView> : settingsPage === 'language' ? <ScrollView {...settingsScrollProps('language')} contentContainerStyle={styles.settingsList}>
          <Text style={styles.imageHelp}>{t("Choose the language used in menus and settings.")} {appLanguage === 'hi' ? 'पुस्तक के पाठ की भाषा अलग से चुनी जाती है।' : t("The reading language is chosen separately.")}</Text>
          <Host colorScheme={colors.dark ? 'dark' : 'light'} seedColor={colors.accent} matchContents={{vertical:true}} style={{width:'100%',marginTop:8}}><Column spacing={0} style={{width:'100%'}}>{([['en',t("English")],['hi','हिंदी']] as const).map(([value,label]) => <ListItem key={value} onPress={() => void setAppLanguage(value)} trailing={appLanguage===value ? '✓' : undefined} colors={{containerColor:colors.paper,contentColor:colors.ink,trailingContentColor:colors.accent}} modifiers={Platform.OS==='ios' ? [swiftPadding({vertical:16}),swiftAccessibilityValue(appLanguage===value ? (appLanguage==='hi'?'चयनित':'Selected') : '')] : Platform.OS==='android' ? [composeSemantics({contentDescription:`${label}${appLanguage===value ? (appLanguage==='hi'?', चयनित':', selected') : ''}`})] : undefined}>{label}</ListItem>)}</Column></Host>
        </ScrollView> : settingsPage === 'privacy' ? <ScrollView {...settingsScrollProps('privacy')} contentContainerStyle={styles.settingsList}>
          <Text style={styles.imageHelp}>{appLanguage === 'hi' ? 'गोपनीयता नीति का प्रारूप · 18 नवंबर 2026' : 'Privacy policy draft · 18 November 2026'}</Text>
          {[
            ["Your device", "आपका डिवाइस", "Reading progress, saved passages, notes, preferences and downloaded content are stored on your device. Photos you select for backgrounds are copied into the app. Your device or backup provider may include app data in backups according to your settings.", "पढ़ने की स्थिति, सहेजे गए अंश, नोट्स, प्राथमिकताएँ और डाउनलोड की गई सामग्री आपके डिवाइस पर रहती है। पृष्ठभूमि के लिए चुने गए चित्रों की प्रतियाँ ऐप में रखी जाती हैं। आपकी सेटिंग के अनुसार डिवाइस या बैकअप सेवा ऐप डेटा का बैकअप ले सकती है।"],
            ["Downloads", "डाउनलोड", "Book files come from GitHub, the optional dictionary from en-word.net, and optional voice files from Hugging Face and GitHub. These services may receive your IP address, requested file, request time and other technical details and retain logs under their own policies. Downloads may use mobile data.", "पुस्तकें GitHub से, वैकल्पिक शब्दकोश en-word.net से और वैकल्पिक वॉइस फ़ाइलें Hugging Face और GitHub से डाउनलोड होती हैं। इन सेवाओं को आपका IP पता, फ़ाइल का नाम, अनुरोध का समय और तकनीकी जानकारी मिल सकती है; वे अपनी नीतियों के अनुसार लॉग रख सकती हैं। डाउनलोड में मोबाइल डेटा लग सकता है।"],
            ["On-device features", "डिवाइस पर चलने वाली सुविधाएँ", "The voice model reads text and the dictionary looks up words on your device. These features do not send the passage or lookup word to a remote service. An internet connection is needed to download their files first.", "वॉइस मॉडल पाठ पढ़ता है और शब्दकोश शब्दों का अर्थ आपके डिवाइस पर खोजता है। ये सुविधाएँ अंश या खोजा गया शब्द किसी दूरस्थ सेवा को नहीं भेजतीं। पहली बार फ़ाइलें डाउनलोड करने के लिए इंटरनेट चाहिए।"],
            ["Photos, copy and sharing", "चित्र, कॉपी और शेयर", "Choosing photos is optional. Copy puts the selected text on your device clipboard. Sharing opens the system share sheet; the app you choose receives what you share and applies its own privacy policy. External links open other services and their policies apply.", "चित्र चुनना वैकल्पिक है। कॉपी करने पर चुना हुआ पाठ डिवाइस के क्लिपबोर्ड पर जाता है। शेयर करने पर सिस्टम की शेयर सूची खुलती है; चुने गए ऐप को साझा की गई सामग्री मिलती है और उसकी अपनी गोपनीयता नीति लागू होती है। बाहरी लिंक पर संबंधित सेवा की नीति लागू होती है।"],
            ["Accounts and analytics", "खाते और विश्लेषण", "This version does not require a DivineCanvas account and has no advertising or analytics feature. We do not sell your personal information. Other services you choose to use have their own privacy policies.", "इस संस्करण में DivineCanvas खाता आवश्यक नहीं है और विज्ञापन या विश्लेषण की सुविधा नहीं है। हम आपकी व्यक्तिगत जानकारी नहीं बेचते। आपके द्वारा उपयोग की जाने वाली अन्य सेवाओं की अपनी गोपनीयता नीतियाँ हैं।"],
            ["Deleting data", "डेटा हटाना", "You can remove downloaded books, the dictionary and the voice model in the app. Removing a book keeps its notes and progress. Uninstalling normally removes local app data; device or cloud backups may remain and can be managed with your backup provider. Third-party services control their own logs.", "आप ऐप में डाउनलोड की गई पुस्तकें, शब्दकोश और वॉइस मॉडल हटा सकते हैं। पुस्तक हटाने पर उसके नोट्स और पढ़ने की स्थिति बनी रहती है। ऐप हटाने पर आम तौर पर स्थानीय डेटा हट जाता है; डिवाइस या क्लाउड बैकअप रह सकते हैं, जिन्हें आप अपनी बैकअप सेवा में प्रबंधित कर सकते हैं। अन्य सेवाएँ अपने लॉग स्वयं नियंत्रित करती हैं।"],
            ["Questions", "सवाल", "A privacy contact will be added before release. We will update this policy if our practices change.", "रिलीज़ से पहले गोपनीयता संपर्क जोड़ा जाएगा। हमारी प्रक्रिया बदलने पर हम यह नीति अपडेट करेंगे।"],
          ].map(([enTitle, hiTitle, enText, hiText]) => <View key={enTitle} style={styles.settingsCredits}><Text accessibilityRole="header" style={styles.settingsMenuTitle}>{appLanguage === 'hi' ? hiTitle : enTitle}</Text><Text style={styles.settingsCreditText}>{appLanguage === 'hi' ? hiText : enText}</Text></View>)}
        </ScrollView> : settingsPage === 'credits' ? <ScrollView {...settingsScrollProps('credits')} contentContainerStyle={styles.settingsList}>
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
            {MUSIC_TRACKS.map(track => <View key={track.id} style={{gap:4}}><Text style={styles.settingsCreditText}>{track.title} · {track.artist} · CC BY 4.0</Text><Text accessibilityRole="link" onPress={() => void Linking.openURL(track.source)} style={styles.settingsCreditLink}>{t("Music source ↗")}</Text></View>)}
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
        </ScrollView> : settingsPage === 'dictionary' ? <ScrollView {...settingsScrollProps('dictionary')} contentContainerStyle={styles.settingsList}>
          <View style={styles.settingsListRow}>
            <View style={styles.settingsMenuText}><Text style={styles.settingsMenuTitle}>{t("English dictionary")}</Text><Text style={styles.settingsMenuDescription}>{dictionaryDownload !== null ? `${appLanguage === 'hi' ? 'डाउनलोड हो रहा है' : 'Downloading'} ${Math.round(dictionaryDownload*100)}%` : dictionaryInstalled ? t("Downloaded · about 10 MB") : t("Not downloaded · about 10 MB")}</Text></View>
            {dictionaryDownload === null && <Pressable accessibilityRole="button" accessibilityLabel={dictionaryInstalled ? t("Remove English dictionary") : t("Download English dictionary")} onPress={() => {if (dictionaryInstalled) deleteDictionary(); else void installDictionaryFromSettings();}}><Text style={styles.downloadCancel}>{dictionaryInstalled ? t("Remove") : t("Download")}</Text></Pressable>}
          </View>
          <Text style={styles.imageHelp}>{t("Double-tap an English word while reading to look it up. Hindi and Sanskrit dictionaries are not available yet.")}</Text>
        </ScrollView> : settingsPage === 'downloads'  ? <ScrollView {...settingsScrollProps('downloads')} contentContainerStyle={styles.settingsList}>
          <View style={styles.settingsListRow}><View style={styles.settingsMenuText}><Text style={styles.settingsMenuTitle}>{t("Reading voice")}</Text><Text style={styles.settingsMenuDescription}>{voiceDownload !== null ? `${appLanguage === 'hi' ? 'डाउनलोड हो रहा है' : 'Downloading'} ${Math.round(voiceDownload*100)}%` : voiceInstalled ? t("Downloaded · about 11 MB") : t("Not downloaded · about 11 MB")}</Text></View>
            {voiceDownload !== null ? <Pressable accessibilityRole="button" onPress={cancelVoiceDownload}><Text style={styles.downloadCancel}>{t("Cancel")}</Text></Pressable> : <Pressable accessibilityRole="button" onPress={() => void (voiceInstalled ? removeVoice() : downloadVoice())}><Text style={styles.downloadCancel}>{voiceInstalled ? t("Remove") : t("Download")}</Text></Pressable>}
          </View>
          <View style={styles.settingsListRow}><View style={styles.settingsMenuText}><Text style={styles.settingsMenuTitle}>{t("English dictionary")}</Text><Text style={styles.settingsMenuDescription}>{dictionaryDownload !== null ? `${appLanguage === 'hi' ? 'डाउनलोड हो रहा है' : 'Downloading'} ${Math.round(dictionaryDownload*100)}%` : dictionaryInstalled ? t("Downloaded · about 10 MB") : t("Not downloaded · about 10 MB")}</Text></View>
            {dictionaryInstalled && dictionaryDownload === null && <Pressable accessibilityRole="button" accessibilityLabel={t("Remove English dictionary")} onPress={deleteDictionary}><Text style={styles.downloadCancel}>{t("Remove")}</Text></Pressable>}
          </View>
          <Text style={styles.imageHelp}>{t("The dictionary can be downloaded when you double-tap an English word. Removing a resource does not remove your saved verses or notes.")}</Text>
        </ScrollView> : settingsPage === 'playback' ? <ScrollView {...settingsScrollProps('playback')} contentContainerStyle={styles.settingsList}>
          <View style={styles.settingsListRow}>
            <View style={styles.settingsMenuText}><Text style={styles.settingsMenuTitle}>{t("Read aloud")}</Text><Text style={styles.settingsMenuDescription}>{t("Read each passage and move to the next when finished. Use the play button to pause or resume.")}</Text></View>
            <Switch accessibilityLabel={t("Read aloud")} value={readAloud} onValueChange={toggleReadAloud} trackColor={{true: colors.accent}} />
          </View>
          {backgroundPlaybackAvailable && <View style={styles.settingsListRow}>
            <View style={styles.settingsMenuText}>
              <Text style={styles.settingsMenuTitle}>{t("Background read-aloud")}</Text>
              <Text style={styles.settingsMenuDescription}>{t("Keep read-aloud and its accompanying music playing when you lock your device or switch apps.")}</Text>
            </View>
            <Switch accessibilityLabel={t("Background read-aloud")} value={backgroundReadingAudio} onValueChange={value => {
              setBackgroundReadingAudio(value);
              savePreference('background-reading-audio', String(value));
            }} trackColor={{true: colors.accent}} />
          </View>}
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
        </ScrollView> : settingsPage === 'music' ? <ScrollView {...settingsScrollProps('music')} scrollEnabled={!musicDragging} contentContainerStyle={styles.settingsList}>
          <View style={styles.settingsListRow}>
            <View style={styles.settingsMenuText}><Text style={styles.settingsMenuTitle}>{t("Reading music")}</Text><Text style={styles.settingsMenuDescription}>{t("Play instrumental music while reading.")}</Text></View>
            <Switch accessibilityLabel={t("Reading music")} value={musicEnabled} onValueChange={value => {setMusicEnabled(value); void setting('music-enabled', String(value));}} trackColor={{true: colors.accent}} />
          </View>
          <View style={{paddingVertical: 18}}>
            <View style={styles.blurHeading}><Text style={styles.settingsMenuTitle}>{t("Music volume")}</Text><Text style={styles.settingsMenuDescription}>{Math.round(musicVolume * 100)}%</Text></View>
            <Slider accessibilityLabel={t("Music volume")} accessibilityValue={{min:0,max:100,now:Math.round(musicVolume*100)}} minimumValue={0} maximumValue={1} step={0.01} value={musicVolume} onValueChange={setMusicVolume} onSlidingComplete={value => {setMusicVolume(value); void setting('music-volume', String(value));}} minimumTrackTintColor={colors.accent} maximumTrackTintColor={colors.line} thumbTintColor={colors.accent} tapToSeek style={styles.blurSlider}/>

          </View>
          <View style={styles.settingsListRow}><View style={styles.settingsMenuText}><Text style={styles.settingsMenuTitle}>{appLanguage==='hi'?'संगीत शफ़ल करें':'Shuffle music'}</Text><Text style={styles.settingsMenuDescription}>{appLanguage==='hi'?'चुने हुए गीतों का क्रम बदलें।':'Shuffle the order of selected tracks.'}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={appLanguage==='hi'?'चुने हुए गीत शफ़ल करें':'Shuffle selected tracks'} onPress={shuffleMusic} style={{minHeight:44,paddingHorizontal:12,justifyContent:'center'}}><Text style={{color:colors.accent,fontWeight:'600'}}>{appLanguage==='hi'?'शफ़ल':'Shuffle'}</Text></Pressable></View>
          <View style={{paddingTop:24,gap:4}}><Text accessibilityRole="header" style={styles.settingsMenuTitle}>{appLanguage==='hi'?'संगीत संग्रह':'Music library'}</Text><Text style={styles.settingsMenuDescription}>{appLanguage==='hi'?'गीत चुनें, सुनें या क्रम बदलने के लिए हैंडल खींचें।':'Select tracks to play, preview them, or drag the handle to reorder.'}</Text></View>
          {[...musicQueue,...musicOrder.filter(id => !downloadedMusic[id])].map(id => {
            const track=MUSIC_TRACKS.find(item => item.id===id); if (!track) return null;
            const installed=!!downloadedMusic[id], progress=musicDownloads[id];
            const removable=installed && id!==DEFAULT_MUSIC_ID;
            const chosen=!musicExcluded.includes(id);
            const trackContent=<Pressable accessibilityRole={installed?'checkbox':'text'} accessibilityState={installed?{checked:chosen}:undefined} accessibilityHint={removable ? (appLanguage==='hi'?'डाउनलोड हटाने के लिए दबाकर रखें।':'Touch and hold for download options.') : undefined} accessibilityActions={removable ? [{name:'remove',label:appLanguage==='hi'?'डाउनलोड हटाएँ':'Remove download'}] : undefined} onAccessibilityAction={event => {if (event.nativeEvent.actionName==='remove') deleteMusic(track);}} disabled={!installed} onPress={() => selectMusic(track)} style={{flex:1,flexDirection:'row',alignItems:'center',gap:10,paddingVertical:4}}>
              {installed && <SymbolView name={{ios:chosen?'checkmark.circle.fill':'circle',android:chosen?'check_circle':'radio_button_unchecked',web:chosen?'check_circle':'radio_button_unchecked'}} tintColor={chosen?colors.accent:colors.muted} size={20} accessible={false}/>}
              <View style={{flex:1,gap:4}}><Text style={{fontSize:16,lineHeight:22,color:colors.ink}}>{track.title}</Text><Text style={{fontSize:13,lineHeight:19,color:colors.muted}}>{track.artist} · {(track.bytes/1000000).toFixed(1)} MB{track.id===DEFAULT_MUSIC_ID ? (appLanguage==='hi'?' · शामिल':' · Included') : ''}</Text></View>
            </Pressable>;
            return <MusicReorderRow key={id} id={id} colors={colors} draggable={installed && musicQueue.length>1} label={`${appLanguage==='hi'?'क्रम बदलें':'Reorder'} ${track.title}`} hint={appLanguage==='hi'?'क्रम बदलने के लिए खींचें। पहुँच क्रियाओं से ऊपर या नीचे ले जाएँ।':'Drag to change playback order. Use accessibility actions to move up or down.'} moveUpLabel={appLanguage==='hi'?'ऊपर ले जाएँ':'Move up'} moveDownLabel={appLanguage==='hi'?'नीचे ले जाएँ':'Move down'} onMeasure={(key,y,rowHeight) => {musicRowLayouts.current[key]={y,height:rowHeight};}} onDrop={dropMusic} onMove={reorderMusic} onDragChange={setMusicDragging}>
              {removable && Platform.OS!=='web' ? <MenuView shouldOpenOnLongPress style={{flex:1}} title={track.title} actions={[{id:'remove',title:appLanguage==='hi'?'डाउनलोड हटाएँ':'Remove download',image:'trash',attributes:{destructive:true}}]} onPressAction={event => {if(event.nativeEvent.event==='remove') deleteMusic(track);}}>{trackContent}</MenuView> : trackContent}
              {installed && <Pressable accessibilityRole="button" accessibilityLabel={`${previewMusic===id ? (appLanguage==='hi'?'पूर्वावलोकन रोकें':'Stop preview') : (appLanguage==='hi'?'पूर्वावलोकन चलाएँ':'Play preview')} ${track.title}`} onPress={() => setPreviewMusic(previewMusic===id ? null : id)} style={{width:44,height:48,alignItems:'center',justifyContent:'center'}}><SymbolView name={{ios:previewMusic===id?'pause.circle':'play.circle',android:previewMusic===id?'pause_circle':'play_circle',web:previewMusic===id?'pause_circle':'play_circle'}} size={24} tintColor={colors.accent} accessible={false}/></Pressable>}
              {previewMusic===id && <MusicPreview track={track} onFinish={() => setPreviewMusic(null)} onClose={() => setPreviewState(current => current?.id===id && current.scope===previewScope ? null : current)}/>}
              {!installed && (progress!==undefined ? <Text accessibilityRole="progressbar" accessibilityLabel={`${track.title} ${appLanguage==='hi'?'डाउनलोड हो रहा है':'downloading'}`} accessibilityValue={{min:0,max:100,now:Math.round(progress*100)}} style={{color:colors.muted}}>{Math.round(progress*100)}%</Text> : <Pressable accessibilityRole="button" accessibilityLabel={`${appLanguage==='hi'?'डाउनलोड करें':'Download'} ${track.title}, ${(track.bytes/1000000).toFixed(1)} MB`} onPress={() => void installMusic(track)} style={{minHeight:44,justifyContent:'center',paddingHorizontal:8}}><Text style={{color:colors.accent,fontWeight:'600'}}>{appLanguage==='hi'?'डाउनलोड':'Download'}</Text></Pressable>)}
            </MusicReorderRow>;
          })}
          <Text style={[styles.imageHelp,{paddingVertical:16}]}>{appLanguage==='hi'?'गीत Creative Commons Attribution 4.0 के अंतर्गत हैं। विवरण क्रेडिट में देखें।':'Tracks are licensed under Creative Commons Attribution 4.0. See Credits for sources.'}</Text>
        </ScrollView> : settingsPage === 'chapter-select' ? <View style={{flex:1,paddingHorizontal:24}}>
          <TextInput accessibilityLabel={appLanguage==='hi'?'अध्याय खोजें':'Search chapters'} value={chapterSearch} onChangeText={setChapterSearch} placeholder={appLanguage==='hi'?'अध्याय संख्या या नाम खोजें':'Search chapter number or title'} placeholderTextColor={colors.muted} style={{color:colors.ink,borderBottomWidth:1,borderColor:colors.line,paddingVertical:14,fontSize:16}} />
          <FlatList keyboardShouldPersistTaps="handled" data={pickerBook.chapters.filter(chapter => `${chapter.number} ${chapter.title} ${chapter.detail ?? ''}`.toLowerCase().includes(chapterSearch.trim().toLowerCase()))} keyExtractor={chapter => String(chapter.number)} renderItem={({item}) => <Pressable accessibilityRole="button" accessibilityState={{selected:pickerChapter===item.number}} onPress={() => {setPickerChapter(item.number); closeSettingsPage();}} style={({pressed}) => [styles.settingsListRow, pressed && {opacity:0.65}]}><View style={styles.settingsMenuText}><Text style={styles.settingsMenuTitle}>{appLanguage==='hi'?'अध्याय':'Chapter'} {item.number}</Text><Text style={styles.settingsMenuDescription}>{localChapter(item.title)}</Text></View>{pickerChapter===item.number && <Text style={styles.choiceCheck}>✓</Text>}</Pressable>} />
        </View> : settingsPage === 'chapter-images' ? <ScrollView {...settingsScrollProps('chapter-images')} contentContainerStyle={styles.settingsContent}>
          <View><Text style={styles.preferenceLabel}>{appLanguage==='hi'?'पुस्तक':'Book'}</Text><Text style={[styles.settingsMenuTitle,{marginTop:8}]}>{t(pickerBook.title)}</Text><Text style={styles.imageHelp}>{appLanguage==='hi'?'हर पुस्तक और अध्याय का चुनाव अलग से सहेजा जाता है।':'Choices are saved separately for each book and chapter.'}</Text>
            {imagePickerReturn==='reading' && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8,paddingVertical:12}}>{books.map(book => <Pressable key={book.id} accessibilityRole="radio" accessibilityState={{checked:pickerBookId===book.id}} onPress={() => {setPickerBookId(book.id);setPickerChapter(book.chapters[0]?.number ?? 1);setShuffleMessage('');}} style={[styles.language,pickerBookId===book.id && styles.selectedOption]}><Text style={[styles.languageText,pickerBookId===book.id && styles.selectedText]}>{t(book.title)}</Text></Pressable>)}</ScrollView>}
          </View>
          <Pressable accessibilityRole="button" onPress={() => {setChapterSearch('');openSettingsPage('chapter-select');}} style={({pressed}) => [styles.settingsListRow, pressed && {opacity:0.65}]}><View style={styles.settingsMenuText}><Text style={styles.settingsMenuTitle}>{appLanguage==='hi'?'अध्याय':'Chapter'} {pickerChapter}</Text><Text style={styles.settingsMenuDescription}>{localChapter(pickerBook.chapters.find(chapter => chapter.number===pickerChapter)?.title ?? '')}</Text></View></Pressable>
          {pickerBackground && <View style={styles.imagePreview}><Image source={pickerBackground.source} style={styles.backgroundImage} resizeMode="cover" /></View>}
          <View><Text style={styles.preferenceLabel}>{appLanguage==='hi'?'इस अध्याय के लिए चित्र':'Image for this chapter'}</Text><Text style={styles.imageHelp}>{appLanguage==='hi'?'एक चित्र चुनें या अपने आप चुना गया चित्र उपयोग करें।':'Choose an image or use the automatic assignment.'}</Text></View>
          <Pressable accessibilityRole="radio" accessibilityState={{checked:!chapterOverrides[chapterImageKey(pickerBookId,pickerChapter)]}} onPress={() => updateChapterImage(null)} style={styles.choiceRow}><Text style={styles.paletteName}>{appLanguage==='hi'?'अपने आप चुनें':'Automatic'}</Text>{!chapterOverrides[chapterImageKey(pickerBookId,pickerChapter)] && <Text style={styles.choiceCheck}>✓</Text>}</Pressable>
          <View style={styles.imageGrid}>{bookImages.map((image,i) => {const chosen=chapterOverrides[chapterImageKey(pickerBookId,pickerChapter)]===image.id; return <Pressable key={image.id} accessibilityRole="radio" accessibilityLabel={`${appLanguage==='hi'?'चित्र':'Image'} ${i+1}`} accessibilityState={{checked:chosen}} onPress={() => updateChapterImage(image.id)} style={[styles.imageOption,chosen && styles.imageOptionSelected]}><Image source={image.thumbnail} style={styles.imageThumbnail} resizeMethod="resize"/>{chosen && <View style={styles.imageCheck}><Text style={styles.imageCheckText}>✓</Text></View>}</Pressable>;})}</View>
          <View><Pressable accessibilityRole="button" onPress={() => shuffleChapterImages(pickerBook,pickerChapter)} style={({pressed}) => [styles.button,{alignSelf:'flex-start',borderWidth:1,borderColor:colors.line,backgroundColor:pressed ? colors.line : 'transparent'}]}><Text style={{color:colors.accent,fontWeight:'600'}}>{appLanguage==='hi'?'इस पुस्तक के चित्र बदलें':'Shuffle this book’s images'}</Text></Pressable><Text style={styles.imageHelp}>{appLanguage==='hi'?'इस पुस्तक के सभी अध्यायों के चित्र फिर से चुने जाएँगे, जिनमें आपके चुने चित्र भी शामिल हैं।':'Reshuffles all chapters in this book, including your chosen images.'}</Text>{!!shuffleMessage && <Text accessibilityLiveRegion="polite" style={{color:colors.accent,fontSize:14,fontWeight:'600',marginTop:10}}>{shuffleMessage}</Text>}</View>
        </ScrollView> : settingsPage === 'reading' ? <ScrollView {...settingsScrollProps('reading')} contentContainerStyle={styles.settingsContent}>
          <View style={styles.settingsListRow}><View style={styles.settingsMenuText}><Text style={styles.settingsMenuTitle}>{appLanguage==='hi'?'डिफ़ॉल्ट रूप से पूरी स्क्रीन':'Full screen by default'}</Text><Text style={styles.settingsMenuDescription}>{appLanguage==='hi'?'पुस्तक खोलते समय नियंत्रण छिपाएँ। पढ़ते समय पिंच करके उन्हें फिर दिखा सकते हैं।':'Hide controls when you open a book. Pinch inward while reading to show them.'}</Text></View><Switch accessibilityLabel={appLanguage==='hi'?'डिफ़ॉल्ट रूप से पूरी स्क्रीन':'Full screen by default'} value={defaultImmersive} onValueChange={value => {setDefaultImmersive(value); savePreference('default-fullscreen',String(value));}} trackColor={{true:colors.accent}}/></View>
          <View style={[styles.preferenceGroup,styles.readingGroup]}><View><Text accessibilityRole="header" style={styles.readingHeading}>{t("Text size")}</Text><Text style={styles.imageHelp}>{t("Choose a comfortable size for reading.")}</Text></View><View style={styles.sizeOptions}>
            {fontSizes.map((size,i) => <Pressable key={size} accessibilityRole="button" accessibilityLabel={`${[t("Small"),t("Default"),t("Large")][i]} ${appLanguage==='hi'?'अक्षर':'text'}`} accessibilityState={{selected:fontSize===size}} onPress={() => {setFontSize(size); savePreference('font-size',String(size));}} style={[styles.sizeOption,fontSize===size && styles.selectedOption]}><Text style={[styles.sizeSample,{fontSize:18+i*4},fontSize===size && styles.selectedText]}>Aa</Text><Text style={[styles.optionLabel,fontSize===size && styles.selectedText]}>{[t("Small"),t("Default"),t("Large")][i]}</Text></Pressable>)}
          </View></View>
          <View style={[styles.preferenceGroup,styles.readingGroup]}><View><Text accessibilityRole="header" style={styles.readingHeading}>{t("Reading background")}</Text><Text style={styles.imageHelp}>{t("Choose what appears behind the text.")}</Text></View>
            <View>
              <Pressable accessibilityRole="radio" accessibilityLabel={t("No image")} accessibilityState={{checked:background!=='images'}} aria-checked={background!=='images'} onPress={() => {setBackground(colorTheme); savePreference('background',colorTheme);}} style={[styles.choiceRow,styles.readingChoiceRow]}><View style={styles.settingsMenuText}><Text style={styles.readingOptionTitle}>{t("No image")}</Text><Text style={styles.settingsMenuDescription}>{t("Use your app background color.")}</Text></View>{background !== 'images' && <Text style={styles.choiceCheck}>✓</Text>}</Pressable>
              <Pressable accessibilityRole="radio" accessibilityLabel={t("With images")} accessibilityState={{checked:background==='images'}} aria-checked={background==='images'} onPress={() => {setBackground('images'); savePreference('background','images');}} style={[styles.choiceRow,styles.readingChoiceRow]}><View style={styles.settingsMenuText}><Text style={styles.readingOptionTitle}>{t("With images")}</Text><Text style={styles.settingsMenuDescription}>{t("Show an image behind each chapter.")}</Text></View>{background === 'images' && <Text style={styles.choiceCheck}>✓</Text>}</Pressable>
            </View>
          </View>
          <Pressable accessibilityRole="button" onPress={() => openChapterImages('reading')} style={({pressed}) => [styles.settingsListRow, pressed && {opacity:0.65}]}><View style={styles.settingsMenuText}><Text style={styles.settingsMenuTitle}>{appLanguage==='hi'?'अध्याय के चित्र':'Chapter images'}</Text><Text style={styles.settingsMenuDescription}>{appLanguage==='hi'?'हर अध्याय के लिए चुनें या चित्र बदलें।':'Choose an image for a chapter or shuffle them.'}</Text></View></Pressable>
          {background === 'images' && <View style={[styles.preferenceGroup,styles.readingGroup]}>
            <View><Text accessibilityRole="header" style={styles.readingHeading}>{t("Image style")}</Text><Text style={styles.imageHelp}>{t("Choose the look of your reading background.")}</Text></View>
            <View style={styles.imagePreview} accessible accessibilityLabel={`${appLanguage==='hi'?'पृष्ठभूमि की झलक':'Background preview'}, ${imageTone === 'color' ? t("Color") : t("Black and white")}, ${t("Blur")} ${imageBlur} / 8`}>
              <View pointerEvents="none" style={styles.fixedBackground}><FilterImage source={currentBackground?.source} style={styles.backgroundImage} resizeMode="cover" filters={imageFilters}/><View style={styles.backgroundScrim}/></View>
              <Text style={styles.imagePreviewText}>{t("A moment to read.")}</Text>
            </View>
            <View>
              {([['color',t("Color")],['monochrome',t("Black and white")]] as const).map(([value,label]) => <Pressable key={value} accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{checked:imageTone===value}} aria-checked={imageTone===value} onPress={() => {setImageTone(value); savePreference('image-tone',value);}} style={[styles.choiceRow,styles.readingChoiceRow]}><Text style={styles.readingOptionTitle}>{label}</Text>{imageTone===value && <Text style={styles.choiceCheck}>✓</Text>}</Pressable>)}
            </View>
            <View><View style={styles.blurHeading}><Text accessibilityRole="header" style={styles.readingHeading}>{t("Blur")}</Text><Text style={styles.imageHelp}>{imageBlur === 0 ? t("None") : `${imageBlur} / 8`}</Text></View><Text style={styles.imageHelp}>{t("Soften the image behind the text.")}</Text>
              <Slider accessibilityLabel={t("Background blur")} accessibilityValue={{min:0,max:8,now:imageBlur,text:imageBlur === 0 ? t("No blur") : `${appLanguage === 'hi' ? 'धुंधलापन' : 'Blur level'} ${imageBlur} / 8`}} minimumValue={0} maximumValue={8} step={1} value={imageBlur} onValueChange={setImageBlur} onSlidingComplete={value => {setImageBlur(value); savePreference('image-blur',String(value));}} minimumTrackTintColor={colors.accent} maximumTrackTintColor={colors.line} thumbTintColor={colors.accent} tapToSeek style={styles.blurSlider}/>
              <View style={styles.blurLabels}><Text style={styles.optionLabel}>{t("None")}</Text><Text style={styles.optionLabel}>{t("More")}</Text></View>
            </View>
          </View>}
          {background === 'images' && <View style={[styles.preferenceGroup,styles.readingGroup]}>
            <View><Text accessibilityRole="header" style={styles.readingHeading}>{t("Chapter images")}</Text><Text style={styles.imageHelp}>{appLanguage==='hi'?'सभी पुस्तकों में अपने आप चुनने के लिए चित्र।':'Images used for automatic selection across all books.'}</Text></View>
            <View style={styles.imageGrid}>{bookImages.map((image, i) => <Pressable key={image.id} accessibilityRole="checkbox" accessibilityLabel={`${appLanguage === 'hi' ? 'पृष्ठभूमि चित्र' : 'Background image'} ${i + 1}`} accessibilityState={{checked:selectedImages.includes(image.id)}} aria-checked={selectedImages.includes(image.id)} onPress={() => toggleImage(image.id)} style={[styles.imageOption,selectedImages.includes(image.id) && styles.imageOptionSelected]}><Image source={image.thumbnail} style={styles.imageThumbnail} resizeMethod="resize"/>{selectedImages.includes(image.id) && <View style={styles.imageCheck}><Text style={styles.imageCheckText}>✓</Text></View>}</Pressable>)}</View>
            <Pressable accessibilityRole="button" accessibilityState={{busy:addingImages}} disabled={addingImages} onPress={() => void addImages()} style={styles.addImages}><Text style={styles.addImagesText}>{addingImages ? t("Adding images…") : t("+ Add your images")}</Text></Pressable>
          </View>}
        </ScrollView> : <ScrollView {...settingsScrollProps('appearance')} contentContainerStyle={styles.settingsContent}>
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
      </SafeAreaView>;
  const renderSettings = (settingsPage:SettingsPage) => {
    if (!isWideIPad) return renderSettingsPage(settingsPage);
    const currentPage = splitSettingsStack[splitSettingsStack.length-1] ?? 'language';
    const selectedPage = currentPage === 'chapter-images' || currentPage === 'chapter-select' ? 'reading' : currentPage;
    const items = [
      {page:'language', label:t('App language'), icon:'globe'},
      {page:'reading', label:t('Reading customisation'), icon:'book'},
      {page:'appearance', label:t('App appearance'), icon:'paintpalette'},
      {page:'playback', label:t('Reading playback'), icon:'play.circle'},
      {page:'music', label:t('Music'), icon:'music.note'},
      {page:'dictionary', label:t('Dictionary'), icon:'character.book.closed'},
      {page:'downloads', label:t('Downloaded resources'), icon:'arrow.down.circle'},
      {page:'privacy', label:appLanguage === 'hi' ? 'गोपनीयता' : 'Privacy', icon:'hand.raised'},
      {page:'walkthroughs', label:appLanguage === 'hi' ? 'परिचय' : 'Walkthroughs', icon:'questionmark.circle'},
      {page:'credits', label:t('Credits'), icon:'info.circle'},
    ] as const;
    return <View style={{flex:1,flexDirection:'row',backgroundColor:colors.paper}}>
      <SafeAreaView edges={['left','bottom']} style={{width:Math.min(320,width*0.34),backgroundColor:colors.white,borderRightWidth:StyleSheet.hairlineWidth,borderRightColor:colors.line}}>
        <TabSafeAreaView edges={{top:true}} style={{flex:1}}>
        <ScrollView contentContainerStyle={{paddingHorizontal:12,paddingTop:16,paddingBottom:24}}>
          {items.map(item => <Pressable key={item.page} accessibilityRole="button" accessibilityState={{selected:selectedPage===item.page}} onPress={() => {
            if (selectedPage === item.page && currentPage === item.page) return;
            setSplitSettingsStack([item.page]);
          }} style={({pressed}) => ({minHeight:52,paddingHorizontal:12,flexDirection:'row',alignItems:'center',gap:12,borderRadius:10,backgroundColor:selectedPage===item.page ? colors.line : 'transparent',opacity:pressed ? 0.65 : 1})}>
            {settingsIcon(item.page)}<Text style={{fontSize:16,fontWeight:selectedPage===item.page?'600':'400',color:colors.ink,flex:1}}>{item.label}</Text>
          </Pressable>)}
        </ScrollView>
        </TabSafeAreaView>
      </SafeAreaView>
      <View style={{flex:1}}>{renderSettingsPage(currentPage,true)}</View>
    </View>;
  };
  const chaptersContent = <View style={{flex:1,backgroundColor:colors.paper}}><FlatList<NavigationItem> data={chapterItems} keyExtractor={item => item.key} contentContainerStyle={{paddingHorizontal:28,paddingBottom:24}} contentInsetAdjustmentBehavior="automatic" renderItem={({item}) => <Pressable accessibilityRole="button" onPress={() => selectChapter(item.idx)} style={({pressed}) => [styles.row, pressed && {opacity:0.65}]}><View style={{flex:1}}><Text style={styles.rowLabel}>{item.detail}</Text><Text style={styles.rowTitle} numberOfLines={2}>{item.title}</Text>{item.progress && <View style={styles.chapterProgress}><View style={styles.progressLabels}><Text style={styles.progressText}>{item.progress.label}</Text><Text style={styles.progressText}>{item.progress.percent}%</Text></View><View accessibilityRole="progressbar" accessibilityLabel={`${appLanguage==='hi'?'पढ़ने की स्थिति':'Reading position'}: ${item.progress.label}`} accessibilityValue={{min:0,max:100,now:item.progress.percent}} style={styles.progressTrack}><View style={[styles.progressFill,{width:`${item.progress.percent}%`}]}/></View></View>}</View></Pressable>}/></View>;
  const bookInfoContent = <ScrollView contentContainerStyle={{padding:24,gap:16,backgroundColor:colors.white,flexGrow:1}}>
      <Pressable accessibilityRole="button" accessibilityLabel={t("Close book information")} onPress={() => router.back()} style={{alignSelf:'flex-end',padding:12}}><SymbolView name={{ios:'xmark',android:'close',web:'close'}} size={20} tintColor={colors.ink}/></Pressable>
        {bookInfo && <><Text accessibilityRole="header" style={styles.bookTitle}>{appLanguage === 'hi' ? `${t(bookInfo.title)} के बारे में` : `About ${bookInfo.title}`}</Text>
          <Text style={styles.bookDetail}>{bookInfo.id === GITA_BOOK_ID ? t("Sanskrit with Hindi and English translations by Hansi Gita Bhawan Trust.") : t("Sanskrit and English from the Itihasa corpus. This historic edition was digitised using OCR and may contain errors; some source passages contain multiple verses.")}</Text>
          <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(bookInfo.id === GITA_BOOK_ID ? 'https://gitabhawan.org.in/gita/research' : 'https://aclanthology.org/2021.wat-1.22/')} style={styles.button}><Text style={{color:colors.accent}}>{t("View source and credits ↗")}</Text></Pressable>
          {installedBooks[bookInfo.id] && <Pressable accessibilityRole="button" onPress={() => {const book=bookInfo; router.back(); setTimeout(() => confirmRemoveBook(book), 400);}} style={[styles.button,{borderWidth:1,borderColor:colors.line,alignItems:'center'}]}><Text style={{color:colors.accent,fontWeight:'600'}}>{t("Remove download")}</Text></Pressable>}
        </>}
    </ScrollView>;
  const dictionaryContent = <ScrollView style={{flex:1,backgroundColor:colors.white}} contentContainerStyle={styles.dictionaryContent} contentInsetAdjustmentBehavior="never">
        <View style={{flexDirection:'row',alignItems:'center',gap:12}}><Text accessibilityRole="header" style={{flex:1,fontSize:24,fontWeight:'600',color:colors.ink}}>{dictionaryWord}</Text><Pressable accessibilityRole="button" accessibilityLabel={t("Close dictionary")} onPress={closeDictionary} style={{width:44,height:44,alignItems:'center',justifyContent:'center'}}><SymbolView name={{ios:'xmark',android:'close',web:'close'}} size={20} tintColor={colors.ink}/></Pressable></View>
          {dictionaryStatus === 'prompt' && <><Text style={styles.dictionaryBody}>{t("Download the English dictionary once to look up words offline.")}</Text><Text style={styles.dictionaryMeta}>{t("About 10 MB")}</Text><Pressable accessibilityRole="button" onPress={() => dictionaryWord && void showWord(dictionaryWord, dictionaryLanguage, true)} style={[styles.button,styles.buttonPrimary,styles.doneButton]}><Text style={styles.selectedText}>{t("Download dictionary")}</Text></Pressable></>}
          {dictionaryStatus === 'loading' && <View style={styles.dictionaryLoading}><ActivityIndicator color={colors.accent}/><Text style={styles.dictionaryBody}>{dictionaryDownload !== null ? `${t("Downloading dictionary ·")} ${Math.round(dictionaryDownload*100)}%` : t("Looking up word…")}</Text></View>}
          {dictionaryStatus === 'unsupported' && <Text style={styles.dictionaryBody}>{Platform.OS === 'web' ? t("Dictionary lookup is available in the mobile app.") : dictionaryLanguage === 'hi' ? t("Hindi dictionary lookup is not available yet.") : t("Sanskrit dictionary lookup is not available yet.")}</Text>}
          {dictionaryStatus === 'error' && <><Text style={styles.dictionaryBody}>{dictionaryError}</Text><Pressable accessibilityRole="button" onPress={() => dictionaryWord && void showWord(dictionaryWord, dictionaryLanguage, true)} style={[styles.button,styles.buttonPrimary,styles.doneButton]}><Text style={styles.selectedText}>{t("Try again")}</Text></Pressable></>}
          {dictionaryStatus === 'results' && (meanings.length ? meanings.map(group => <View key={group.partOfSpeech} style={styles.dictionaryGroup}><Text style={styles.preferenceLabel}>{group.partOfSpeech}</Text>{group.definitions.map((definition, i) => <Text key={i} style={styles.dictionaryBody}>{i + 1}. {definition}</Text>)}</View>) : <Text style={styles.dictionaryBody}>{t("No definition found for this word.")}</Text>)}
      </ScrollView>;
  function cancelPendingLanguageTap() {
    if (pendingLanguageTap.current) clearTimeout(pendingLanguageTap.current.timer);
    pendingLanguageTap.current=null;
  }
  function switchReadingLanguage() {
    cancelPendingLanguageTap();
    activeSelection.current=null;
    setSelectedWord(null);
    previousWordTap.current=null;
    const next=activeBook.languages[(activeBook.languages.indexOf(language)+1)%activeBook.languages.length];
    setLanguage(next);
    void setting('language',next);
  }
  function toggleReadingMusic() {
    cancelPendingLanguageTap();
    if (musicFailed && musicEnabled) {retryMusic(); return;}
    const next=!musicEnabled;
    setMusicEnabled(next);
    if (!next) setMusicError(false);
    void setting('music-enabled',String(next));
  }
  function toggleReaderNarration() {
    cancelPendingLanguageTap();
    if (readAloudRef.current) pauseReadAloud();
    else toggleReadAloud(true);
  }
  function handlePassageTap(event:GestureResponderEvent, passageId:string) {
    const start=passageTapStart.current;
    passageTapStart.current=null;
    if (!start || start.passageId!==passageId || Date.now()-start.time>350 || Math.hypot(event.nativeEvent.pageX-start.x,event.nativeEvent.pageY-start.y)>12 || activeSelection.current || pinch.current) return;
    const tap={time:Date.now(),x:event.nativeEvent.pageX,y:event.nativeEvent.pageY,passageId};
    const pending=pendingLanguageTap.current;
    if (pending) {
      clearTimeout(pending.timer);
      pendingLanguageTap.current=null;
      if (isDoubleTap(pending.tap,tap)) return;
    }
    const timer=setTimeout(() => {
      pendingLanguageTap.current=null;
      if (!activeSelection.current) switchReadingLanguage();
    }, 370);
    pendingLanguageTap.current={tap,timer};
  }
  // Reserve the native back button, chapter button, header margins and a 16-point gap.
  const compactReaderControls=width-insets.left-insets.right < 48+44+languageControlWidth+44*3+8*3+32+16;
  const narrationUnavailable=!windowRows[index];
  const musicActionLabel=waitingForMusic ? t("Loading reading music") : musicFailed && musicEnabled ? t("Music unavailable. Tap to retry") : musicEnabled ? t("Mute reading music") : t("Unmute reading music");
  const narrationActionLabel=readAloud ? t("Pause read aloud") : t("Play read aloud");
  const readerHeaderLeft = <Pressable accessibilityRole="button" accessibilityLabel={t("Chapters")} onPress={() => {cancelPendingLanguageTap(); router.push('/chapters');}} style={styles.profileButton}>
          <SymbolView name={{ios:'list.bullet',android:'list',web:'list'}} tintColor={colors.ink} size={23}/>
        </Pressable>;
  const readerHeaderRight = <View style={{flexDirection:'row',alignItems:'center',gap:8}}>{compactReaderControls ? <>{Platform.OS==='web' ? <Pressable accessibilityRole="button" accessibilityLabel={appLanguage==='hi'?'ऑडियो नियंत्रण':'Audio controls'} onPress={() => {cancelPendingLanguageTap(); setWebAudioMenuOpen(true);}} style={styles.profileButton}><SymbolView name={{ios:'slider.horizontal.3',android:'tune',web:'tune'}} tintColor={colors.ink} size={22}/></Pressable> : <MenuView title={appLanguage==='hi'?'ऑडियो नियंत्रण':'Audio controls'} style={styles.profileButton} actions={[{id:'music',title:musicActionLabel,attributes:{disabled:waitingForMusic}},{id:'narration',title:narrationActionLabel,attributes:{disabled:narrationUnavailable}}]} onOpenMenu={() => {cancelPendingLanguageTap(); setReaderMenuOpen(true);}} onCloseMenu={() => setReaderMenuOpen(false)} onPressAction={event => {setReaderMenuOpen(false); if(event.nativeEvent.event==='music') toggleReadingMusic(); else if(event.nativeEvent.event==='narration') toggleReaderNarration();}}><View accessible accessibilityRole="button" accessibilityLabel={appLanguage==='hi'?'ऑडियो नियंत्रण':'Audio controls'} style={styles.profileButton}><SymbolView name={{ios:'slider.horizontal.3',android:'tune',web:'tune'}} tintColor={colors.ink} size={22}/></View></MenuView>}</> : <><Pressable accessibilityRole="button" accessibilityLabel={waitingForMusic ? t("Loading reading music") : musicFailed && musicEnabled ? t("Music unavailable. Tap to retry") : musicEnabled ? t("Mute reading music") : t("Unmute reading music")} accessibilityState={{disabled:waitingForMusic}} disabled={waitingForMusic} onPress={toggleReadingMusic} style={styles.profileButton}>{waitingForMusic ? <ActivityIndicator color={colors.ink} size="small"/> : musicFailed && musicEnabled ? <Text style={{color:colors.ink,fontSize:22,fontWeight:'600'}}>!</Text> : <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={colors.ink} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><Path d="M11 5 6 9H3v6h3l5 4V5Z"/>{musicEnabled ? <Path d="M15 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12"/> : <Path d="m16 9 5 6m0-6-5 6"/>}</Svg>}</Pressable><Pressable accessibilityRole="button" accessibilityLabel={narrationActionLabel} accessibilityState={{disabled:narrationUnavailable}} disabled={narrationUnavailable} onPress={toggleReaderNarration} style={styles.profileButton}><Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={colors.ink} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">{readAloud ? <Path d="M9 5v14M15 5v14"/> : <Path d="M8 5v14l11-7L8 5z"/>}</Svg></Pressable></>}
        <Pressable accessibilityRole="button" accessibilityLabel={`${appLanguage === 'hi' ? 'पाठ की भाषा बदलें। वर्तमान:' : 'Switch reading language. Current:'} ${language === 'en' ? t("English") : language === 'hi' ? t("Hindi") : t("Sanskrit")}`} onPress={switchReadingLanguage} onLayout={event => setLanguageControlWidth(event.nativeEvent.layout.width)} style={styles.language}><Text style={styles.languageText}>{language === 'en' ? t("English ▾") : language === 'hi' ? 'हिन्दी ▾' : 'संस्कृत ▾'}</Text></Pressable>
        {Platform.OS==='web' ? <Pressable accessibilityRole="button" accessibilityLabel={t("Book menu")} accessibilityState={{expanded:readerMenuOpen}} onPress={() => {cancelPendingLanguageTap(); setReaderMenuOpen(true);}} style={styles.profileButton}><Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={colors.ink} strokeWidth={2.5} strokeLinecap="round"><Path d="M5 12h.01M12 12h.01M19 12h.01"/></Svg></Pressable> : <MenuView
          title={t(activeBook.title)} style={styles.profileButton}
          actions={[
            {id:'like',title:Object.hasOwn(saved,currentPassage.id) ? (appLanguage==='hi'?'पसंद हटाएँ':'Unlike this verse') : (appLanguage==='hi'?'पसंद करें':'Like this verse'),state:Object.hasOwn(saved,currentPassage.id)?'on':'off'},
            {id:'note',title:notes[currentPassage.id] ? (appLanguage==='hi'?'नोट बदलें':'Edit note') : (appLanguage==='hi'?'नोट लिखें':'Write a note')},
            {id:'saved',title:t("Saved verses and notes")},
            {id:'images',title:appLanguage==='hi'?'अध्याय के चित्र':'Chapter images'},
            {id:'shuffle',title:appLanguage==='hi'?'चित्रों को फिर से बदलें':'Shuffle images'},
            {id:'settings',title:t('Settings')},
          ]}
          onOpenMenu={() => {cancelPendingLanguageTap(); setReaderMenuOpen(true);}} onCloseMenu={() => setReaderMenuOpen(false)}
          onPressAction={event => {
            setReaderMenuOpen(false);
            if (event.nativeEvent.event==='like') void toggle(currentPassage);
            else if (event.nativeEvent.event==='note') openNote(currentPassage.id);
            else if (event.nativeEvent.event==='saved') {savedFromReaderMenu.current=false; setScreen('saved'); router.push('/saved');}
            else if (event.nativeEvent.event==='images') openChapterImages(null);
            else if (event.nativeEvent.event==='shuffle') shuffleChapterImages(activeBook,passages[index]?.chapter);
            else if (event.nativeEvent.event==='settings') router.navigate('/settings');
          }}>
          <View accessible accessibilityRole="button" accessibilityLabel={t("Book menu")} style={styles.profileButton}><SymbolView name={{ios:'ellipsis',android:'more_horiz',web:'more_horiz'}} tintColor={colors.ink} size={22}/></View>
        </MenuView>}</View>;
  const renderBookScreen = (view:Screen) => <SafeAreaView style={styles.root} edges={view === 'read' ? ['left','right'] : undefined}
    onTouchStartCapture={startPinch}
    onTouchMoveCapture={movePinch}
    onTouchEndCapture={finishPinch}
    onTouchCancelCapture={finishPinch}
    onTouchCancel={() => {setTouchingReader(false); setInteractionCount(count => count + 1);}}
    onTouchStart={event => {
      setTouchingReader(true);
      const selection = activeSelection.current;
      touchStart.current = event.nativeEvent.touches.length===1 && selection && view === 'read' && isBooksActive && !readerMenuOpen && dictionaryWord === null ? {x:event.nativeEvent.pageX,y:event.nativeEvent.pageY,time:Date.now(),selection} : null;
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
    }}>{view === screen && <StatusBar animated hidden={view === 'read' && immersive} style={colors.dark ? "light" : "dark"} />}
    {!(view === 'read' && immersive) && voiceDownload !== null && <View accessibilityRole="progressbar" accessibilityLabel={t("Downloading reading voice")} accessibilityValue={{min:0,max:100,now:Math.round(voiceDownload*100)}} style={styles.downloadBanner}><ActivityIndicator color={colors.accent}/><Text style={styles.downloadBannerText}>{t("Downloading voice ·")} {Math.round(voiceDownload*100)}%</Text><Pressable accessibilityRole="button" onPress={cancelVoiceDownload}><Text style={styles.downloadCancel}>{t("Cancel")}</Text></Pressable></View>}
    {!(view === 'read' && immersive) && dictionaryDownload !== null && dictionaryWord === null && <View accessibilityRole="progressbar" accessibilityLabel={t("Downloading English dictionary")} accessibilityValue={{min:0,max:100,now:Math.round(dictionaryDownload*100)}} style={styles.downloadBanner}><ActivityIndicator color={colors.accent}/><Text style={styles.downloadBannerText}>{t("Downloading dictionary ·")} {Math.round(dictionaryDownload*100)}%</Text></View>}
    <>
    {view === 'read' ? <>{!immersive && <>
      {!readAloud && autoScrollEnabled && <View style={styles.playbackStatus}><AutoScrollCountdown key={`${index}-${interactionCount}-${autoScrollSeconds}-${autoScrollRunning}`} seconds={autoScrollSeconds} active={autoScrollRunning} finished={autoScrollFinished} colors={colors}/></View>}
    </>}</> : null}
    <View ref={view === 'read' ? readerView : undefined} collapsable={false} style={styles.main} onLayout={e => {if (view === 'read') setReaderHeight(e.nativeEvent.layout.height);}}>
      {view === 'read' && useBookImages && activeImages.length > 0 && <View pointerEvents="none" style={styles.fixedBackground}>
        <Image source={currentBackground?.source} style={styles.backgroundImage} resizeMode="cover" />
        {imageFilters.length > 0 && <FilterImage key={`${width}-${readerHeight}`} source={currentBackground?.source} style={styles.filteredBackgroundImage} resizeMode="cover" filters={imageFilters}/>}
        <View style={styles.backgroundScrim}/>
      </View>}
      {view === 'read' ? <><FlatList key={`${activeBook.id}-${readerHeight}-${width}`} ref={list} data={passages} extraData={textWindow} initialScrollIndex={index} getItemLayout={(_, i) => ({length: readerHeight, offset: readerHeight * i, index: i})} pagingEnabled scrollEnabled={sharingId === null && !pinching && !chapterScrubbing} showsVerticalScrollIndicator={false} keyExtractor={p => p.id} onMomentumScrollEnd={e => { const next = Math.max(0, Math.min(passages.length - 1, Math.round(e.nativeEvent.contentOffset.y / readerHeight))); rememberPosition(next); }} renderItem={({item:metadata, index:rowIndex}) => { const loaded = windowRows[rowIndex] ? {...metadata,...windowRows[rowIndex]} : metadata; const item = loaded; const loading = !windowRows[rowIndex]; return <View onTouchStart={event => {passageTapStart.current=screen==='read' && isBooksActive && rowIndex===index && !ignorePassageTap.current && event.nativeEvent.touches.length===1 && !activeSelection.current && !readerMenuOpen && !webAudioMenuOpen && dictionaryWord===null ? {x:event.nativeEvent.pageX,y:event.nativeEvent.pageY,time:Date.now(),passageId:item.id} : null;}} onTouchEnd={event => {handlePassageTap(event,item.id); ignorePassageTap.current=false;}} onTouchCancel={() => {passageTapStart.current=null; ignorePassageTap.current=false;}} style={[styles.page, useBookImages && styles.transparentPage, {height: readerHeight,paddingTop:immersive ? Math.max(24,insets.top+12) : 24,paddingBottom:Math.max(24,insets.bottom+12)}]}>
        {loading && <View style={{position:'absolute',alignSelf:'center',top:'45%'}}>{bookTextError ? <Text style={{color:colors.muted}}>{t("Could not load this passage. Please reopen the book.")}</Text> : <ActivityIndicator color={colors.accent}/>}</View>}

        <PassageBody key={`${item.id}-${language}-${fontSize}-${width}-${fontScale}-${loading}`} active={rowIndex===index} registerNavigation={registerContinuation} onPartChange={onContinuationChange} text={item[language]} fontSize={fontSize} pageContentHeight={Math.max(0,readerHeight-2*(immersive ? Math.max(24,insets.top+12) : 24))} textStyle={[styles.passage, useBookImages && styles.imagePassage]} continuationColor={useBookImages ? '#ffffff' : colors.muted}
          renderText={(chunk, offset, size) => <Text accessibilityLabel={chunk} accessibilityHint={t("Use the copy passage action to copy all text.")} accessibilityActions={[{name:'copyPassage', label:t("Copy passage")},{name:'toggleImmersive',label:immersive ? (appLanguage==='hi'?'रीडिंग नियंत्रण दिखाएँ':'Show reading controls') : (appLanguage==='hi'?'पूर्ण स्क्रीन में पढ़ें':'Read full screen')}]} onAccessibilityAction={event => {if (event.nativeEvent.actionName === 'toggleImmersive') changeImmersive(!immersive); if (event.nativeEvent.actionName === 'copyPassage') void Clipboard.setStringAsync(item[language]).catch(() => Alert.alert(t("Could not copy text"), t("Please try again.")));}} selectable={true} style={[styles.passage, useBookImages && styles.imagePassage, {fontSize:size,lineHeight:Math.round(size*1.5)}]}>
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
        {!immersive && <ReaderBottomArea paddingBottom={Platform.OS === 'web' ? 0 : Math.max(insets.bottom,16)}><View style={styles.pageBottom}><View onTouchStart={() => {ignorePassageTap.current=true; cancelPendingLanguageTap();}} style={[styles.actions,{marginBottom:72},sharingId === item.id && styles.hiddenActions]}><Pressable accessibilityRole="button" accessibilityLabel={Object.hasOwn(saved,item.id) ? (appLanguage==='hi'?'पसंद हटाएँ':'Unlike verse') : (appLanguage==='hi'?'पसंद करें':'Like verse')} accessibilityState={{selected:Object.hasOwn(saved,item.id)}} onPress={() => void toggle(item)} style={styles.action}><SymbolView name={{ios:Object.hasOwn(saved,item.id)?'heart.fill':'heart',android:Object.hasOwn(saved,item.id)?'favorite':'favorite_border',web:Object.hasOwn(saved,item.id)?'favorite':'favorite_border'}} tintColor={colors.accent} size={22}/></Pressable><Pressable accessibilityRole="button" accessibilityLabel={notes[item.id] ? (appLanguage==='hi'?'नोट बदलें':'Edit note') : (appLanguage==='hi'?'नोट लिखें':'Write a note')} onPress={() => openNote(item.id)} style={styles.action}><SymbolView name={{ios:notes[item.id]?'bubble.left.fill':'bubble.left',android:notes[item.id]?'chat_bubble':'chat_bubble_outline',web:notes[item.id]?'chat_bubble':'chat_bubble_outline'}} tintColor={colors.accent} size={22}/></Pressable><Pressable accessibilityRole="button" accessibilityLabel={t("Share passage image")} accessibilityState={{busy:sharingId===item.id}} disabled={sharingId!==null || loading} onPress={() => void sharePassage(item)} style={styles.action}><SymbolView name={{ios:'paperplane',android:'send',web:'send'}} tintColor={colors.accent} size={22}/></Pressable></View></View></ReaderBottomArea>}
      </View>; }}/>{!immersive && passages[index] && (() => {
        const item=passages[index];
        const bounds=chapterBounds(passages,item.chapter);
        if (!bounds) return null;
        const {first,count}=bounds;
        const reference=activeBook.id === GITA_BOOK_ID ? `${appLanguage === 'hi' ? 'गीता' : activeBook.shortTitle} ${item.chapter}.${item.label.replace(/^TEXTS?\s+/i, '')}` : `${localChapter(item.chapterTitle)} · ${appLanguage === 'hi' ? item.label.replace('PASSAGE','अंश') : item.label.toLowerCase()}`;
        const referenceLabel=activeBook.id === GITA_BOOK_ID ? `${activeBook.title}, chapter ${item.chapter}, ${item.label}` : `${activeBook.title}, ${item.chapterTitle}, ${item.label}`;
        return <ChapterScrubber current={index-first} count={count} bottom={Math.max(24,insets.bottom+12)+(Platform.OS === 'web' ? 0 : Math.max(insets.bottom,16))-12} light={useBookImages} active={chapterScrubbing} label={appLanguage==='hi'?'अध्याय में स्थिति':'Chapter position'} reference={reference} referenceLabel={referenceLabel} hint={appLanguage==='hi'?'अंश बदलने के लिए छुएँ और खींचें।':'Touch and drag to change passage.'} referenceStyle={[styles.reference,useBookImages && styles.imageReference,{textAlign:'center'}]} onActiveChange={active => {if (active) cancelPendingLanguageTap(); setChapterScrubbing(active);}} onPreview={position => {const target=first+position; list.current?.scrollToIndex({index:target,animated:false}); setIndex(target);}} onSelect={position => {const target=first+position; rememberPosition(target); requestAnimationFrame(() => list.current?.scrollToIndex({index:target,animated:false}));}}/>;
      })()}</>  : view === 'books' ? <View style={styles.section}>
        <FlatList data={books} keyExtractor={book => book.id} renderItem={({item}) => {
          const last = lastByBook[item.id] ? item.passages.find(p => p.id === lastByBook[item.id]) : undefined;
          const installed = !!installedBooks[item.id];
          const downloading = bookDownload?.id === item.id;
          const progress = downloading ? Math.round(bookDownload.progress*100) : 0;
          return <View style={styles.bookRow}>
            <Pressable accessibilityRole="button" accessibilityLabel={`${t(item.title)} ${installed ? (appLanguage==='hi' ? 'खोलें' : 'open') : (appLanguage==='hi' ? 'डाउनलोड करें' : 'download')}`} onPress={() => openBook(item)} onLongPress={() => openBookInfo(item)} style={{flexDirection:'row',alignItems:'center',gap:18,flex:1}}>
              <View style={{width:76,height:114,borderRadius:5,overflow:'hidden'}}>
                <Image source={item.cover} style={styles.bookCover} resizeMode="cover" blurRadius={installed ? 0 : 3} accessibilityIgnoresInvertColors accessible={false}/>
                {downloading && <View accessibilityRole="progressbar" accessibilityLabel={`${t(item.title)} ${appLanguage==='hi'?'डाउनलोड हो रही है':'downloading'}`} accessibilityValue={{min:0,max:100,now:progress}} style={{position:'absolute',top:0,bottom:0,left:0,right:0,backgroundColor:'rgba(0,0,0,0.48)',alignItems:'center',justifyContent:'center'}}><Text style={{color:'#fff',fontSize:17,fontWeight:'700'}}>{progress}%</Text><View style={{width:48,height:3,backgroundColor:'rgba(255,255,255,0.4)',marginTop:8,borderRadius:2}}><View style={{width:`${progress}%`,height:3,backgroundColor:'#fff',borderRadius:2}}/></View></View>}
              </View>
              <View style={{flex:1}}><Text style={styles.bookTitle}>{t(item.title)}</Text><Text style={styles.bookDetail}>{!installed ? `${(bookDownloads[item.id].bytes/1000000).toFixed(1)} MB · ${item.languages.includes('hi') ? t("Hindi, English & Sanskrit") : t("English & Sanskrit")}` : last ? `${appLanguage==='hi'?'जारी रखें':'Continue'} · ${localChapter(last.chapterTitle)}` : `${item.chapters.length} ${appLanguage==='hi'?'अध्याय':'chapters'}`}</Text></View>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`${t(item.title)} ${appLanguage==='hi'?'की जानकारी':'information'}`} onPress={() => openBookInfo(item)} style={{width:44,height:48,alignItems:'center',justifyContent:'center'}}><Svg width={24} height={24} viewBox="0 0 24 24" fill={colors.muted}><Circle cx={5} cy={12} r={1.8}/><Circle cx={12} cy={12} r={1.8}/><Circle cx={19} cy={12} r={1.8}/></Svg></Pressable>
            {!installed ? <Pressable accessibilityRole="button" accessibilityLabel={`${t(item.title)} ${appLanguage==='hi'?'डाउनलोड करें':'download'}`} accessibilityState={{busy:downloading}} onPress={() => {if (!downloading) void installBook(item);}} style={{width:48,height:48,alignItems:'center',justifyContent:'center'}}><Svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke={colors.accent} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><Path d="M12 3v12m-5-5 5 5 5-5M5 19h14"/></Svg></Pressable> : <Pressable accessibilityRole="button" accessibilityLabel={`${t(item.title)} ${appLanguage==='hi'?'खोलें':'open'}`} onPress={() => openBook(item)} style={{width:48,height:48,alignItems:'center',justifyContent:'center'}}><Text accessible={false} style={styles.arrow}>›</Text></Pressable>}
          </View>;
        }}/>
      </View> : <View style={styles.section}><FlatList<NavigationItem> data={view === 'chapters' ? chapterItems : passages.filter(p => Object.hasOwn(saved, p.id) || Object.hasOwn(notes,p.id)).map(p => ({key: p.id, title: (savedText[p.id]?.[language] ?? p[language]) || p.label, detail: notes[p.id] || p.label, progress: undefined, idx: passages.indexOf(p)}))} keyExtractor={item => item.key} ListEmptyComponent={<Text style={styles.empty}>{t("Nothing saved yet. Tap the heart while reading to save a passage.")}</Text>} renderItem={({item}) => <Pressable accessibilityRole="button" onPress={() => jump(item.idx)} style={styles.row}><View style={{flex: 1}}><Text style={styles.rowLabel}>{item.detail}</Text><Text style={styles.rowTitle} numberOfLines={2}>{item.title}</Text>{item.progress && <View style={styles.chapterProgress}>
          <View style={styles.progressLabels}><Text style={styles.progressText}>{item.progress.label}</Text><Text style={styles.progressText}>{item.progress.percent}%</Text></View>
          <View accessibilityRole="progressbar" accessibilityLabel={`${appLanguage==='hi'?'पढ़ने की स्थिति':'Reading position'}: ${item.progress.label}`} accessibilityValue={{min:0,max:100,now:item.progress.percent}} style={styles.progressTrack}><View style={[styles.progressFill,{width:`${item.progress.percent}%`}]}/></View>
        </View>}</View>{view !== 'chapters' && <Text style={styles.arrow}>↗</Text>}</Pressable>}/></View>}
    </View>
    </>
    <BottomSheet isPresented={view === 'read' && view === screen && pathname === '/reader' && walkthroughVisible && walkthroughSheetOpen} onDismiss={() => {if (pathname === '/reader' && view === screen) void finishWalkthrough();}} snapPoints={['half','full']} containerColor={colors.white} contentPadding={0}>
      <RNHostView><ScrollView nestedScrollEnabled style={{height:Math.max(200,Math.min(height*0.5-48,500))}} contentContainerStyle={{paddingHorizontal:24,paddingTop:8,paddingBottom:32}}><View accessibilityViewIsModal style={{gap:20,maxWidth:480,width:'100%',alignSelf:'center'}}>
          <View style={{gap:8}}><Text accessibilityRole="header" style={{fontSize:22,fontWeight:'700',color:colors.ink}}>{appLanguage==='hi'?'पूरी स्क्रीन पर पढ़ें':'Read full screen'}</Text><Text style={{fontSize:15,lineHeight:23,color:colors.muted}}>{appLanguage==='hi'?'पढ़ते समय दो उंगलियों से स्क्रीन पर पिंच करें।':'Use two fingers while reading to change the view.'}</Text></View>
          <View style={{gap:16}}><View style={{flexDirection:'row',alignItems:'center',gap:16}}><Svg width={38} height={38} viewBox="0 0 24 24" fill="none" stroke={colors.accent} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><Path d="M8 8 3 3m0 0v4m0-4h4M16 16l5 5m0 0v-4m0 4h-4"/></Svg><View style={{flex:1,gap:4}}><Text style={styles.settingsMenuTitle}>{appLanguage==='hi'?'उंगलियाँ फैलाएँ':'Spread fingers apart'}</Text><Text style={styles.settingsMenuDescription}>{appLanguage==='hi'?'पूरी स्क्रीन पर पढ़ें।':'Hide controls for full-screen reading.'}</Text></View></View>
          <View style={{flexDirection:'row',alignItems:'center',gap:16}}><Svg width={38} height={38} viewBox="0 0 24 24" fill="none" stroke={colors.accent} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><Path d="M3 3l5 5m0 0V4m0 4H4m17 13-5-5m0 0v4m0-4h4"/></Svg><View style={{flex:1,gap:4}}><Text style={styles.settingsMenuTitle}>{appLanguage==='hi'?'उंगलियाँ पास लाएँ':'Pinch fingers together'}</Text><Text style={styles.settingsMenuDescription}>{appLanguage==='hi'?'रीडिंग नियंत्रण वापस लाएँ।':'Bring the reading controls back.'}</Text></View></View></View>
          <Text style={{fontSize:13,lineHeight:20,color:colors.muted}}>{appLanguage==='hi'?'इसे आप सेटिंग में फिर से देख सकते हैं।':'You can reset this guide in Settings.'}</Text>
          <View style={{flexDirection:'row',alignItems:'center',justifyContent:'flex-end',gap:12,flexWrap:'wrap'}}><Pressable accessibilityRole="button" disabled={walkthroughSaving} onPress={() => void finishWalkthrough()} style={styles.button}><Text style={{fontSize:15,color:colors.muted}}>{appLanguage==='hi'?'छोड़ें':'Skip'}</Text></Pressable><Pressable accessibilityRole="button" disabled={walkthroughSaving} onPress={() => void finishWalkthrough()} style={[styles.button,styles.buttonPrimary]}><Text style={{fontSize:15,fontWeight:'600',color:colors.onAccent}}>{appLanguage==='hi'?'समझ गया':'Got it'}</Text></Pressable></View>
        </View></ScrollView></RNHostView>
    </BottomSheet>
    {view==='read' && isBooksActive && !readerMenuOpen && !!shuffleMessage && <View pointerEvents="none" style={{position:'absolute',top:insets.top+70,alignSelf:'center',maxWidth:'85%',paddingVertical:10,paddingHorizontal:16,borderRadius:22,backgroundColor:colors.white,borderWidth:1,borderColor:colors.line,shadowColor:'#000',shadowOpacity:0.14,shadowRadius:8,shadowOffset:{width:0,height:3},elevation:5}}><Text accessibilityLiveRegion="polite" style={{color:colors.ink,fontSize:14,textAlign:'center'}}>{shuffleMessage}</Text></View>}
    {Platform.OS==='web' && webAudioMenuOpen && <View style={styles.readerMenuOverlay}>
      <Pressable accessibilityRole="button" accessibilityLabel={appLanguage==='hi'?'बंद करें':'Close controls'} onPress={() => setWebAudioMenuOpen(false)} style={styles.readerMenuBackdrop}/>
      <View style={styles.sheet}>
        <Pressable accessibilityRole="button" disabled={waitingForMusic} onPress={() => {setWebAudioMenuOpen(false); toggleReadingMusic();}} style={styles.settingsListRow}><Text style={styles.readerMenuItem}>{musicActionLabel}</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={narrationUnavailable} onPress={() => {setWebAudioMenuOpen(false); toggleReaderNarration();}} style={styles.settingsListRow}><Text style={styles.readerMenuItem}>{narrationActionLabel}</Text></Pressable>
      </View>
    </View>}
    {Platform.OS==='web' && readerMenuOpen && <View style={styles.readerMenuOverlay}>
      <Pressable accessibilityRole="button" accessibilityLabel={t("Close book menu")} onPress={() => setReaderMenuOpen(false)} style={styles.readerMenuBackdrop}/>
      <View style={styles.sheet}>
        <Text accessibilityRole="header" style={styles.readerMenuTitle}>{t(activeBook.title)}</Text>
        <Pressable accessibilityRole="button" onPress={() => {setReaderMenuOpen(false); void toggle(currentPassage);}} style={({pressed}) => [styles.settingsListRow, pressed && {opacity:0.65}]}><Text style={styles.readerMenuItem}>{Object.hasOwn(saved,currentPassage.id) ? (appLanguage==='hi'?'पसंद हटाएँ':'Unlike this verse') : (appLanguage==='hi'?'पसंद करें':'Like this verse')}</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => {setReaderMenuOpen(false); openNote(currentPassage.id);}} style={({pressed}) => [styles.settingsListRow, pressed && {opacity:0.65}]}><Text style={styles.readerMenuItem}>{notes[currentPassage.id] ? (appLanguage==='hi'?'नोट बदलें':'Edit note') : (appLanguage==='hi'?'नोट लिखें':'Write a note')}</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => {setReaderMenuOpen(false); savedFromReaderMenu.current=true; setScreen('saved'); router.push('/saved');}} style={({pressed}) => [styles.settingsListRow, pressed && {opacity:0.65}]}><Text style={styles.readerMenuItem}>{t("Saved verses and notes")}</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => openChapterImages(null)} style={({pressed}) => [styles.settingsListRow, pressed && {opacity:0.65}]}><Text style={styles.readerMenuItem}>{appLanguage==='hi'?'अध्याय के चित्र':'Chapter images'}</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => {setReaderMenuOpen(false); shuffleChapterImages(activeBook,passages[index]?.chapter);}} style={({pressed}) => [styles.settingsListRow, pressed && {opacity:0.65}]}><Text style={styles.readerMenuItem}>{appLanguage==='hi'?'चित्रों को फिर से बदलें':'Shuffle images'}</Text><Text style={styles.settingsChevron}>↻</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => {setReaderMenuOpen(false); router.navigate('/settings');}} style={({pressed}) => [styles.settingsListRow, pressed && {opacity:0.65}]}><Text style={styles.readerMenuItem}>{t("Settings")}</Text></Pressable>
      </View>
    </View>}
  </SafeAreaView>;
  return <ReaderSectionsContext.Provider value={{renderBookScreen,activateBookScreen,readerHeaderLeft,readerHeaderRight,immersive,chapterScrubbing,chaptersContent,renderSettings,colorTheme,bookInfoContent,dictionaryContent,clearBookInfo:() => setBookInfo(null),clearDictionary,noteEditor:editing === null ? null : {id:editing,initial:notes[editing] ?? '',save:saveNote,close:() => setEditing(null)},hideTabs:screen==='read' && ((isBooksActive && (Platform.OS!=='web' || immersive || readerMenuOpen)) || (Platform.OS!=='web' && (pathname==='/note-editor' || pathname==='/dictionary-sheet')))}}>{children}</ReaderSectionsContext.Provider>;
}
const createStyles = (colors: Palette) => StyleSheet.create({root:{flex:1,backgroundColor:colors.paper},loading:{flex:1,justifyContent:'center',backgroundColor:colors.paper},downloadBanner:{minHeight:48,flexDirection:"row",alignItems:"center",paddingHorizontal:20,gap:12,backgroundColor:colors.white},downloadBannerText:{flex:1,color:colors.ink,fontSize:14},downloadCancel:{color:colors.accent,fontSize:14,fontWeight:"600"},header:{paddingHorizontal:16,paddingTop:8,paddingBottom:8,flexDirection:'row',justifyContent:'space-between',alignItems:'center',borderBottomWidth:1,borderColor:colors.line},language:{paddingVertical:10,paddingHorizontal:14,backgroundColor:colors.white,borderRadius:24},languageText:{fontWeight:'600',color:colors.ink},readerBack:{fontSize:34,lineHeight:40,color:colors.ink},playbackStatus:{minHeight:30,alignItems:"center",justifyContent:"center",paddingBottom:6},readerMenuOverlay:{position:"absolute",top:0,right:0,bottom:0,left:0,justifyContent:"flex-end",zIndex:10},readerMenuBackdrop:{position:"absolute",top:0,right:0,bottom:0,left:0},readerMenuTitle:{fontFamily:"serif",fontSize:22,color:colors.ink,marginBottom:8},readerMenuItem:{flex:1,fontSize:16,fontWeight:"600",color:colors.ink},profileButton:{width:44,height:44,borderRadius:22,alignItems:'center',justifyContent:'center'},profileGlyph:{width:24,height:24,transform:[{scale:0.85}]},profileHead:{position:'absolute',top:1,left:8,width:8,height:8,borderWidth:1.5,borderColor:colors.ink,borderRadius:4},profileShoulders:{position:'absolute',bottom:2,left:3,width:18,height:10,borderWidth:1.5,borderColor:colors.ink,borderTopLeftRadius:10,borderTopRightRadius:10,borderBottomWidth:0},settingsScreen:{flex:1,backgroundColor:colors.paper},settingsNavigationHeader:{minHeight:64,flexDirection:'row',alignItems:'center',paddingHorizontal:16,borderBottomWidth:1,borderColor:colors.line},settingsBackButton:{width:44,height:48,alignItems:'center',justifyContent:'center',marginRight:8},settingsNavigationTitle:{flex:1,fontSize:20,fontWeight:'600',color:colors.ink},settingsList:{paddingHorizontal:24,paddingTop:16,paddingBottom:32},settingsCredits:{paddingTop:24,paddingBottom:16,gap:8},settingsCreditText:{fontSize:13,lineHeight:20,color:colors.muted},settingsCreditLink:{fontSize:13,lineHeight:20,color:colors.accent,textDecorationLine:"underline",alignSelf:"flex-start"},settingsListRow:{minHeight:80,flexDirection:'row',alignItems:'center',gap:16,paddingVertical:18,borderBottomWidth:1,borderColor:colors.line},choiceRow:{minHeight:68,flexDirection:'row',alignItems:'center',gap:16,paddingVertical:14,borderBottomWidth:1,borderColor:colors.line},choiceCheck:{fontSize:20,fontWeight:'600',color:colors.accent,minWidth:24,textAlign:'center'},paletteName:{flex:1,fontSize:16,color:colors.ink},paletteSwatches:{flexDirection:'row',gap:6},paletteSwatch:{width:24,height:24,borderRadius:12,borderWidth:1,borderColor:colors.line},colorHints:{gap:10},colorHint:{fontSize:14,lineHeight:21,color:colors.muted},colorHintStrong:{fontWeight:'600',color:colors.ink},settingsHeader:{flexDirection:'row',alignItems:'center',paddingHorizontal:20,paddingVertical:16,borderBottomWidth:1,borderColor:colors.line},settingsTitle:{flex:1,fontFamily:'serif',fontSize:24,color:colors.ink},backIcon:{fontSize:32,color:colors.ink,lineHeight:36},closeIcon:{fontSize:28,color:colors.muted},settingsMenu:{padding:24},settingsMenuRow:{minHeight:80,flexDirection:'row',alignItems:'center',gap:16,padding:20,borderRadius:16,backgroundColor:colors.white},settingsMenuText:{flex:1,gap:6},settingsMenuTitle:{fontSize:16,fontWeight:'600',color:colors.ink},settingsMenuDescription:{fontSize:14,color:colors.muted},settingsChevron:{fontSize:28,color:colors.muted},settingsContent:{gap:32,padding:24},preferenceGroup:{gap:16},readingGroup:{gap:12},readingHeading:{fontSize:17,lineHeight:24,fontWeight:'600',color:colors.ink},readingOptionTitle:{fontSize:16,lineHeight:24,fontWeight:'400',color:colors.ink},readingChoiceRow:{paddingLeft:8},preferenceLabel:{fontSize:14,fontWeight:'600',color:colors.ink},sizeOptions:{flexDirection:'row',gap:8},sizeOption:{flex:1,minHeight:88,borderRadius:12,backgroundColor:colors.paper,padding:12,alignItems:'center',justifyContent:'center',gap:8},selectedOption:{backgroundColor:colors.accent},selectedText:{color:colors.onAccent,fontWeight:'600'},sizeSample:{color:colors.ink},optionLabel:{fontSize:13,color:colors.muted},backgroundOption:{flex:1,alignItems:'center',gap:8,minHeight:72},imageSwatch:{overflow:'hidden',backgroundColor:colors.ink},swatchImage:{position:'absolute',width:'100%',height:'100%'},swatchCheck:{color:'#fff',fontSize:20,textShadowColor:'#000',textShadowRadius:4},imagePreview:{height:136,borderRadius:14,overflow:'hidden',justifyContent:'center',alignItems:'center',backgroundColor:'#181818'},imagePreviewText:{fontFamily:'serif',fontSize:20,color:'#fff'},blurHeading:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},blurSlider:{width:'100%',height:44,marginTop:8},blurLabels:{flexDirection:'row',justifyContent:'space-between'},imageHelp:{fontSize:13,lineHeight:20,color:colors.muted,marginTop:6},imageGrid:{flexDirection:'row',flexWrap:'wrap',gap:10},imageOption:{width:72,height:92,borderRadius:12,overflow:'hidden',borderWidth:2,borderColor:'transparent'},imageOptionSelected:{borderColor:colors.accent},imageThumbnail:{width:'100%',height:'100%'},imageCheck:{position:'absolute',right:4,top:4,width:22,height:22,borderRadius:11,backgroundColor:colors.accent,alignItems:'center',justifyContent:'center'},imageCheckText:{color:colors.onAccent,fontSize:14,fontWeight:'700'},addImages:{alignSelf:'flex-start',paddingVertical:10,paddingHorizontal:16,borderRadius:20,backgroundColor:colors.white},addImagesText:{color:colors.accent,fontWeight:'600'},swatch:{width:48,height:48,borderRadius:24,borderWidth:2,alignItems:'center',justifyContent:'center'},doneButton:{alignItems:'center'},main:{flex:1},fixedBackground:{position:'absolute',top:0,right:0,bottom:0,left:0,overflow:'hidden',backgroundColor:'#181818'},backgroundImage:{width:'100%',height:'100%'},filteredBackgroundImage:{position:'absolute',width:'100%',height:'100%'},backgroundScrim:{position:'absolute',top:0,right:0,bottom:0,left:0,backgroundColor:'rgba(0,0,0,0.64)'},transparentPage:{backgroundColor:'transparent'},imagePassage:{color:'#ffffff'},imageReference:{color:'#ffffff'},page:{backgroundColor:colors.paper,paddingHorizontal:28,paddingTop:24,paddingBottom:24},eyebrow:{fontSize:10,fontWeight:'700',letterSpacing:1.6,color:colors.accent},reading:{flex:1},readingContent:{flexGrow:1,justifyContent:'center',paddingVertical:24},passage:{fontSize:26,lineHeight:39,color:colors.ink,fontFamily:'serif',textAlign:'center'},selectionTools:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:8,marginTop:24},selectionButton:{paddingHorizontal:14,paddingVertical:10,borderRadius:20,backgroundColor:colors.white},selectionButtonText:{fontSize:14,fontWeight:'600',color:colors.accent},selectionHint:{fontSize:12,color:colors.muted,flexBasis:'100%',marginTop:2},referenceGroup:{alignItems:'flex-start',gap:12,flex:1},lookupButton:{maxWidth:'100%',paddingHorizontal:16,paddingVertical:10,borderRadius:20,backgroundColor:colors.white},lookupText:{fontSize:14,fontWeight:'600',color:colors.accent},reference:{fontSize:14,color:colors.muted},pageBottom:{flexDirection:'row',alignItems:'center',justifyContent:'center',marginTop:16},actions:{flexDirection:'row',gap:16},hiddenActions:{opacity:0},action:{width:44,height:44,borderRadius:22,backgroundColor:colors.white,alignItems:'center',justifyContent:'center'},heart:{fontSize:22,color:colors.accent},noteIcon:{fontSize:20,color:colors.ink},section:{flex:1,paddingHorizontal:28,paddingTop:12},title:{fontFamily:'serif',fontSize:32,color:colors.ink,marginTop:8,marginBottom:24},row:{paddingVertical:20,borderBottomWidth:1,borderColor:colors.line,flexDirection:'row',alignItems:'center',gap:16},rowLabel:{fontSize:10,letterSpacing:1,color:colors.accent,fontWeight:'700'},rowTitle:{fontSize:18,lineHeight:26,color:colors.ink,marginTop:8,fontFamily:'serif'},bookRow:{minHeight:148,paddingVertical:16,borderBottomWidth:1,borderColor:colors.line,flexDirection:"row",alignItems:"center",gap:18},bookCover:{width:76,height:114,borderRadius:5,backgroundColor:colors.line},bookTitle:{fontSize:19,lineHeight:26,color:colors.ink,fontFamily:"serif"},bookDetail:{fontSize:13,lineHeight:20,color:colors.muted,marginTop:6},chapterProgress:{marginTop:16,gap:8},progressLabels:{flexDirection:'row',justifyContent:'space-between',gap:8},progressText:{fontSize:13,color:colors.muted},progressTrack:{height:4,borderRadius:2,backgroundColor:colors.line,overflow:'hidden'},progressFill:{height:'100%',borderRadius:2,backgroundColor:colors.accent},arrow:{fontSize:22,color:colors.muted},empty:{color:colors.muted,lineHeight:24,marginTop:24},nav:{flexDirection:'row',borderTopWidth:1,borderColor:colors.line,backgroundColor:colors.white,paddingVertical:12},navItem:{flex:1,alignItems:'center',padding:8},navText:{fontSize:13,color:colors.muted},navActive:{color:colors.accent,fontWeight:'700'},dot:{width:4,height:4,borderRadius:2,marginTop:6},dotActive:{backgroundColor:colors.accent},overlay:{flex:1,justifyContent:'flex-end'},dictionaryOverlay:{flex:1,justifyContent:'flex-end'},dictionaryBackdrop:{position:'absolute',top:0,right:0,bottom:0,left:0,backgroundColor:'#0007'},dictionarySheet:{backgroundColor:colors.white,borderTopLeftRadius:24,borderTopRightRadius:24,paddingHorizontal:24,paddingBottom:32,maxHeight:'75%'},dictionaryContent:{flexGrow:1,gap:20,paddingHorizontal:24,paddingTop:24,paddingBottom:32},dictionaryLoading:{flexDirection:'row',alignItems:'center',gap:12},dictionaryGroup:{gap:10},dictionaryBody:{fontSize:16,lineHeight:24,color:colors.ink},dictionaryMeta:{fontSize:13,lineHeight:20,color:colors.muted},dictionaryLink:{fontSize:14,color:colors.accent,fontWeight:'600'},sheet:{backgroundColor:colors.white,borderTopLeftRadius:24,borderTopRightRadius:24,padding:24},input:{minHeight:120,textAlignVertical:'top',backgroundColor:colors.paper,borderRadius:12,padding:16,color:colors.ink,fontSize:16},sheetActions:{flexDirection:'row',justifyContent:'flex-end',gap:12,marginTop:16},button:{paddingVertical:12,paddingHorizontal:18,borderRadius:20},buttonPrimary:{backgroundColor:colors.accent}});
