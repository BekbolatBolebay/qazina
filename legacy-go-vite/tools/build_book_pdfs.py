"""Build complete, searchable PDF editions and exact page/line maps from frozen source texts."""
from pathlib import Path
import json,re,subprocess
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor
from pypdf import PdfReader
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'.data/catalog'
fontpath=subprocess.check_output(['fc-match','-f','%{file}','DejaVu Serif'],text=True)
pdfmetrics.registerFont(TTFont('Book',fontpath))
boldpath=subprocess.check_output(['fc-match','-f','%{file}','DejaVu Serif:style=Bold'],text=True)
pdfmetrics.registerFont(TTFont('BookBold',boldpath))
W,H=420,595;M=43;BW=W-2*M;FONT=10.8;LEADING=16

def wrap(text,font,size,width):
 words=text.split();lines=[];line=''
 for word in words:
  trial=(line+' '+word).strip()
  if pdfmetrics.stringWidth(trial,font,size)<=width:line=trial;continue
  if line:lines.append(line);line=''
  if pdfmetrics.stringWidth(word,font,size)<=width:line=word;continue
  for ch in word:
   if pdfmetrics.stringWidth(line+ch,font,size)>width:lines.append(line);line=''
   line+=ch
 if line:lines.append(line)
 return lines
for source in json.loads((ROOT/'data/catalog/sources.json').read_text()):
 key=source['key'];b=json.loads((OUT/(key+'.json')).read_text());path=OUT/(key+'.pdf');c=canvas.Canvas(str(path),pagesize=(W,H),pageCompression=1)
 c.setTitle(b['title']);c.setAuthor(b['author']);c.setSubject('Full public-domain text. Source: '+b['source_url'])
 c.setFillColor(HexColor(b['color']));c.rect(0,0,9,H,fill=1,stroke=0)
 c.setFillColor(HexColor('#75816e'));c.setFont('Book',9);c.drawString(M,H-64,'QAZ Y N A'.replace(' ',''))
 y=H-145;c.setFillColor(HexColor('#233b2b'));c.setFont('BookBold',25)
 for line in wrap(b['title'],'BookBold',25,BW):c.drawString(M,y,line);y-=34
 y-=14;c.setFont('Book',13)
 for line in wrap(b['author'],'Book',13,BW):c.drawString(M,y,line);y-=20
 if b.get('original_title'):
  y-=14;c.setFont('Book',10)
  for line in wrap(b['original_title'],'Book',10,BW):c.drawString(M,y,line);y-=16
 c.setFillColor(HexColor('#7c8874'));c.setFont('Book',9);c.drawString(M,150,'Полный текст · '+('Русский язык' if b['language']=='ru' else 'English'))
 c.drawString(M,132,'Текст общественного достояния')
 c.setFont('Book',7.5);source_lines=wrap(b['source_url'],'Book',7.5,BW)
 for i,line in enumerate(source_lines):c.drawString(M,105-i*11,line)
 c.linkURL(b['source_url'],(M,76,W-M,120),relative=0)
 c.showPage();page=2;line_no=0;y=H-52;mapping=[]
 def header():
  c.setFillColor(HexColor('#9aa38f'));c.setFont('Book',7)
  title=b['title']
  while pdfmetrics.stringWidth(title,'Book',7)>BW:title=title[:-2]+'…'
  c.drawString(M,H-27,title);c.drawRightString(W-M,23,str(page));c.setFillColor(HexColor('#293426'));c.setFont('Book',FONT)
 header()
 for pi,paragraph in enumerate(b['paragraphs']):
  offset=0
  for line in wrap(paragraph,'Book',FONT,BW):
   if y<47:
    c.showPage();page+=1;line_no=0;y=H-52;header()
   start=paragraph.find(line,offset)
   if start<0:start=offset
   line_no+=1;mapping.append({'paragraph':pi,'page':page,'line':line_no,'start':start,'end':start+len(line),'text':line})
   c.drawString(M,y,line);y-=LEADING;offset=start+len(line)
  y-=7
 c.save();reader=PdfReader(path)
 assert len(reader.pages)==page
 assert all(p.extract_text() for p in reader.pages)
 metadata={**{k:v for k,v in b.items() if k!='paragraphs'},'pages':page,'pdf':str(path),'map':mapping}
 (OUT/(key+'.layout.json')).write_text(json.dumps(metadata,ensure_ascii=False))
 print(key,page,'pages',path.stat().st_size,'bytes',flush=True)
