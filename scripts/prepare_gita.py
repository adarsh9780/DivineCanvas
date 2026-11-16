import zipfile,glob,xml.etree.ElementTree as ET,re,collections,json,sys
p=sys.argv[1]; records=[]; chapter=0; entry=None; awaiting_translation=False
with zipfile.ZipFile(p) as z:
 root=ET.fromstring(z.read('content.opf')); ns={'o':'http://www.idpf.org/2007/opf'}
 manifest={i.attrib['id']:i.attrib['href'] for i in root.findall('.//o:manifest/o:item',ns)}
 for it in root.findall('.//o:spine/o:itemref',ns):
  name=manifest[it.attrib['idref']]
  if not name.endswith(('.html','.xhtml')): continue
  doc=ET.fromstring(z.read(name))
  for node in doc.iter():
   cls=node.attrib.get('class',''); content=' '.join(''.join(node.itertext()).split())
   match=re.fullmatch(r'Chapter-(\d+)',content) if node.tag.endswith('h3') else None
   if match: chapter=int(match.group(1))
   if not chapter: continue
   if cls in ('verse-text','verse-text1') and re.fullmatch(r'TEXTS?\s+\d+(?:\s*[-–]\s*\d+)?',content,re.I):
    if entry: records.append(entry)
    entry={'chapter':chapter,'label':content,'sanskrit':'','english':''}
   elif entry and cls in ('verse','verse1','verse2'):
    parts = [node.text or '']
    for child in node:
     if child.tag.endswith(('span','br')): parts.extend([' '.join(child.itertext()), child.tail or ''])
     else: break
    entry['sanskrit'] += ('\n' if entry['sanskrit'] else '') + ' '.join(' '.join(parts).split())
   elif entry and cls.startswith('verse-hed') and content == 'TRANSLATION': awaiting_translation=True
   elif entry and awaiting_translation and cls in ('data-trs','data-trs1','purport','purport4'):
    entry['english'] += ('\n' if entry['english'] else '') + content; awaiting_translation=False
 if entry: records.append(entry)

if len(records) != 653 or any(not x['sanskrit'] or not x['english'] for x in records):
 raise ValueError(str([(x['chapter'], x['label'],bool(x['sanskrit']),bool(x['english'])) for x in records if not x['sanskrit'] or not x['english']]))
if set(x['chapter'] for x in records) != set(range(1, 19)):
 raise ValueError('Missing chapter')
with open(sys.argv[2], 'w', encoding='utf8') as output:
 json.dump(records, output, ensure_ascii=False, indent=2)
print(f'Extracted {len(records)} verse entries across 18 chapters.')
