// Preview dataset: Hansi Gita Bhawan Trust, https://gitabhawan.org.in/gita/research
import book from './data/gita-trust.local.json';
export type Passage = { id: string; chapter: number; chapterTitle: string; label: string; en: string; hi: string; sa: string };
const titles = new Map(book.chapters.map(chapter => [chapter.n, chapter.english]));
export const passages: Passage[] = book.verses.map(p => ({
  id: `gita-hansi:${p.chapter}:${p.verse}`,
  chapter: p.chapter,
  chapterTitle: titles.get(p.chapter) ?? `Chapter ${p.chapter}`,
  label: `TEXT ${p.verse}`,
  en: p.english,
  hi: p.hindi,
  sa: p.sanskrit,
}));
export const chapters = book.chapters.map(c => ({number: c.n, title: c.english}));

/** Old grouped verses resume at their first verse; original records remain stored. */
export function migrateLegacyPassageId(id: string): string | undefined {
  const match = /^gita-1972:(\d+):texts?-(\d+)(?:-\d+)?$/.exec(id);
  if (!match) return undefined;
  const chapter = Number(match[1]);
  const oldVerse = Number(match[2]);
  // These editions number a few passages differently in chapters 1 and 13.
  const verse = chapter === 1 && oldVerse >= 37 ? oldVerse + 1
    : chapter === 13 && oldVerse >= 3 ? oldVerse - 1 : oldVerse;
  const candidate = `gita-hansi:${chapter}:${verse}`;
  return passages.some(p => p.id === candidate) ? candidate : undefined;
}
