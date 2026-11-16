// Keys are scoped to the bundled edition so future books do not share progress.
export const CHAPTER_POSITION_PREFIX = 'chapter-position:gita-1972:';
export const chapterPositionKey = (chapter: number) => `${CHAPTER_POSITION_PREFIX}${chapter}`;
export const SAVE_POSITION_SQL = 'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?), (?, ?)';

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
