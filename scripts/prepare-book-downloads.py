from pathlib import Path
import json, sqlite3, hashlib, shutil, sys
r=Path(__file__).resolve().parent.parent
if len(sys.argv) != 4: raise SystemExit('Usage: python3 scripts/prepare-book-downloads.py RAMAYANA_SOURCE_JSON MAHABHARATA_SOURCE_JSON OUTPUT_DIR')
source = {'ramayana':Path(sys.argv[1]), 'mahabharata':Path(sys.argv[2])}
out=Path(sys.argv[3]);out.mkdir(parents=True, exist_ok=True)
gita=json.loads((r/'src/data/gita-trust.local.json').read_text()); it=json.loads((r/'src/data/itihasa-manifest.json').read_text()); meta={'chapters':[{'n':c['n'],'english':c['english']} for c in gita['chapters']], 'verses':[{'chapter':v['chapter'],'verse':v['verse']} for v in gita['verses']]}; (out/'gita-manifest.json').write_text(json.dumps(meta,separators=(',',':'),ensure_ascii=False))
shutil.copyfile(r/'src/data/gita-trust.local.json',out/'gita.json')
for n in ('ramayana','mahabharata'): shutil.copyfile(source[n],out/(n+'.json'))
result={}
for name in ('gita','ramayana','mahabharata'):
 f=out/(name+'.db');f.unlink(missing_ok=True);con=sqlite3.connect(f)
 con.execute('CREATE TABLE passages(position INTEGER PRIMARY KEY, id TEXT NOT NULL UNIQUE, sa TEXT NOT NULL, en TEXT NOT NULL, hi TEXT NOT NULL)')
 if name=='gita':
  rows=((i,f"gita-hansi:{v['chapter']}:{v['verse']}",v['sanskrit'],v['english'],v['hindi']) for i,v in enumerate(gita['verses']))
 else:
  entries=json.loads((r/f'src/data/itihasa-{name}.local.json').read_text()); rows=((c['start']+i,f"{c['idPrefix']}:{i+1}",*entries[c['start']+i],'') for c in it[name]['chapters'] for i in range(c['count']))
 con.executemany('INSERT INTO passages VALUES (?,?,?,?,?)',rows);con.commit(); count=con.execute('select count(*) from passages').fetchone()[0]; con.close();result[name]={'bytes':f.stat().st_size,'sha256':hashlib.file_digest(f.open('rb'),'sha256').hexdigest(),'count':count};print(name,result[name])
(out/'download-manifest.json').write_text(json.dumps(result,indent=2))
