import { chapterImage } from './bookBackgrounds';

export type ChapterImageOverrides = Record<string,string>;
export function chapterImageKey(bookId:string, chapter:number):string { return `${bookId}:${chapter}`; }
export function parseChapterImageOverrides(raw:string):ChapterImageOverrides {
  try {
    const value:unknown=JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([key,id]) => /^[a-z0-9-]+:[1-9][0-9]*$/.test(key) && typeof id==='string' && /^[a-zA-Z0-9._-]+$/.test(id))) as ChapterImageOverrides;
  } catch {return {};}
}
export function chapterBackground<T extends {id:string}>(all:T[], pool:T[], bookId:string, chapter:number, seed:number, overrides:ChapterImageOverrides):T|undefined {
  return all.find(image => image.id===overrides[chapterImageKey(bookId,chapter)]) ?? chapterImage(pool,chapter,seed);
}

export type BookImageSeeds = Record<string,number>;
export function parseBookImageSeeds(raw:string):BookImageSeeds {
  try {
    const value:unknown=JSON.parse(raw);
    if (!value || typeof value!=='object' || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([id,seed]) => /^[a-z0-9-]+$/.test(id) && typeof seed==='number' && Number.isInteger(seed) && seed>0 && seed<=0xffffffff)) as BookImageSeeds;
  } catch {return {};}
}
/** Pick a new seed that changes the assignment of an automatic chapter. */
export function shuffledBookSeed<T extends {id:string}>(pool:T[], previous:number, chapter:number, candidate:number, previousImageId?:string):number|null {
  if (pool.length<2 || chapter<1) return null;
  const prior=previousImageId ?? chapterImage(pool,chapter,previous)?.id;
  let seed=(candidate>>>0) || 1;
  for (let i=0;i<256;i++) {
    if (seed!==previous && chapterImage(pool,chapter,seed)?.id!==prior) return seed;
    seed=(seed+1)>>>0 || 1;
  }
  return null;
}

/** Reset only the selected book's explicit choices when its images are shuffled. */
export function clearBookImageOverrides(overrides:ChapterImageOverrides, bookId:string):ChapterImageOverrides {
  const prefix=`${bookId}:`;
  return Object.fromEntries(Object.entries(overrides).filter(([key]) => !key.startsWith(prefix)));
}
