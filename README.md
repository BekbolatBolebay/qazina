# QAZINA & «Жатақхана құпиясы» (MVP 1.0)

**Ұран:** «Кітапты іздеме. Оқиға сені тапсын.»

Бұл жоба екі өзара толықтыратын техникалық тапсырма негізінде құрылған:
1. **QAZINA — Интеллектуалды әдеби платформа (Next.js 15, React 19, TypeScript, Tailwind CSS 3.4)**:
   - **QAZINA Mood (`/`)**: Тіркеусіз көңіл күй енгізу (1000 таңбаға дейін), 9 дайын эмоция, 5 оқырман ниеті, жас сүзгісі (`10-13`, `14-17`, `18-24`, `25+`) және қауіпсіздік / дағдарыстық қолдау тексерісі.
   - **Discover & Dialogue-First (`/discover`)**: Алғашқы карточкада кітап атауы, авторы және мұқабасы жасырылады (`revealed: false`). Салмақты ранжирлеу формуласы:
     `Score = 0.30*MoodMatch + 0.25*HookScore + 0.15*DialogueQuality + 0.15*EmotionalRelevance + 0.10*Readability + 0.05*ContextClarity`
   - **Reveal & Character Match**: «Ары қарай не болды?» батырмасын басқанда ғана `POST /api/fragments/:id/reveal` арқылы кітап деректері мен кейіпкермен сәйкестік ашылады.
   - **«Сен оның орнында болсаң?»**: Үзінділерге арналған бағалаусыз дилемма сұрақтары.
   - **QAZINA Reader (`/read/[slug]?anchor=[id]`)**: Кітапты дәл үзінді аяқталған сөйлемнен ашып, осы позицияны ерекшелеп көрсетеді.
   - **Collections («Ой сақтау», `/saved`)**: 5 түстік санат және жеке ескертпелер (`localStorage` + `/api/saved`).
   - **Library (`/books`)**, **Moments (`/moments`)**, **Profile (`/profile`)**, **Admin & KPI Analytics (`/admin`)** — 44 кітаптық қор, құқықтық мәртебелер және KPI метрикалары.
2. **Жатақхана құпиясы (`/quest`, `/quest/clue/[id]`)**:
   - Студенттердің оқуға қызығушылығын арттыруға арналған 16 бөлімдік (~3240 сөз) мистикалық студенттік детектив.
   - Threads / Telegram Stories стиліндегі бірінші жақтан баяндау, диалогтар, әр бөлім соңында келесі бөлімге өту батырмасы және ашық финал.
   - Кампусқа ілуге арналған 7 QR-кодты баспа парақшасы (парта, жатақхана қабырғасы, асхана, демалыс аймағы, кітапхана, хабарландыру тақтасы, 404-бөлме), интерактивті реттілік пазлы және PDF / Google Docs (`.doc`) / Markdown (`.md`) / Telegram экспорты.
   - Түпнұсқа мәтін жинағы: [JALAKHANA_QUPIYASY_QUEST.md](docs/JALAKHANA_QUPIYASY_QUEST.md).

## Бұлттық LLM API баптауы (AlemLLM / Ollama Cloud / OpenAI / Groq)

Қолданба API кілтсіз де жылдам **Offline MVP** режимінде (<50 мс) толық жұмыс істейді. Бұлттық LLM қосу үшін екі тәсілдің бірін таңдаңыз:
1. `.env.local` файлына кілтіңізді жазыңыз:
   ```env
   LLM_PROVIDER=alem
   LLM_API_URL=https://llm.alem.ai/chat/completions
   LLM_API_KEY=сіздің_кілтіңіз
   LLM_MODEL=gpt-oss
   ```
   *(Немесе Ollama Cloud: `LLM_API_URL=https://ollama.com/api/chat`, `LLM_MODEL=gpt-oss:20b-cloud`)*
2. Немесе сайттың жоғарғы панеліндегі **«AI API»** батырмасы арқылы кілтті браузер ішінде енгізіңіз.

## Іске қосу және тексеру

```bash
# 1. Типтер мен жинақты тексеру
npm run lint
npm run build

# 2. Қосу (production режимінде http://127.0.0.1:3000)
./run

# Немесе әзірлеу режимінде:
npm run dev

# 3. Тоқтату
./stop
```

## API маршруттары

- `POST /api/mood/analyze` — көңіл күйді, тілді, ниетті және қауіпсіздік дабылын талдау
- `POST /api/recommendations` — жасырын үзінді ұсыну (`revealed: false`)
- `GET /api/fragments/:id` — үзіндіні алу (метадерексіз)
- `POST /api/fragments/:id/reveal` — кітап деректерін және кейіпкер сәйкестігін ашу
- `GET /api/books`, `GET /api/books/:slug`, `GET /api/books/:slug/chapters`
- `GET/POST /api/saved`, `DELETE /api/saved/:id`
- `GET/PUT /api/profile`
- `GET/POST /api/analytics/summary`
- `GET/POST /api/llm/status`
- `GET/POST /api/quest`
- `GET /api/admin/storage` — Alem Plus Supabase PostgreSQL (`qazina_books` — 90 кітап, `qazina_fragments` — 69 үзінді) және MinIO күйі

## Google Drive кітап қоры мен Supabase синхронизациясы

```bash
# Google Drive (50 PDF кітап) мәтінін алу және src/data/books.json / fragments.json жаңарту
node scripts/ingest_drive_books.mjs

# Барлық кітаптар мен үзінділерді Alem Plus Supabase PostgreSQL базасына жүктеу
node scripts/sync_supabase.mjs
```

_Бұрынғы Go + Vite нұсқасы `legacy-go-vite/` папкасында сақталған._
