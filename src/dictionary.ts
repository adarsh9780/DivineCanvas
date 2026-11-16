import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import { findMeanings, validateArchive } from './dictionaryEngine';

const SOURCE = 'https://en-word.net/static/english-wordnet-2025-json.zip';
function dictionaryFile() { return new File(Paths.document, 'english-wordnet-2025.zip'); }
export function dictionaryAvailable() { return Platform.OS !== 'web' && dictionaryFile().exists; }
export async function downloadDictionary() {
  if (Platform.OS === 'web') throw new Error('Dictionary downloads are available in the mobile app.');
  const temp = new File(Paths.document, 'english-wordnet-download.tmp');
  if (temp.exists) temp.delete();
  try {
    await File.downloadFileAsync(SOURCE, temp);
    const bytes = await temp.bytes();
    validateArchive(bytes);
    const destination = dictionaryFile();
    if (destination.exists) destination.delete();
    temp.move(destination);
  } catch (error) {
    if (temp.exists) temp.delete();
    throw error;
  }
}
export async function lookupWord(word: string) {
  const file = dictionaryFile();
  if (!file.exists) throw new Error('Dictionary has not been downloaded.');
  const bytes = await file.bytes();
  return findMeanings(bytes, word);
}
