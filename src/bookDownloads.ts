import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';

const release = 'https://github.com/adarsh9780/DivineCanvas/releases/download/book-data-v1';
export const bookDownloads: Record<string,{name:string; bytes:number; sha256:string}> = {
  'gita-hansi':{name:'gita.db',bytes:610304,sha256:'e433cd9eb4ab629a29655afdcf771d256fee7d73d66adbcdf2eb67cc21547462'},
  'itihasa-ramayana':{name:'ramayana.db',bytes:11390976,sha256:'904cf19b4d239d8fc35fc149707a64017fe7991937f162e63486472abf376e98'},
  'itihasa-mahabharata':{name:'mahabharata.db',bytes:42913792,sha256:'0602b5f8fb485db0f89ff27a32110f6731fa24617ee67708170fa9669e7868e5'},
};
const folder = () => new Directory(Paths.document, 'downloaded-books-v1');
export function bookDownloaded(id:string):boolean { return Platform.OS !== 'web' && !!bookDownloads[id] && new File(folder(),bookDownloads[id].name).exists; }
export async function downloadBook(id:string, onProgress:(value:number)=>void):Promise<void> {
  const spec=bookDownloads[id]; if (!spec) throw new Error('Unknown book.');
  if (Platform.OS === 'web') throw new Error('Book downloads are currently available in the iPhone and Android apps.');
  const directory=folder(); directory.create({idempotent:true,intermediates:true});
  const staging=new File(directory,`${spec.name}.partial`); const target=new File(directory,spec.name);
  if (staging.exists) staging.delete();
  try {
    const task=File.createDownloadTask(`${release}/${spec.name}`,staging,{onProgress:({bytesWritten})=>onProgress(Math.min(1,bytesWritten/spec.bytes))});
    const file=await task.downloadAsync();
    if (!file || file.size !== spec.bytes || await file.digest('SHA-256') !== spec.sha256) throw new Error('The download could not be verified. Please try again.');
    if (target.exists) target.delete();
    await file.move(target);
  } finally { if (staging.exists) staging.delete(); }
}
export async function openBookDatabase(id:string):Promise<SQLite.SQLiteDatabase> {
  const spec=bookDownloads[id];
  if (!spec || !bookDownloaded(id)) throw new Error('Download this book to read it offline.');
  return SQLite.openDatabaseAsync(spec.name, {useNewConnection:true}, folder().uri);
}
export function removeBookFile(id:string):void { const spec=bookDownloads[id]; if (spec) {const file=new File(folder(),spec.name); if (file.exists) file.delete();} }
