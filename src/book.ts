// Local prototype data is generated from the user-supplied EPUB; see README.
import book from './data/gita.local.json';
export type Passage = { id: string; chapter: number; chapterTitle: string; label: string; en: string; hi: string };
const titles = ['Observing the Armies', 'Contents of the Gita Summarized', 'Karma-yoga', 'Transcendental Knowledge', 'Karma-yoga: Action', 'Sankhya-yoga', 'Knowledge of the Absolute', 'Attaining the Supreme', 'The Most Confidential Knowledge', 'The Opulence of the Absolute', 'The Universal Form', 'Devotional Service', 'Nature, the Enjoyer, and Consciousness', 'The Three Modes of Material Nature', 'The Yoga of the Supreme Person', 'The Divine and Demoniac Natures', 'The Divisions of Faith', 'Conclusion'];
export const passages: Passage[] = book.map(p => ({ id: `gita-1972:${p.chapter}:${p.label.toLowerCase().replace(/\s+/g, '-')}`, chapter: p.chapter, chapterTitle: titles[p.chapter - 1], label: p.label, en: p.english, hi: p.sanskrit }));
export const chapters = Array.from(new Map(passages.map(p => [p.chapter, { number: p.chapter, title: p.chapterTitle }])).values());
