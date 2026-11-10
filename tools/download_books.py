"""Download and retain unabridged public-domain source texts; no summaries or invented passages."""
from pathlib import Path
from urllib.parse import quote
import json,re,requests,time
from bs4 import BeautifulSoup
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'.data/catalog';OUT.mkdir(parents=True,exist_ok=True)
SOURCES=json.loads((ROOT/'data/catalog/sources.json').read_text())
session=requests.Session();session.headers['User-Agent']='MoodLibrary/0.1 (personal local public-domain reading application)'
def normalize(s):return re.sub(r'\s+',' ',s).strip()
for book in SOURCES:
 target=OUT/(book['key']+'.json')
 if target.exists():
  print(book['key'],'cached');continue
 response=session.get(book['url'],timeout=45);response.raise_for_status();response.encoding='utf-8'
 raw=response.text;(OUT/(book['key']+('.html' if 'wikisource' in book['url'] else '.txt'))).write_text(raw)
 if 'wikisource' in book['url']:
  soup=BeautifulSoup(raw,'html.parser');main=soup.select_one('.mw-parser-output')
  if not main:raise RuntimeError('No full text: '+book['key'])
  for el in main.select('table, .noprint, .ws-noexport, .mw-editsection, .navbox, .licenseContainer, .license, .catlinks, .headerContainer, .ws-header, sup.reference, .printfooter, .metadata'):
   el.decompose()
  paragraphs=[normalize(p.get_text(' ',strip=True)) for p in main.select('p')]
  paragraphs=[p for p in paragraphs if len(p)>8 and not p.startswith(('Источник:','↑','Авторское право','Это произведение','Текст доступен'))]
 else:
  match=re.search(r'\*\*\* START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK .*?\*\*\*',raw,re.I)
  end=re.search(r'\*\*\* END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK',raw,re.I)
  if not match or not end:raise RuntimeError('Gutenberg boundaries missing '+book['key'])
  body=raw[match.end():end.start()]
  paragraphs=[normalize(p) for p in re.split(r'\n\s*\n',body) if normalize(p)]
 if book['key']=='chameleon':
  start=next(i for i,p in enumerate(paragraphs) if p.startswith('Через базарную площадь'))
  end=next(i for i,p in enumerate(paragraphs) if 'продолжает свой путь по базарной площади' in p)
  paragraphs=paragraphs[start:end+1]
 if book['key']=='what-men-live-by':paragraphs=[p for p in paragraphs if not p.startswith('I · II ·')]
 if len(' '.join(paragraphs))<4000:raise RuntimeError('Suspiciously short book '+book['key'])
 record={**book,'paragraphs':paragraphs,'source_url':response.url,'downloaded_at':time.strftime('%Y-%m-%d'),'characters':sum(map(len,paragraphs))}
 target.write_text(json.dumps(record,ensure_ascii=False,indent=2))
 print(book['key'],len(paragraphs),'paragraphs',record['characters'],'characters')
