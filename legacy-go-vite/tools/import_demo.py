"""Idempotent, explicitly labeled demo population. Never changes real accounts or their content."""
from pathlib import Path
from datetime import datetime,timedelta,timezone
import hashlib,json,os,random,shutil,re
from collections import Counter
import psycopg
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[1];rng=random.Random(240519)
UPLOAD=Path(os.environ.get('UPLOAD_DIR',ROOT/'.data/uploads'));UPLOAD.mkdir(parents=True,exist_ok=True)
people=[
 ('kami_reads','Ахметова Камила','студентка, читаю в автобусе'),('arsen_notes','Муратов Арсен','стратегия и немного истории'),('alina_may','Петрова Алина','дизайн, проза, кофе'),('sergey_67','Орлов Сергей','инженер, возвращаюсь к классике'),('aida_books','Сейтова Аида','книги между парами'),('timur_page','Алиев Тимур','короткая проза и долгие разговоры'),('elena_k','Ковалева Елена','учитель, читатель'),('max_reading','Соколов Максим','философия без обещаний чудес'),('asya_m','Каримова Ася','читаю медленно'),('dan_sci','Жумабеков Данияр','физика обычных вещей'),('irina_75','Волкова Ирина','книжные вечера после работы'),('nura_lit','Тлеубердиева Нура','всё время возвращаюсь к рассказам'),('roman_b','Белov Роман'.replace('ov','ов'),'история и биографии'),('saya_reads','Иманова Сая','не всегда дочитываю и это ок'),('pavel_print','Лебедев Павел','типографика и книги о ремесле'),('madina_n','Нуртаева Мадина','Астана, книги в рюкзаке'),('vera_letters','Морозова Вера','нравятся письма и дневники'),('ilya_works','Новиков Илья','разбираюсь, как устроены привычки'),('amina_ch','Смагулова Амина','короткие заметки о длинных книгах'),('alex_1971','Смирнов Алексей','читатель без жанровых ограничений'),('dasha_sun','Фёдорова Дарья','читаю и иногда спорю'),('rustem_r','Бекетов Рустем','новая книга вместо новой вкладки'),('oksana_l','Кузнецова Оксана','литература и повседневность'),('mira_book','Есенова Мира','сохраняю удачные строки'),('viktor_v','Васильев Виктор','мемуары, история, путешествия'),('aliya_english','Касымова Алия','читаю на двух языках'),('kostya_n','Никитин Константин','техническая работа, нетехнические книги'),('liza_day','Зайцева Елизавета','книги без читательской гонки'),('daulet_s','Оспанов Даулет','наука и старые рассказы'),('natalia_68','Тихонова Наталья','люблю перечитывать'),('sonya_fox','Мельникова Софья','начала с цитаты, осталась на книгу'),('igor_p','Попов Игорь','история идей'),('zhanara_t','Турсунова Жанара','читаю по дороге домой'),('oleg_1969','Егоров Олег','субботнее чтение'),('eva_slow','Павлова Ева','всё интересное требует паузы'),('samat_science','Кенжебаев Самат','не уверен — проверяю'),('valeria_a','Андреева Валерия','классика без школьной оценки'),('anton_m','Михайлов Антон','биографии и самообразование'),('gulnar_k','Абдрахманова Гульнар','книги и семейные истории'),('masha_leaf','Лукина Мария','вечно ношу с собой книгу'),('andrey_74','Захаров Андрей','смотрю на старые тексты по-новому'),('aizhan_r','Рахимова Айжан','английский через книги'),('nikita_dev','Крылов Никита','после кода читаю прозу'),('svetlana_book','Полякова Светлана','чтение без спешки'),('ruslan_e','Ермеков Руслан','учусь внимательнее слушать'),('polina_n','Соловьёва Полина','не согласиться с автором тоже чтение'),('marat_k','Сулейменов Марат','научпоп и наблюдения'),('tanya_letters','Романова Татьяна','в книгах интереснее всего люди')]

