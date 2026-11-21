import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { configureReadingAudio } from './readingAudioSession';
import { DEFAULT_MUSIC_ID, musicUri, type MusicTrack } from './musicLibrary';

/** Lives only while the Music screen is displaying this preview. */
export function MusicPreview({track,onFinish,onClose}:{track:MusicTrack;onFinish:()=>void;onClose:()=>void}) {
  const closeRef=useRef(onClose);
  useEffect(() => {closeRef.current=onClose;});
  useEffect(() => () => closeRef.current(),[]);
  const uri=musicUri(track);
  const player=useAudioPlayer(track.id===DEFAULT_MUSIC_ID ? require('../assets/audio/krishna-flute.mp3') : uri ? {uri} : null);
  const status=useAudioPlayerStatus(player);
  useEffect(() => {
    let active=true;
    if (status.isLoaded) void configureReadingAudio(false).then(() => {if (active) player.play();}).catch(() => {if (active) Alert.alert('Could not play preview');});
    return () => {active=false; player.pause();};
  },[player,status.isLoaded]);
  useEffect(() => {if (status.didJustFinish) onFinish();},[status.didJustFinish,onFinish]);
  return null;
}
