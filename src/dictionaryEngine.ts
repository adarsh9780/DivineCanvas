import { strFromU8, unzipSync } from 'fflate';

type Entry = Record<string, {sense?: {synset: string}[]}>;
type Synset = {definition?: string[]};
export type DictionaryMeaning = {partOfSpeech: string; definitions: string[]};

const labels: Record<string, string> = {n: 'Noun', v: 'Verb', a: 'Adjective', s: 'Adjective', r: 'Adverb'};

export function findMeanings(archive: Uint8Array, input: string): DictionaryMeaning[] {
  const word = input.toLowerCase().replace(/^[^a-z]+|[^a-z]+$/g, '');
  if (!word) return [];
  const candidates = new Set([word]);
  if (word.endsWith('ies')) candidates.add(`${word.slice(0, -3)}y`);
  if (word.endsWith('es')) candidates.add(word.slice(0, -2));
  if (word.endsWith('s')) candidates.add(word.slice(0, -1));
  if (word.endsWith('ed')) { candidates.add(word.slice(0, -2)); candidates.add(word.slice(0, -1)); }
  if (word.endsWith('ing')) { candidates.add(word.slice(0, -3)); candidates.add(`${word.slice(0, -3)}e`); }
  const names = new Set(Array.from(candidates, w => `entries-${w[0]}.json`));
  const entryFiles = unzipSync(archive, {filter: file => names.has(file.name)});
  if (!Object.keys(entryFiles).length) throw new Error('Invalid dictionary archive');
  const found = new Map<string, string[]>();
  for (const data of Object.values(entryFiles)) {
    const entries = JSON.parse(strFromU8(data)) as Record<string, Entry>;
    for (const [key, entry] of Object.entries(entries)) {
      if (!candidates.has(key.toLowerCase())) continue;
      for (const [part, details] of Object.entries(entry)) {
        for (const sense of details.sense ?? []) {
          const ids = found.get(part) ?? [];
          ids.push(sense.synset); found.set(part, ids);
        }
      }
    }
  }
  if (!found.size) return [];
  const ids = new Set(Array.from(found.values()).flat());
  const definitions = new Map<string, string[]>();
  // Inspect names first, then decompress one section at a time to limit memory use.
  const sectionNames: string[] = [];
  unzipSync(archive, {filter: file => { if (/^(noun|verb|adj|adv)\..*\.json$/.test(file.name)) sectionNames.push(file.name); return false; }});
  if (!sectionNames.length) throw new Error('Invalid dictionary archive');
  for (const name of sectionNames) {
    const data = unzipSync(archive, {filter: file => file.name === name})[name];
    const synsets = JSON.parse(strFromU8(data)) as Record<string, Synset>;
    for (const id of ids) if (synsets[id]?.definition?.length) definitions.set(id, synsets[id].definition!);
  }
  return Array.from(found, ([part, senses]) => ({partOfSpeech: labels[part] ?? part, definitions: [...new Set(senses.flatMap(id => definitions.get(id) ?? []))]})).filter(group => group.definitions.length);
}

export function validateArchive(archive: Uint8Array): void {
  const files = unzipSync(archive, {filter: file => file.name === 'entries-a.json' || file.name === 'noun.person.json'});
  if (!files['entries-a.json'] || !files['noun.person.json']) throw new Error('Invalid dictionary archive');
  JSON.parse(strFromU8(files['entries-a.json']));
  JSON.parse(strFromU8(files['noun.person.json']));
}