def avatar(username,name,index):
 colors=[('#e8ded0','#886b4f'),('#dce8e0','#4f7661'),('#e2e3ec','#697894'),('#ebe1df','#976f6b'),('#e7e7d8','#7b7c56'),('#dde8e9','#63838b')]
 bg,fg=colors[index%len(colors)];im=Image.new('RGB',(160,160),bg);d=ImageDraw.Draw(im)
 # Small differences in framing keep these illustrated avatars individual without impersonating anyone.
 if index%3==0:d.ellipse((-45,95,145,250),fill=fg)
 if index%3==1:d.rectangle((125,0,160,160),fill=fg)
 font=ImageFont.truetype('/usr/share/fonts/TTF/DejaVuSans.ttf',48)
 initials=''.join(part[0] for part in name.split()[:2]);box=d.textbbox((0,0),initials,font=font);d.text(((160-(box[2]-box[0]))/2,(160-(box[3]-box[1]))/2-box[1]-4),initials,font=font,fill=fg)
 filename=hashlib.sha256(('qazyna-demo-avatar:'+username).encode()).hexdigest()+'.png';im.save(UPLOAD/filename);return '/uploads/'+filename

source_books=json.loads((ROOT/'data/catalog/sources.json').read_text());discussions=json.loads((ROOT/'data/catalog/discussions.json').read_text());recs=json.loads((ROOT/'data/catalog/recommendations.json').read_text())
records=[{**d,'kind':'quote','key':f"quote:{d['book']}:{i}"} for i,d in enumerate(discussions)]+[{**d,'quote':'','kind':'recommendation','key':f"rec:{d['book']}:{i}"} for i,d in enumerate(recs)]
rng.shuffle(records)
with psycopg.connect(os.environ['DATABASE_URL']) as conn:
 conn.execute((ROOT/'backend/schema.sql').read_text())
 conn.execute('SELECT pg_advisory_xact_lock(847292)')
 ids=[]
 for i,(username,name,bio) in enumerate(people):
  photo=avatar(username,name,i)
  row=conn.execute('''INSERT INTO users(username,full_name,email,password_hash,avatar,bio,is_demo) VALUES(%s,%s,%s,'!disabled',%s,%s,true)
  ON CONFLICT (lower(username)) DO UPDATE SET avatar=EXCLUDED.avatar,bio=EXCLUDED.bio WHERE users.is_demo AND users.email=EXCLUDED.email RETURNING id''',(username,name,username+'@demo.mood.invalid',photo,'Демо-профиль · '+bio)).fetchone()
  if not row:raise RuntimeError('A real account owns the requested demo username: '+username)
  ids.append(row[0])
 conn.execute("UPDATE users SET is_demo=true,bio=CASE WHEN bio LIKE 'Демо-профиль%' THEN bio ELSE 'Демо-профиль · '||bio END WHERE username IN ('aigerim.reads','arman.books','dana.s') AND password_hash='!disabled'")
 books={};layouts={}
 for i,b in enumerate(source_books):
  layout=json.loads((ROOT/'.data/catalog'/(b['key']+'.layout.json')).read_text());layouts[b['key']]=layout
  data=Path(layout['pdf']).read_bytes();hash=hashlib.sha256(data).hexdigest();filename=hash+'.pdf';shutil.copyfile(layout['pdf'],UPLOAD/filename)
  row=conn.execute('''INSERT INTO books(title,author,description,color,uploader_id,file_path,file_hash,topic,language,source_url,license,pages,catalog_key)
   VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
   ON CONFLICT(catalog_key) WHERE catalog_key IS NOT NULL DO UPDATE SET file_path=EXCLUDED.file_path,file_hash=EXCLUDED.file_hash,pages=EXCLUDED.pages,source_url=EXCLUDED.source_url RETURNING id''',
   (b['title'],b['author'],b['description'],b['color'],ids[(i*5+3)%len(ids)],'/uploads/'+filename,hash,b['topic'],b['language'],b['url'],'Общественное достояние; источник указан в книге',layout['pages'],b['key'])).fetchone();books[b['key']]=row[0]
 counts_by_author=Counter()
 female=[i for i,person in enumerate(people) if (person[1].split()[-1].endswith(('а','я')) and person[1].split()[-1] not in ('Никита','Илья')) or person[1].split()[-1]=='Гульнар']
 old=[i for i,p in enumerate(people) if p[0] in ('sergey_67','elena_k','irina_75','alex_1971','viktor_v','natalia_68','oleg_1969','andrey_74','svetlana_book')]
 def choose_author(text,index,balance=False):
  candidates=list(range(len(people)))
  if re.search(r'\b(читала|прочитала|перечитала|взяла|начала|осталась|нашла|согласна|хотела|вернулась|решила|написала|делала|напряглась|готова|выдохнула|сохранила)\b',text,re.I):candidates=female
  elif re.search(r'\b(прочитал|перечитал|нашёл|начал|остался|взял|согласен|решил|хотел|сделал|читал|думал|чинил|вспомнил)\b',text,re.I):candidates=[i for i in candidates if i not in female]
  if re.search(r'тридцать лет|с возрастом|тридцати|за тридцать',text,re.I):candidates=[i for i in candidates if i in old] or candidates
  if balance:
   count=min(counts_by_author[i] for i in candidates);candidates=[i for i in candidates if counts_by_author[i]==count]
  selected=candidates[index%len(candidates)]
  if balance:counts_by_author[selected]+=1
  return ids[selected]
 now=datetime.now(timezone.utc);post_ids=[];comment_count=0
 for i,r in enumerate(records):
  page=0;lines=''
  if r['kind']=='quote':
   end=r['offset']+len(r['quote']);mapped=[m for m in layouts[r['book']]['map'] if m['paragraph']==r['paragraph'] and m['end']>r['offset'] and m['start']<end]
   if not mapped:raise RuntimeError('Unmapped quote '+r['key'])
   page=mapped[0]['page'];same=[m for m in mapped if m['page']==page];lines=str(same[0]['line']) if same[0]['line']==same[-1]['line'] else f"{same[0]['line']}–{same[-1]['line']}"
   if mapped[-1]['page']!=page:lines+=f"; далее стр. {mapped[-1]['page']}"
  created=now-timedelta(hours=(len(records)-i)*4,minutes=rng.randrange(1,55))
  author=choose_author(r['opinion'],i*13+5,True)
  pid=conn.execute('''INSERT INTO posts(user_id,book_id,kind,quote,opinion,page,lines,created_at,demo_key) VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s)
    ON CONFLICT(demo_key) WHERE demo_key IS NOT NULL DO UPDATE SET user_id=EXCLUDED.user_id,quote=EXCLUDED.quote,opinion=EXCLUDED.opinion,page=EXCLUDED.page,lines=EXCLUDED.lines RETURNING id''',
    (author,books[r['book']],r['kind'],r['quote'],r['opinion'],page,lines,created,'catalog-v1:'+r['key'])).fetchone()[0];post_ids.append(pid)
  conn.execute('DELETE FROM post_likes WHERE post_id=%s AND user_id=ANY(%s)',(pid,ids))
  count=rng.choice([3,5,8,11,14,19,23,27,32,38,43])
  for liker in rng.sample([u for u in ids if u!=author],count):conn.execute('INSERT INTO post_likes(user_id,post_id) VALUES(%s,%s) ON CONFLICT DO NOTHING',(liker,pid))
  for ci,body in enumerate(r['comments']):
   commenter=choose_author(body,i*7+ci*11+2)
   conn.execute('''INSERT INTO comments(user_id,post_id,body,created_at,demo_key) VALUES(%s,%s,%s,%s,%s) ON CONFLICT(demo_key) WHERE demo_key IS NOT NULL DO UPDATE SET user_id=EXCLUDED.user_id''',
    (commenter,pid,body,created+timedelta(minutes=11+ci*31),'catalog-v1:'+r['key']+':'+str(ci)));comment_count+=1
 for i,uid in enumerate(ids):
  for target in rng.sample([u for u in ids if u!=uid],rng.randrange(3,10)):conn.execute('INSERT INTO follows(user_id,target_id) VALUES(%s,%s) ON CONFLICT DO NOTHING',(uid,target))
  for bid in rng.sample(list(books.values()),rng.randrange(1,6)):conn.execute('INSERT INTO book_likes(user_id,book_id) VALUES(%s,%s) ON CONFLICT DO NOTHING',(uid,bid))
 counts=conn.execute('''SELECT (SELECT count(*) FROM users WHERE is_demo),(SELECT count(*) FROM books WHERE catalog_key IS NOT NULL),(SELECT count(*) FROM posts WHERE demo_key IS NOT NULL),(SELECT count(*) FROM comments WHERE demo_key IS NOT NULL),(SELECT count(*) FROM post_likes l JOIN posts p ON p.id=l.post_id WHERE p.demo_key IS NOT NULL)''').fetchone()
 conn.commit()
 print(json.dumps(dict(zip(['demo_profiles','downloaded_books','demo_posts','demo_comments','demo_likes'],counts)),ensure_ascii=False))
