const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root=path.resolve(__dirname,'..');
const ts=require(root+'/node_modules/typescript');
const source=fs.readFileSync(root+'/src/uiTranslations.ts','utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
const api={}; new Function('exports','require',compiled)(api,p => p==='./data/ui-hi.json' ? require(root+'/src/data/ui-hi.json') : require(p));
for (const [en,hi] of [['Books','पुस्तकें'],['Settings','सेटिंग्स'],['Credits','आभार और स्रोत'],['Prashnavali','प्रश्नावली'],['Read aloud','सस्वर पठन']]) {assert.equal(api.translate('en',en),en);assert.equal(api.translate('hi',en),hi);}
assert.equal(api.translate('hi','Unlisted source title'),'Unlisted source title');
const provider=fs.readFileSync(root+'/src/AppLanguage.tsx','utf8');
assert.match(provider,/'app-language'/); assert.doesNotMatch(provider,/runAsync\([^\n]*['"]language['"]/);
console.log('PASS: English and Hindi interface translations, unknown-text fallback, and a separate persisted preference.');
