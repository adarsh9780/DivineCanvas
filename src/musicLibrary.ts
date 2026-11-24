import { transferFraction } from './downloadProgress';
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

export type MusicTrack = {id:string; title:string; artist:string; bytes:number; filename?:string; sha256?:string; source:string};
export const DEFAULT_MUSIC_ID = 'krishna-flute';
export const MUSIC_TRACKS: readonly MusicTrack[] = [
  {id:DEFAULT_MUSIC_ID,title:'Krishna Flute Music',artist:'Alex Morgan',bytes:8045805,source:'https://freemusicarchive.org/music/alex-morgan/world-devotional-music/krishna-flute-music/'},
  {id:'morning-stillness',title:'Morning Stillness',artist:'Ketsa',bytes:9312174,filename:'morning-stillness.mp3',sha256:'4891ea8f42aa0d14f98941231d1512d7accadb32f153f007c79c98ae2df86624',source:'https://freemusicarchive.org/music/Ketsa/modern-meditations/morning-stillness/'},
  {id:'meditation',title:'Meditation',artist:'Ketsa',bytes:10920272,filename:'meditation.mp3',sha256:'88a5aac620908a6f7a5d802d6bda6dbe7b649c8d681bd953b6bbfbd20344773c',source:'https://freemusicarchive.org/music/Ketsa/modern-meditations/meditation-5/'},
  {id:'zen-garden',title:'Meditative Zen Yoga Spa Chill Out Ambient',artist:'Splashkabona',bytes:11138732,filename:'zen-garden.mp3',sha256:'9139f24157eefe33e6325d81e66699fa43f07b10f07e2fd24cb6240f666ed55c',source:'https://freemusicarchive.org/music/splashkabona/single/meditative-zen-yoga-spa-chill-out-ambient/'},
];
const release='https://github.com/adarsh9780/DivineCanvas/releases/download/music-v1';
const folder=() => new Directory(Paths.document,'reading-music-v1');
const pending=new Set<string>();
function fileFor(track:MusicTrack) {if (!track.filename) throw new Error('This track is included with the app.'); return new File(folder(),track.filename);}
/** Remove the retired track from devices that downloaded an earlier catalog. */
export function removeRetiredMusic():void {
  if (Platform.OS==='web') return;
  for (const name of ['patterns.mp3','patterns.mp3.partial']) {
    try {const file=new File(folder(),name); if (file.exists) file.delete();}
    catch (error) {console.warn('Could not remove retired music:',error);}
  }
}
export function musicDownloaded(track:MusicTrack):boolean {return track.id===DEFAULT_MUSIC_ID || (Platform.OS!=='web' && !!track.filename && fileFor(track).exists);}
export function musicUri(track:MusicTrack):string | undefined {return track.filename && musicDownloaded(track) ? fileFor(track).uri : undefined;}
export function removeMusic(track:MusicTrack):void {if (pending.has(track.id)) throw new Error('Download in progress.'); const file=fileFor(track); if (file.exists) file.delete();}
export async function downloadMusic(track:MusicTrack,onProgress:(value:number)=>void):Promise<void> {
  if (Platform.OS==='web') throw new Error('Music downloads are available in the mobile app.');
  if (!track.filename || !track.sha256) throw new Error('This track is included with the app.');
  if (pending.has(track.id)) throw new Error('This track is already downloading.');
  pending.add(track.id);
  const directory=folder(); const staging=new File(directory,`${track.filename}.partial`); const target=fileFor(track);
  try {
    directory.create({idempotent:true,intermediates:true});
    if (staging.exists) staging.delete();
    const task=File.createDownloadTask(`${release}/${track.filename}`,staging,{onProgress:({bytesWritten,totalBytes}) => onProgress(transferFraction(bytesWritten,totalBytes,track.bytes))});
    const file=await task.downloadAsync();
    if (!file || file.size!==track.bytes || await file.digest('SHA-256')!==track.sha256) throw new Error('The downloaded music could not be verified. Please try again.');
    if (target.exists) target.delete();
    await file.move(target);
  } finally {
    // The downloaded File may update its URI during move; cleanup must target the original path.
    try {const partial=new File(directory,`${track.filename}.partial`); if (partial.exists) partial.delete();}
    catch (error) {console.warn('Could not remove temporary music download:',error);}
    pending.delete(track.id);
  }
}
