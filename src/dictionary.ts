import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import { findMeanings, validateArchive } from './dictionaryEngine';

const SOURCE = 'https://en-word.net/static/english-wordnet-2025-json.zip';
export const DICTIONARY_DOWNLOAD_BYTES = 9_986_555;
function dictionaryFile() { return new File(Paths.document, 'english-wordnet-2025.zip'); }
let downloading = false;
export function dictionaryAvailable() { return Platform.OS !== 'web' && dictionaryFile().exists; }
export function removeDictionary() {
  if (downloading) throw new Error('Wait for the dictionary download to finish.');
  const file = dictionaryFile();
  if (file.exists) file.delete();
}
export async function downloadDictionary(onProgress?: (fraction: number) => void) {
  if (Platform.OS === 'web') throw new Error('Dictionary downloads are available in the mobile app.');
  if (downloading) throw new Error('A dictionary download is already in progress.');
  downloading = true;
  const temp = new File(Paths.document, 'english-wordnet-download.tmp');
  try {
    if (temp.exists) temp.delete();
    const task = File.createDownloadTask(SOURCE, temp, {onProgress: ({bytesWritten, totalBytes}) => onProgress?.(Math.min(1, bytesWritten / (totalBytes > 0 ? totalBytes : DICTIONARY_DOWNLOAD_BYTES)))});
    const downloaded = await task.downloadAsync();
    if (!downloaded) throw new Error('Dictionary download was cancelled.');
    const bytes = await temp.bytes();
    validateArchive(bytes);
    const destination = dictionaryFile();
    if (destination.exists) destination.delete();
    temp.move(destination);
  } catch (error) {
    if (temp.exists) temp.delete();
    throw error;
  } finally {
    downloading = false;
  }
}
export async function lookupWord(word: string) {
  const file = dictionaryFile();
  if (!file.exists) throw new Error('Dictionary has not been downloaded.');
  const bytes = await file.bytes();
  return findMeanings(bytes, word);
}
