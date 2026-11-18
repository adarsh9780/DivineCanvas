const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const dir = path.resolve(__dirname, '../src/data');
const manifest = JSON.parse(fs.readFileSync(path.join(dir,'itihasa-manifest.json'),'utf8'));
for (const [name, expected] of [['ramayana',19371],['mahabharata',73659]]) {
 const entries = JSON.parse(fs.readFileSync(path.join(dir,`itihasa-${name}.local.json`),'utf8'));
 const {chapters,passageCount} = manifest[name];
 assert.equal(entries.length,expected); assert.equal(passageCount,entries.length);
 let cursor=0; const ids = new Set();
 for (const [i,c] of chapters.entries()) {
  assert.equal(c.number,i+1); assert.equal(c.start,cursor); assert.ok(c.count > 0); assert.ok(!ids.has(c.idPrefix)); ids.add(c.idPrefix);
  for (const pair of entries.slice(c.start,c.start+c.count)) assert.ok(Array.isArray(pair) && pair.length===2 && pair.every(v=>typeof v==='string' && v.trim()));
  cursor += c.count;
 }
 assert.equal(cursor,entries.length);
 console.log(`PASS: ${name} has ${chapters.length} distinct ordered chapter entries and ${entries.length} aligned pairs.`);
}
