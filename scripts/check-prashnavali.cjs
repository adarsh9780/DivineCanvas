const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const ts = require(root + '/node_modules/typescript');
const source = fs.readFileSync(root + '/src/prashnavaliLogic.ts','utf8');
const compiled = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const api = {}; new Function('exports',compiled)(api);
const {board,results} = require(root + '/src/data/prashnavali.json');
assert.equal(board.length,225);assert.equal(results.length,9);
for (let i=0;i<225;i++) {
 const group=api.resultForCell(i), seen=new Set();
 for (let k=0;k<25;k++) {let j=(i+9*k)%225;assert(!seen.has(j));seen.add(j);assert.equal(api.resultForCell(j),group);}
 assert.equal((i+9*25)%225,i);assert.equal(seen.size,25);
}
const clean = s => s.normalize('NFC').replace(/[\s।॥]/gu,'');
for (let i=0;i<9;i++) {
 let boardLine=board.filter((_,j)=>j%9===i).join('');
 // The selected board and text edition spell these two words differently.
 if (i===1) boardLine=boardLine.replace('कोसलपुर','कौसलपुर');
 if (i===2) boardLine=boardLine.replace('उघरहिं','उधरहिं');
 assert.equal(clean(boardLine),clean(results[i].verse));
}
assert.equal(api.locateCell(0,0,300),0);assert.equal(api.locateCell(299.9,299.9,300),224);
assert.equal(api.locateCell(300,0,300),null);assert.equal(api.locateCell(-1,0,300),null);
assert.equal(api.locateCell(20,20,300),16);assert(api.isEdgeCell(0));assert(api.isEdgeCell(224));assert(!api.isEdgeCell(16));
assert.throws(()=>api.resultForCell(-1));assert.throws(()=>api.resultForCell(225));
console.log('PASS: all 225 squares form nine 25-cell cycles matching the source passages, with two documented spelling variants.');
console.log('PASS: touch positions, outside cancellation, and board edges are mapped correctly.');
