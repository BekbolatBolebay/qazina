"""Import identified edition cover artwork and retain attribution; never regenerate book PDFs."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
import hashlib,json,os
import requests,psycopg
from PIL import Image,ImageOps
ROOT=Path(__file__).resolve().parents[1];UPLOAD=Path(os.environ.get('UPLOAD_DIR',ROOT/'.data/uploads'));UPLOAD.mkdir(parents=True,exist_ok=True)
items=json.loads((ROOT/'data/catalog/covers.json').read_text())
def download(item):
 cache=ROOT/'.data/covers'/(hashlib.sha256(item['image'].encode()).hexdigest()+'.bin')
 if cache.exists():content=cache.read_bytes()
 else:
  raw=requests.get(item['image'],timeout=40,headers={'User-Agent':'Mozilla/5.0 Mood book catalogue'});raw.raise_for_status();content=raw.content;cache.write_bytes(content)
 image=Image.open(BytesIO(content));image=ImageOps.exif_transpose(image).convert('RGB')
 if min(image.size)<120:raise RuntimeError('Image too small: '+item['title'])
 image.thumbnail((800,1200));buffer=BytesIO();image.save(buffer,format='JPEG',quality=91,optimize=True);data=buffer.getvalue();name=hashlib.sha256(data).hexdigest()+'.jpg';(UPLOAD/name).write_bytes(data)
 print(item['title'],image.size,flush=True);return {**item,'cover':'/uploads/'+name}
results=[];failures=[]
with ThreadPoolExecutor(max_workers=5) as pool:
 for item,result in zip(items,pool.map(lambda x:(x,download(x)),items)):
  results.append(result[1])
with psycopg.connect(os.environ['DATABASE_URL']) as conn:
 conn.execute("ALTER TABLE books ADD COLUMN IF NOT EXISTS cover_path TEXT NOT NULL DEFAULT '';ALTER TABLE books ADD COLUMN IF NOT EXISTS cover_source TEXT NOT NULL DEFAULT '';ALTER TABLE books ADD COLUMN IF NOT EXISTS cover_edition TEXT NOT NULL DEFAULT ''")
 for row in results:
  count=conn.execute('UPDATE books SET cover_path=%s,cover_source=%s,cover_edition=%s WHERE title=%s AND author=%s',(row['cover'],row['source'],row['edition'],row['title'],row['author'])).rowcount
  if count!=1:raise RuntimeError('Book identity mismatch '+row['title'])
 conn.commit()
(ROOT/'.data/covers/imported.json').write_text(json.dumps(results,ensure_ascii=False,indent=2));print('Updated',len(results),'book covers')
