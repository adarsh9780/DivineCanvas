#!/usr/bin/env python3
"""Prepare the private offline reading database from normalized Itihasa JSON."""
import json
import sqlite3
from pathlib import Path
root = Path(__file__).resolve().parent.parent
data = root / 'src/data'
out = root / 'assets/books/itihasa.local.db'
tmp = out.with_suffix('.tmp')
tmp.unlink(missing_ok=True)
manifest = json.loads((data / 'itihasa-manifest.json').read_text())
with sqlite3.connect(tmp) as conn:
    conn.execute('CREATE TABLE passages(book TEXT NOT NULL, position INTEGER NOT NULL, id TEXT NOT NULL UNIQUE, sa TEXT NOT NULL, en TEXT NOT NULL, PRIMARY KEY(book,position))')
    for name in ('ramayana', 'mahabharata'):
        entries = json.loads((data / f'itihasa-{name}.local.json').read_text())
        rows = ((f'itihasa-{name}', c['start'] + i, f"{c['idPrefix']}:{i+1}", *entries[c['start'] + i]) for c in manifest[name]['chapters'] for i in range(c['count']))
        conn.executemany('INSERT INTO passages VALUES (?,?,?,?,?)', rows)
        count = conn.execute('SELECT count(*) FROM passages WHERE book = ?', (f'itihasa-{name}',)).fetchone()[0]
        if count != len(entries): raise ValueError(f'{name}: unexpected passage count')
        print(f'{name}: {count} passages')
tmp.replace(out)
print(f'Created {out} ({out.stat().st_size} bytes)')
