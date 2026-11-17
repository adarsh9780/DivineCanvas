// The legacy keys remain readable solely for upgrading existing installations.
export const CHAPTER_POSITION_PREFIX = 'chapter-position:gita-1972:';
export const chapterPositionPrefix = (bookId: string) => `chapter-position:${bookId}:`;
export const chapterPositionKey = (bookId: string, chapter: number) => `${chapterPositionPrefix(bookId)}${chapter}`;
export const bookPositionKey = (bookId: string) => `book-position:${bookId}`;
export const SAVE_POSITION_SQL = 'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?), (?, ?)';

/** Copy only valid legacy positions. INSERT OR IGNORE protects already migrated progress. */
export function legacyGitaPositionCopies(bookId: string, passages: {id: string; chapter: number}[], oldPosition: string | undefined, rows: {key: string; value: string}[]) {
  const copies: {key: string; value: string}[] = [];
  for (const row of rows) {
    const chapter = Number(row.key.slice(CHAPTER_POSITION_PREFIX.length));
    if (row.key.startsWith(CHAPTER_POSITION_PREFIX) && Number.isInteger(chapter) && passages.some(p => p.chapter === chapter && p.id === row.value)) {
      copies.push({key:chapterPositionKey(bookId, chapter), value:row.value});
    }
  }
  const last = passages.find(p => p.id === oldPosition);
  if (last) {
    copies.push({key:bookPositionKey(bookId), value:last.id});
    if (!copies.some(row => row.key === chapterPositionKey(bookId, last.chapter))) copies.push({key:chapterPositionKey(bookId, last.chapter), value:last.id});
  }
  return copies;
}

type LocatedPassage = { id: string; chapter: number };
export function chapterResumeIndex(passages: LocatedPassage[], chapter: number, savedId?: string): number {
  const saved = passages.findIndex(p => p.chapter === chapter && p.id === savedId);
  return saved >= 0 ? saved : passages.findIndex(p => p.chapter === chapter);
}

export function chapterReadingProgress(passages: (LocatedPassage & {label: string})[], chapter: number, savedId?: string) {
  const entries = passages.filter(p => p.chapter === chapter);
  const verseNumbers = (label: string) => (label.match(/\d+/g) ?? []).map(Number);
  const total = Math.max(0, ...entries.flatMap(p => verseNumbers(p.label)));
  const current = entries.find(p => p.id === savedId);
  const numbers = current ? verseNumbers(current.label) : [];
  const at = numbers.length ? Math.min(total, numbers[numbers.length - 1]) : 0;
  return {
    percent: total > 0 ? Math.round(at / total * 100) : 0,
    label: numbers.length
      ? `${numbers.length > 1 ? 'Verses' : 'Verse'} ${numbers.join('–')} of ${total}`
      : `Not started · ${total} verses`,
  };
}
