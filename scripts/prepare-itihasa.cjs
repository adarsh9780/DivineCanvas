// Prepare the unshuffled Itihasa JSON as edition-scoped, offline reading data.
// Input: two JSON files from the pinned gh-pages/res source, output: local directory.
const fs = require('node:fs');
const path = require('node:path');
const [ramayanaPath, mahabharataPath, outputDir] = process.argv.slice(2);
if (!ramayanaPath || !mahabharataPath || !outputDir) throw new Error('Usage: node prepare-itihasa.cjs ramayana.json mahabharata.json output-dir');
fs.mkdirSync(outputDir, {recursive:true});
const manifest = {};
for (const [name, input] of [['ramayana',ramayanaPath], ['mahabharata',mahabharataPath]]) {
 const source = JSON.parse(fs.readFileSync(input, 'utf8'));
 const chapters = [], entries = [];
 for (const [volume, sections] of Object.entries(source)) {
  for (const [offset, section] of sections.entries()) {
   if (!Array.isArray(section.sn) || !Array.isArray(section.en) || section.sn.length !== section.en.length) throw new Error(`${name}: unequal parallel entries in ${volume}/${offset+1}`);
   const num = chapters.length + 1;
   const idPrefix = `itihasa-${name}:${volume}:${offset+1}`;
   const title = `Vol. ${volume.slice(4).toUpperCase()} · Chapter ${String(section.chapter).trim()}`;
   const start = entries.length;
   for (let i=0; i<section.sn.length; i++) {
    if (typeof section.sn[i] !== 'string' || typeof section.en[i] !== 'string' || !section.sn[i].trim() || !section.en[i].trim()) throw new Error(`${name}: missing passage ${idPrefix}:${i+1}`);
    entries.push([section.sn[i], section.en[i]]);
   }
   chapters.push({number:num,title,detail:`VOLUME ${volume.slice(4).toUpperCase()} · ENTRY ${offset+1}`,idPrefix,start,count:section.sn.length});
  }
 }
 manifest[name] = {chapters, passageCount:entries.length};
 fs.writeFileSync(path.join(outputDir,`itihasa-${name}.local.json`),JSON.stringify(entries));
 console.log(`${name}: ${chapters.length} chapter entries, ${entries.length} aligned passages`);
}
fs.writeFileSync(path.join(outputDir,'itihasa-manifest.json'),JSON.stringify(manifest));
