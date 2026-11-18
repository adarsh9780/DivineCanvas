import type { ImageSourcePropType } from 'react-native';
// Preview dataset: Hansi Gita Bhawan Trust, https://gitabhawan.org.in/gita/research
import book from './data/gita-manifest.json';
import itihasaManifest from './data/itihasa-manifest.json';
export type ReadingLanguage = 'en' | 'hi' | 'sa';
export type Passage = { id: string; chapter: number; chapterTitle: string; label: string; en: string; hi: string; sa: string };
export type Chapter = {number: number; title: string; detail?:string};
export type Book = { id: string; title: string; shortTitle: string; cover: ImageSourcePropType; languages: readonly ReadingLanguage[]; progressUnit:'verse'|'passage'; passages: Passage[]; chapters: Chapter[] };
const titles = new Map(book.chapters.map(chapter => [chapter.n, chapter.english]));
export const passages: Passage[] = book.verses.map(p => ({
  id: `gita-hansi:${p.chapter}:${p.verse}`,
  chapter: p.chapter,
  chapterTitle: titles.get(p.chapter) ?? `Chapter ${p.chapter}`,
  label: `TEXT ${p.verse}`,
  en: '',
  hi: '',
  sa: '',
}));
export const chapters = book.chapters.map(c => ({number: c.n, title: c.english}));

/** Old grouped verses resume at their first verse; original records remain stored. */
export function migrateLegacyPassageId(id: string): string | undefined {
  const match = /^gita-1972:(\d+):texts?-(\d+)(?:-\d+)?$/.exec(id);
  if (!match) return undefined;
  const chapter = Number(match[1]);
  const oldVerse = Number(match[2]);
  const verse = chapter === 1 && oldVerse >= 37 ? oldVerse + 1
    : chapter === 13 && oldVerse >= 3 ? oldVerse - 1 : oldVerse;
  const candidate = `gita-hansi:${chapter}:${verse}`;
  return passages.some(p => p.id === candidate) ? candidate : undefined;
}

export const GITA_BOOK_ID = 'gita-hansi';
type ItihasaChapter = {number:number; title:string; detail:string; idPrefix:string; start:number; count:number};
function itihasaBook(name: 'ramayana'|'mahabharata', title:string, cover:ImageSourcePropType, manifest:{chapters:ItihasaChapter[]}): Book {
  let cached: Passage[] | undefined;
  return {
    id:`itihasa-${name}`, title, shortTitle:title, cover, languages:['en','sa'], progressUnit:'passage', chapters:manifest.chapters,
    get passages() {
      // Only lightweight navigation metadata lives here; text is read from SQLite on demand.
      if (!cached) cached = manifest.chapters.flatMap(chapter => Array.from({length:chapter.count}, (_, i) => ({
        id:`${chapter.idPrefix}:${i+1}`, chapter:chapter.number, chapterTitle:chapter.title, label:`PASSAGE ${i+1}`, en:'', hi:'', sa:'',
      })));
      return cached;
    },
  };
}
export const books: Book[] = [
  {id:GITA_BOOK_ID, title:'Bhagavad Gita', shortTitle:'Gita', cover:require('../assets/books/gita/thumbs/background-05.jpg'), languages:['en','hi','sa'], progressUnit:'verse', passages, chapters},
  itihasaBook('ramayana', 'Ramayana', require('../assets/books/ramayana/cover.jpg'), itihasaManifest.ramayana),
  itihasaBook('mahabharata', 'Mahabharata', require('../assets/books/mahabharata/cover.jpg'), itihasaManifest.mahabharata),
];
