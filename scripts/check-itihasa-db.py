import json,sqlite3,random
from pathlib import Path
r=Path(__file__).resolve().parent.parent;m=json.loads((r/'src/data/itihasa-manifest.json').read_text());db=sqlite3.connect('file:'+str(r/'assets/books/itihasa.local.db')+'?mode=ro',uri=True)
random.seed(3)
for name in ('ramayana','mahabharata'):
 entries=json.loads((r/f'src/data/itihasa-{name}.local.json').read_text()); book='itihasa-'+name
 for center in [0,len(entries)-1]+[random.randrange(len(entries)) for _ in range(200)]:
  first=max(0,center-3);last=min(len(entries),center+4)
  rows=db.execute('select position,sa,en from passages where book=? and position between ? and ? order by position',(book,first,center+3)).fetchall()
  assert len(rows)<=7 and rows==[(i,*entries[i]) for i in range(first,last)]
 for c in m[name]['chapters']:
  for offset in (0,c['count']-1):
   i=c['start']+offset;row=db.execute('select id from passages where book=? and position=?',(book,i)).fetchone(); assert row[0]==c['idPrefix']+':'+str(offset+1)
 print('PASS',name,'bounded windows and chapter IDs')
