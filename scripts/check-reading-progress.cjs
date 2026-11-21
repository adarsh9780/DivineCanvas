const assert = require('node:assert/strict');
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const os = require('node:os');
const root = path.resolve(__dirname, '..');
const ts = require(root + '/node_modules/typescript');
const compiled = ts.transpileModule(fs.readFileSync(root + '/src/readingProgress.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const api = {}; new Function('exports', compiled)(api);
const { chapterPositionKey, chapterPositionPrefix, bookPositionKey, chapterResumeIndex, chapterBounds, chapterReadingProgress, legacyGitaPositionCopies, SAVE_POSITION_SQL, CHAPTER_POSITION_PREFIX } = api;
const entries = [{id:'gita:1:1',chapter:1,label:'TEXT 1'},{id:'gita:1:2',chapter:1,label:'TEXT 2'},{id:'gita:2:1',chapter:2,label:'TEXT 1'},{id:'gita:2:2-3',chapter:2,label:'TEXTS 2-3'}];
const other = [{id:'other:1:1',chapter:1,label:'TEXT 1'},{id:'other:1:2',chapter:1,label:'TEXT 2'}];
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'divinecanvas-progress-'));
const file = path.join(temp, 'progress.db');
let db = new DatabaseSync(file);
db.exec('CREATE TABLE settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL); CREATE TABLE saves (id TEXT PRIMARY KEY, note TEXT);');
db.prepare('INSERT INTO saves VALUES (?,?)').run('gita:1:1','Keep my note');
const upsert = db.prepare(SAVE_POSITION_SQL);
for (const [book,p] of [['gita',entries[1]],['gita',entries[3]],['other',other[1]],['gita',entries[0]]]) upsert.run(bookPositionKey(book),p.id,chapterPositionKey(book,p.chapter),p.id);
db.close(); db = new DatabaseSync(file);
const get = key => db.prepare('SELECT value FROM settings WHERE key=?').get(key)?.value;
assert.equal(get(bookPositionKey('gita')),'gita:1:1');
assert.equal(get(bookPositionKey('other')),'other:1:2');
assert.equal(get(chapterPositionKey('gita',1)),'gita:1:1');
assert.equal(get(chapterPositionKey('gita',2)),'gita:2:2-3');
assert.equal(get(chapterPositionKey('other',1)),'other:1:2');
assert.notEqual(chapterPositionPrefix('gita'),chapterPositionPrefix('other'));
assert.equal(chapterResumeIndex(entries,2,get(chapterPositionKey('gita',2))),3);
assert.equal(chapterResumeIndex(entries,2,'gita:1:2'),2);
assert.deepEqual(chapterBounds(entries,2),{first:2,count:2});
assert.equal(chapterBounds(entries,99),undefined);
assert.equal(db.prepare('SELECT note FROM saves').get().note,'Keep my note');
const legacy = [
 {key:CHAPTER_POSITION_PREFIX+'1',value:'gita:1:2'},
 {key:CHAPTER_POSITION_PREFIX+'2',value:'gita:2:2-3'},
 {key:CHAPTER_POSITION_PREFIX+'3',value:'gita:1:1'},
];
const copies=legacyGitaPositionCopies('gita',entries,'gita:1:1',legacy);
assert.equal(copies.length,3);
const insert=db.prepare('INSERT OR IGNORE INTO settings (key,value) VALUES (?,?)');
for (const row of copies) insert.run(row.key,row.value);
assert.equal(get(chapterPositionKey('gita',1)),'gita:1:1'); // Existing newer progress wins.
assert.equal(legacyGitaPositionCopies('x',entries,'invalid',[]).length,0);
const onlyLast=legacyGitaPositionCopies('x',entries,'gita:1:2',[]);
assert.equal(onlyLast.length,2);
assert.deepEqual(chapterReadingProgress(entries,2),{percent:0,label:'Not started · 3 verses'});
assert.deepEqual(chapterReadingProgress(entries,2,'gita:2:2-3'),{percent:100,label:'Verses 2–3 of 3'});
assert.deepEqual(chapterReadingProgress(entries,2,'gita:2:1'),{percent:33,label:'Verse 1 of 3'});
db.close(); fs.rmSync(temp,{recursive:true});
console.log('PASS: per-book and per-chapter progress survives database reopen, with independent books and notes.');
console.log('PASS: legacy progress migration validates passages and preserves newer values; chapter progress handles grouped verses.');
