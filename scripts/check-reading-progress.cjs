const assert = require('node:assert/strict');
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const os = require('node:os');
const root = path.resolve(__dirname, '..');
const ts = require(root + '/node_modules/typescript');
const compiled = ts.transpileModule(fs.readFileSync(root + '/src/readingProgress.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const exported = {}; new Function('exports', compiled)(exported);
const { chapterPositionKey, chapterResumeIndex, SAVE_POSITION_SQL, CHAPTER_POSITION_PREFIX } = exported;
const entries = [{id:'gita:1:1',chapter:1},{id:'gita:1:2',chapter:1},{id:'gita:2:1',chapter:2},{id:'gita:2:2-3',chapter:2}];
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'divinecanvas-progress-'));
const file = path.join(temp, 'progress.db');
let db=new DatabaseSync(file);
db.exec('CREATE TABLE settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL); CREATE TABLE saves (id TEXT PRIMARY KEY, note TEXT);');
db.prepare('INSERT INTO saves VALUES (?,?)').run('gita:1:1','Keep my note');
for (const i of [1,3,0]) {
 const p=entries[i]; db.prepare(SAVE_POSITION_SQL).run('position',p.id,chapterPositionKey(p.chapter),p.id);
}
db.close(); db=new DatabaseSync(file);
const rows=db.prepare('SELECT key,value FROM settings WHERE key LIKE ?').all(CHAPTER_POSITION_PREFIX+'%');
const saved=Object.fromEntries(rows.map(r=>[Number(r.key.slice(CHAPTER_POSITION_PREFIX.length)),r.value]));
assert.equal(chapterResumeIndex(entries,1,saved[1]),0);
assert.equal(chapterResumeIndex(entries,2,saved[2]),3);
assert.equal(db.prepare("SELECT value FROM settings WHERE key='position'").get().value,'gita:1:1');
assert.equal(chapterResumeIndex(entries,2),2);
assert.equal(chapterResumeIndex(entries,2,'removed-passage'),2);
assert.equal(chapterResumeIndex(entries,2,'gita:1:2'),2);
assert.equal(db.prepare('SELECT note FROM saves').get().note,'Keep my note');
db.close(); fs.rmSync(temp, {recursive:true});
console.log('PASS: independent chapter positions survive database reopen, backward reading updates progress, grouped verses resume, invalid IDs fall back safely, and notes remain intact.');

const { chapterReadingProgress } = exported;
const labelled = entries.map((p,i) => ({...p,label:['TEXT 1','TEXT 2','TEXT 1','TEXTS 2-3'][i]}));
assert.deepEqual(chapterReadingProgress(labelled,2),{percent:0,label:'Not started · 3 verses'});
assert.deepEqual(chapterReadingProgress(labelled,2,'gita:2:2-3'),{percent:100,label:'Verses 2–3 of 3'});
assert.deepEqual(chapterReadingProgress(labelled,2,'gita:2:1'),{percent:33,label:'Verse 1 of 3'});
assert.equal(chapterReadingProgress(labelled,2,'gita:1:2').percent,0);
console.log('PASS: chapter progress handles unvisited chapters, grouped verses, backward reading and cross-chapter IDs.');
