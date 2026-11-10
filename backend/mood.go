package main

// Подбор книг по эмоции — быстрый, в три шага:
//  1. код: слова из эмоции читателя ищем в названиях, авторах, жанрах и
//     описаниях библиотеки (быстрый пред-фильтр без LLM);
//  2. LLM одним вызовом получает каталог и подсказку код-поиска и выбирает
//     ровно 3 книги (модель не тратит ходы на инструменты);
//  3. цитаты ищутся параллельно — по одному вызову LLM на каждую книгу,
//     на конкретных страницах, которые код отобрал по словам читателя.
//
// Результат отдаётся потоком (SSE): резюме, затем каждая книга сразу, как
// только её цитата готова, — первая книга появляется в ленте, не дожидаясь
// остальных. Если модель недоступна, срабатывает детерминированный fallback.

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
	"unicode"
)

const (
	moodEmotionMax   = 300
	moodPickCount    = 3
	moodWhyMax       = 400
	moodSummaryMax   = 500
	moodExcerptMin   = 40 // минимальный размер цитаты: короче — неинтригующий обрывок
	moodExcerptMax   = 450
	moodPageChars    = 1500
	moodCatalogMax   = 30 // при большем каталоге модели показываем только топ
	moodCatalogLimit = 24 // сколько максимум книг входит в промпт
	moodWordMax      = 12 // сколько слов эмоции идёт в код-поиск
	moodPageFetchMax = 80 // сколько страниц читаем для отбора релевантных
	moodRelevantTop  = 2  // сколько «словесных» страниц добавить к основным
	moodPageMax      = 6  // сколько страниц показать модели под цитату
	moodQuoteMinPage = 10 // цитаты берём не с начала книги, а с «тела»
	moodPhase1Max    = 60 * time.Second
	moodPhase2Max    = 150 * time.Second
)

var (
	errMoodEngine = errors.New("модель подбора недоступна")
	errMoodResult = errors.New("модель не вернула валидный подбор")
	// errMoodRateLimited — провайдер сжёг квоту запросов; дальше в этом
	// запросе LLM не зовём, сразу детерминированный fallback.
	errMoodRateLimited = errors.New("модель: лимит запросов провайдера")
)

const moodSystemPrompt = `Ты — литературный куратор соцсети Mood. Читатель присылает эмоцию или внутреннее состояние. Подбери из каталога ровно 3 книги, которые точно отвечают этой эмоции.
Читай то, что написал именно этот человек: какие чувства в его словах, в какой он ситуации, о чём он на самом деле говорит. Не подставляй шаблон.
Бери только id из каталога — никогда не выдумывай. Приоритет книгам с has_text: true — для них читателю можно показать отрывок из текста.
Финальный ответ — только JSON, без комментариев, без markdown:
{"summary": "Одним-двумя предложениями: как ты понял эмоцию читателя.", "books": [{"id": 1, "why": "1-2 предложения, почему именно эта книга откликается на его эмоцию."}]}`

var (
	statusMu     sync.Mutex
	statusCached time.Time
	statusAvail  bool
)

type moodRequest struct {
	Emotion string `json:"emotion"`
}
type moodExcerpt struct {
	Page int    `json:"page"`
	Text string `json:"text"`
}
type moodPick struct {
	Book    book         `json:"book"`
	Why     string       `json:"why"`
	Excerpt *moodExcerpt `json:"excerpt,omitempty"`
}
type moodResult struct {
	Emotion string     `json:"emotion"`
	Summary string     `json:"summary"`
	Books   []moodPick `json:"books"`
}
type moodCatalogItem struct {
	ID          int64  `json:"id"`
	Title       string `json:"title"`
	Author      string `json:"author"`
	Topic       string `json:"topic"`
	Language    string `json:"language"`
	Pages       int    `json:"pages"`
	Description string `json:"description"`
	HasText     bool   `json:"has_text"`
}
type moodPage struct {
	Page int
	Text string
}

// llmMessage — сообщение диалога в OpenAI-формате.
type llmMessage struct {
	Role    string // system, user, assistant
	Content string
}

// ---------- HTTP: JSON-эндпоинт (совместимость) и SSE-поток ----------

func (a *app) moodBooks(w http.ResponseWriter, r *http.Request) {
	var in moodRequest
	if !decode(w, r, &in) {
		return
	}
	in.Emotion = normalizeEmotion(in.Emotion)
	if in.Emotion == "" {
		fail(w, 400, "Напишите эмоцию или состояние, например: «устал после долгой недели»")
		return
	}
	host, _, _ := net.SplitHostPort(r.RemoteAddr)
	if !a.limiter.allow(host+":mood", 5) {
		fail(w, 429, "Слишком много подборов. Попробуйте через минуту")
		return
	}
	res, err := a.selectMoodBooks(r.Context(), a.viewer(r), in.Emotion)
	if err != nil {
		switch {
		case errors.Is(err, errMoodEngine), errors.Is(err, errMoodRateLimited):
			fail(w, 503, "Модель подбора сейчас недоступна. Попробуйте позже")
			return
		case errors.Is(err, errMoodResult):
			fail(w, 502, "Не удалось подобрать 3 книги. Попробуйте переформулировать эмоцию")
			return
		case errors.Is(err, context.DeadlineExceeded):
			fail(w, 504, "Модель думала слишком долго. Попробуйте ещё раз")
			return
		default:
			log.Printf("mood: %v", err)
			fail(w, 503, "Не удалось подобрать книги. Попробуйте позже")
			return
		}
	}
	res.Emotion = in.Emotion
	// Вторая фаза не привязана к тайм-ауту запроса: цитаты для всех книг
	// ищутся параллельно, каждая не дольше 150 секунд.
	phaseCtx, cancel := context.WithTimeout(context.Background(), moodPhase2Max)
	defer cancel()
	a.pickExcerptsParallel(phaseCtx, in.Emotion, res.Books)
	respond(w, 200, res)
}

// moodStream — тот же подбор, но результат идёт потоком (SSE):
// event summary — как только выбраны книги, event book — по одному на каждую
// книгу, сразу когда её цитата готова, event done — когда все три на месте.
func (a *app) moodStream(w http.ResponseWriter, r *http.Request) {
	var in moodRequest
	if !decode(w, r, &in) {
		return
	}
	in.Emotion = normalizeEmotion(in.Emotion)
	if in.Emotion == "" {
		fail(w, 400, "Напишите эмоцию или состояние, например: «устал после долгой недели»")
		return
	}
	host, _, _ := net.SplitHostPort(r.RemoteAddr)
	if !a.limiter.allow(host+":mood", 5) {
		fail(w, 429, "Слишком много подборов. Попробуйте через минуту")
		return
	}
	flusher, ok := w.(http.Flusher)
	if !ok {
		fail(w, 500, "Потоковая передача недоступна")
		return
	}
	w.Header().Set("Content-Type", "text/event-stream; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("X-Accel-Buffering", "no")
	w.WriteHeader(http.StatusOK)
	sendMoodEvent(w, flusher, "started", map[string]string{"emotion": in.Emotion})

	phase1Ctx, cancel := context.WithTimeout(r.Context(), moodPhase1Max)
	defer cancel()
	res, err := a.selectMoodBooks(phase1Ctx, a.viewer(r), in.Emotion)
	if err != nil {
		switch {
		case errors.Is(err, errMoodEngine), errors.Is(err, errMoodRateLimited):
			sendMoodEvent(w, flusher, "error", map[string]string{"error": "Модель подбора сейчас недоступна. Попробуйте позже"})
		case errors.Is(err, errMoodResult):
			sendMoodEvent(w, flusher, "error", map[string]string{"error": "Не удалось подобрать 3 книги. Попробуйте переформулировать эмоцию"})
		case errors.Is(err, context.DeadlineExceeded):
			sendMoodEvent(w, flusher, "error", map[string]string{"error": "Модель думала слишком долго. Попробуйте ещё раз"})
		default:
			log.Printf("mood: stream: %v", err)
			sendMoodEvent(w, flusher, "error", map[string]string{"error": "Не удалось подобрать книги. Попробуйте позже"})
		}
		return
	}
	sendMoodEvent(w, flusher, "summary", map[string]string{"emotion": in.Emotion, "summary": res.Summary})

	type finished struct {
		position int
		pick     moodPick
	}
	ch := make(chan finished, moodPickCount)
	phaseCtx, cancel2 := context.WithTimeout(context.Background(), moodPhase2Max)
	defer cancel2()
	for i := range res.Books {
		i := i
		go func() {
			// Лёгкий стэйджер: не шлём все вызовы в одну секунду, чтобы не
			// упереться в пер-секундный лимит провайдера.
			time.Sleep(time.Duration(i) * 150 * time.Millisecond)
			res.Books[i].Excerpt = a.pickExcerptFor(phaseCtx, in.Emotion, res.Books[i])
			ch <- finished{position: i + 1, pick: res.Books[i]}
		}()
	}
	for range res.Books {
		select {
		case <-r.Context().Done():
			return
		case f := <-ch:
			sendMoodEvent(w, flusher, "book", map[string]any{
				"position": f.position,
				"book":     f.pick.Book,
				"why":      f.pick.Why,
				"excerpt":  f.pick.Excerpt,
			})
		}
	}
	sendMoodEvent(w, flusher, "done", map[string]any{})
}

func sendMoodEvent(w http.ResponseWriter, f http.Flusher, event string, data any) {
	b, e := json.Marshal(data)
	if e != nil {
		return
	}
	fmt.Fprintf(w, "event: %s\ndata: %s\n\n", event, b)
	f.Flush()
}

func (a *app) moodStatus(w http.ResponseWriter, r *http.Request) {
	if a.llmAPIKey == "" {
		respond(w, 200, map[string]any{"available": false, "model": a.llmModel})
		return
	}
	statusMu.Lock()
	if time.Since(statusCached) < time.Minute {
		cached := statusAvail
		statusMu.Unlock()
		respond(w, 200, map[string]any{"available": cached, "model": a.llmModel})
		return
	}
	statusMu.Unlock()
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	base := strings.TrimSuffix(a.llmURL, "/chat/completions")
	available := false
	if req, e := http.NewRequestWithContext(ctx, "GET", base+"/models", nil); e == nil {
		req.Header.Set("Authorization", "Bearer "+a.llmAPIKey)
		if res, e2 := a.moodHTTP.Do(req); e2 == nil {
			res.Body.Close()
			available = res.StatusCode == 200
		}
	}
	statusMu.Lock()
	statusCached = time.Now()
	statusAvail = available
	statusMu.Unlock()
	respond(w, 200, map[string]any{"available": available, "model": a.llmModel})
}

func normalizeEmotion(s string) string {
	s = strings.Join(strings.Fields(s), " ")
	r := []rune(s)
	if len(r) > moodEmotionMax {
		r = r[:moodEmotionMax]
	}
	return strings.Trim(string(r), "«»\"' ")
}

// ---------- Фаза 1: код-поиск + один вызов LLM ----------

// emotionWords — слова из текста эмоции для код-поиска: строчные,
// длиной не короче 3 букв, не более moodWordMax, без повторов.
func emotionWords(s string) []string {
	words := []string{}
	seen := map[string]bool{}
	var cur strings.Builder
	flush := func() {
		w := strings.ToLower(cur.String())
		cur.Reset()
		if len([]rune(w)) >= 3 && !seen[w] {
			seen[w] = true
			words = append(words, w)
		}
	}
	for _, r := range s {
		if unicode.IsLetter(r) {
			cur.WriteRune(r)
		} else {
			flush()
		}
	}
	flush()
	if len(words) > moodWordMax {
		words = words[:moodWordMax]
	}
	return words
}

// moodCodeSearch — поиск книг по словам эмоции: возвращает id книги и
// число совпадений (название — 3, автор — 2, жанр — 2, описание — 1).
func (a *app) moodCodeSearch(ctx context.Context, words []string) (map[int64]int, error) {
	out := map[int64]int{}
	if len(words) == 0 {
		return out, nil
	}
	patterns := make([]string, len(words))
	for i, w := range words {
		patterns[i] = "%" + w + "%"
	}
	rows, e := a.db.Query(ctx, `SELECT b.id,
  (CASE WHEN title ILIKE ANY($1) THEN 3 ELSE 0 END +
   CASE WHEN author ILIKE ANY($1) THEN 2 ELSE 0 END +
   CASE WHEN topic ILIKE ANY($1) THEN 2 ELSE 0 END +
   CASE WHEN description ILIKE ANY($1) THEN 1 ELSE 0 END)
 FROM books b
 WHERE title ILIKE ANY($1) OR author ILIKE ANY($1) OR topic ILIKE ANY($1) OR description ILIKE ANY($1)`, patterns)
	if e != nil {
		return nil, e
	}
	defer rows.Close()
	for rows.Next() {
		var id int64
		var score int
		if e = rows.Scan(&id, &score); e != nil {
			return nil, e
		}
		out[id] = score
	}
	return out, rows.Err()
}

// moodCatalog — книги для промпта: весь каталог; если он больше
// moodCatalogMax — только топ по совпадениям с эмоцией читателя.
func (a *app) moodCatalog(ctx context.Context, scores map[int64]int) ([]moodCatalogItem, error) {
	rows, e := a.db.Query(ctx, `SELECT b.id,b.title,b.author,b.topic,b.language,b.pages,left(b.description,220),EXISTS(SELECT 1 FROM book_pages bp WHERE bp.book_id=b.id) FROM books b ORDER BY b.id`)
	if e != nil {
		return nil, e
	}
	defer rows.Close()
	items := []moodCatalogItem{}
	for rows.Next() {
		var it moodCatalogItem
		if e = rows.Scan(&it.ID, &it.Title, &it.Author, &it.Topic, &it.Language, &it.Pages, &it.Description, &it.HasText); e != nil {
			return nil, e
		}
		items = append(items, it)
	}
	if e = rows.Err(); e != nil {
		return nil, e
	}
	if len(items) > moodCatalogMax {
		sort.SliceStable(items, func(i, j int) bool {
			si, sj := scores[items[i].ID], scores[items[j].ID]
			if si != sj {
				return si > sj
			}
			if items[i].HasText != items[j].HasText {
				return items[i].HasText
			}
			return items[i].ID > items[j].ID
		})
		items = items[:moodCatalogLimit]
	}
	return items, nil
}

// selectMoodBooks — первая фаза: код-поиск подсказывает модели, где искать,
// а сама модель одним вызовом выбирает ровно 3 книги из каталога.
func (a *app) selectMoodBooks(ctx context.Context, viewer int64, emotion string) (*moodResult, error) {
	start := time.Now()
	words := emotionWords(emotion)
	scores, e := a.moodCodeSearch(ctx, words)
	if e != nil {
		return nil, e
	}
	catalog, e := a.moodCatalog(ctx, scores)
	if e != nil {
		return nil, e
	}
	if len(catalog) == 0 {
		return a.fallbackMood(ctx, viewer)
	}
	hint := "Код-поиск по словам читателя совпадений не дал — выбирай по смыслу описаний из каталога."
	if len(scores) > 0 {
		ids := make([]int64, 0, len(scores))
		for id := range scores {
			ids = append(ids, id)
		}
		sort.Slice(ids, func(i, j int) bool { return scores[ids[i]] > scores[ids[j]] })
		idsStr := make([]string, len(ids))
		for i, id := range ids {
			idsStr[i] = strconv.FormatInt(id, 10)
		}
		hint = fmt.Sprintf("Код-поиск по словам читателя (слова: %s) нашёл совпадения с книгами: %s. Это подсказка, не правило: бери их, если они действительно откликаются эмоции.", strings.Join(words, ", "), strings.Join(idsStr, ", "))
	}
	catalogJSON, _ := json.Marshal(catalog)
	messages := []llmMessage{
		{Role: "system", Content: moodSystemPrompt},
		{Role: "user", Content: "Эмоция или состояние: «" + emotion + "»\n\n" + hint + "\n\nКаталог:\n" + string(catalogJSON)},
	}
	for attempt := 0; attempt < 2; attempt++ {
		msg, e := a.llmChat(ctx, messages, 2)
		if e != nil {
			if ctx.Err() != nil {
				return nil, ctx.Err()
			}
			log.Printf("mood: llm selection failed: %v — детерминированный fallback", e)
			return a.fallbackMood(ctx, viewer)
		}
		res, e := a.parseMoodFinal(ctx, viewer, msg.Content)
		if e == nil {
			log.Printf("mood: selection took %s (catalog=%d, code-hits=%d)", time.Since(start).Round(time.Millisecond), len(catalog), len(scores))
			return res, nil
		}
		log.Printf("mood: selection parse failed (attempt %d): %.300s", attempt+1, msg.Content)
		messages = append(messages,
			*msg,
			llmMessage{Role: "user", Content: "Ответ не распознан. Выбери ровно 3 книги из каталога (только их id) и ответь только JSON: {\"summary\": \"...\", \"books\": [{\"id\": 1, \"why\": \"...\"}]}."},
		)
	}
	log.Printf("mood: selection keeps failing — детерминированный fallback")
	return a.fallbackMood(ctx, viewer)
}

// fallbackMood — подбор без модели: три книги с полным текстом (по числу
// «спасибо»), при нехватке — остальные. Благодаря ему подбор всегда
// возвращает три книги, даже если провайдер LLM не отвечает.
func (a *app) fallbackMood(ctx context.Context, viewer int64) (*moodResult, error) {
	var books []book
	if rows, e := a.db.Query(ctx, bookSelect+`
		WHERE EXISTS(SELECT 1 FROM book_pages bp WHERE bp.book_id=b.id)
		ORDER BY (SELECT count(*) FROM book_likes l WHERE l.book_id=b.id) DESC, b.id ASC LIMIT $2`, viewer, moodPickCount); e == nil {
		for rows.Next() {
			var b book
			if e := rows.Scan(&b.ID, &b.Title, &b.Author, &b.Description, &b.Color, &b.File, &b.Topic, &b.Language, &b.Source, &b.License, &b.Pages, &b.Cover, &b.CoverSource, &b.CoverEdition, &b.UploaderID, &b.Uploader, &b.Likes, &b.Liked, &b.Saved); e == nil {
				books = append(books, b)
			}
		}
		rows.Close()
	}
	if len(books) < moodPickCount {
		rows, e := a.db.Query(ctx, bookSelect+`
			WHERE NOT EXISTS(SELECT 1 FROM book_pages bp WHERE bp.book_id=b.id)
			ORDER BY b.id ASC LIMIT $2`, viewer, moodPickCount-len(books))
		if e == nil {
			for rows.Next() {
				var b book
				if e := rows.Scan(&b.ID, &b.Title, &b.Author, &b.Description, &b.Color, &b.File, &b.Topic, &b.Language, &b.Source, &b.License, &b.Pages, &b.Cover, &b.CoverSource, &b.CoverEdition, &b.UploaderID, &b.Uploader, &b.Likes, &b.Liked, &b.Saved); e == nil {
					books = append(books, b)
				}
			}
			rows.Close()
		}
	}
	if len(books) < moodPickCount {
		return nil, errMoodResult
	}
	res := &moodResult{Summary: "Подобрали три книги под ваше состояние.", Books: []moodPick{}}
	for _, b := range books[:moodPickCount] {
		res.Books = append(res.Books, moodPick{Book: b, Why: "Куратор выбрал эту книгу под ваше состояние."})
	}
	return res, nil
}

// ---------- Фаза 2: параллельные цитаты по одной книге на вызов ----------

// pickExcerptsParallel — вторая фаза: цитаты для всех книг ищутся
// одновременно, каждая своим вызовом LLM.
func (a *app) pickExcerptsParallel(ctx context.Context, emotion string, picks []moodPick) {
	var wg sync.WaitGroup
	for i := range picks {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			time.Sleep(time.Duration(i) * 150 * time.Millisecond)
			picks[i].Excerpt = a.pickExcerptFor(ctx, emotion, picks[i])
		}(i)
	}
	wg.Wait()
}

// pickExcerptFor — интригующая цитата одной книги: модель берёт 1–2
// предложения только с показанных страниц; сервер проверяет дословность
// в тексте книги, а при провале берёт безопасный отрывок из начала.
func (a *app) pickExcerptFor(ctx context.Context, emotion string, p moodPick) *moodExcerpt {
	b := p.Book
	ok, e := a.ensureBookText(ctx, b.ID)
	if e != nil {
		log.Printf("mood: text of book %d: %v", b.ID, e)
		return a.fallbackExcerpt(ctx, b.ID)
	}
	if !ok {
		return nil
	}
	pages := a.relevantPages(ctx, b.ID, emotion)
	if len(pages) == 0 {
		return nil
	}
	var body strings.Builder
	for _, pg := range pages {
		fmt.Fprintf(&body, "Страница %d:\n%s\n\n", pg.Page, capRunes(pg.Text, moodPageChars))
	}
	system := "Ты — литературный куратор соцсети Mood. Ниже — страницы одной книги. Выбери 1–2 коротких предложения (не более 3) ТОЛЬКО из приведённого текста так, чтобы они 1) откликались на эмоцию читателя и 2) вызывали интригу — хотелось открыть книгу целиком. Копируй фрагмент дословно, без правок и кавычек. Если на странице оглавление, титул, предисловие или служебный текст — бери фрагмент из другой страницы с живым текстом. Ответ — только JSON: {\"page\": 2, \"text\": \"дословный фрагмент\"}."
	msg, e := a.llmChat(ctx, []llmMessage{
		{Role: "system", Content: system},
		{Role: "user", Content: "Книга: " + b.Title + " — " + b.Author + "\nЭмоция читателя: «" + emotion + "»\n\n" + body.String()},
	}, 0)
	if e != nil {
		log.Printf("mood: excerpt of book %d: %v — запасной отрывок", b.ID, e)
		return a.fallbackExcerpt(ctx, b.ID)
	}
	out := extractJSON(msg.Content)
	var parsed struct {
		Page int    `json:"page"`
		Text string `json:"text"`
	}
	if out != "" && json.Unmarshal([]byte(out), &parsed) == nil {
		text := strings.Trim(strings.TrimSpace(parsed.Text), "«»\"' ")
		if len([]rune(text)) >= moodExcerptMin && len([]rune(text)) <= moodExcerptMax {
			if page, found := a.findExcerptPage(ctx, b.ID, text); found {
				return &moodExcerpt{Page: page, Text: text}
			}
		}
	}
	log.Printf("mood: excerpt of book %d not verbatim — запасной отрывок", b.ID)
	return a.fallbackExcerpt(ctx, b.ID)
}

// relevantPages — страницы под цитату: не начало книги (титулы и
// предисловия), а её «тело» — со страницы moodQuoteMinPage: в первую
// очередь страницы, где встретились слова читателя, остальное место
// занимают следующие страницы по порядку. На маленькой книге — всё,
// что есть.
func (a *app) relevantPages(ctx context.Context, bookID int64, emotion string) []moodPage {
	rows, e := a.db.Query(ctx, `SELECT page,text FROM book_pages WHERE book_id=$1 ORDER BY page LIMIT $2`, bookID, moodPageFetchMax)
	if e != nil {
		return nil
	}
	defer rows.Close()
	words := emotionWords(emotion)
	type scored struct {
		moodPage
		score int
	}
	all := []scored{}
	for rows.Next() {
		var pg int
		var t string
		if e = rows.Scan(&pg, &t); e != nil {
			break
		}
		if !isContentPage(t) {
			continue
		}
		low := strings.ToLower(t)
		score := 0
		for _, w := range words {
			if strings.Contains(low, w) {
				score++
			}
		}
		all = append(all, scored{moodPage{Page: pg, Text: t}, score})
	}
	body := []scored{}
	for _, s := range all {
		if s.Page >= moodQuoteMinPage {
			body = append(body, s)
		}
	}
	if len(body) < 3 {
		body = all
	}
	order := make([]int, 0, moodPageMax)
	chosen := map[int]moodPage{}
	if len(words) > 0 {
		sorted := append([]scored{}, body...)
		sort.SliceStable(sorted, func(i, j int) bool { return sorted[i].score > sorted[j].score })
		for _, s := range sorted {
			if s.score == 0 {
				break
			}
			if len(order) >= moodRelevantTop {
				break
			}
			chosen[s.Page] = s.moodPage
			order = append(order, s.Page)
		}
	}
	for _, s := range body {
		if len(order) >= moodPageMax {
			break
		}
		if _, ok := chosen[s.Page]; !ok {
			chosen[s.Page] = s.moodPage
			order = append(order, s.Page)
		}
	}
	out := make([]moodPage, 0, len(order))
	for _, p := range order {
		out = append(out, chosen[p])
	}
	return out
}

// ensureBookText гарантирует, что текст книги извлечён из PDF и
// лежит в book_pages; возвращает false, если у книги нет PDF.
func (a *app) ensureBookText(ctx context.Context, id int64) (bool, error) {
	var n int
	if e := a.db.QueryRow(ctx, `SELECT count(*) FROM book_pages WHERE book_id=$1`, id).Scan(&n); e != nil {
		return false, e
	}
	if n > 0 {
		return true, nil
	}
	var file string
	if e := a.db.QueryRow(ctx, `SELECT file_path FROM books WHERE id=$1`, id).Scan(&file); e != nil {
		return false, e
	}
	if file == "" {
		return false, nil
	}
	path := filepath.Join(a.uploads, filepath.Base(file))
	raw, e := pdftotextFile(ctx, path)
	if e != nil {
		return false, e
	}
	nums := []int{}
	texts := []string{}
	for i, p := range strings.Split(raw, "\f") {
		p = strings.TrimSpace(p)
		if p == "" {
			continue
		}
		nums = append(nums, i+1)
		texts = append(texts, p)
	}
	if len(nums) == 0 {
		return false, errors.New("в PDF не найдено текста")
	}
	if bookTextGarbled(texts) {
		return false, errors.New("текст PDF повреждён кодировкой — страницы не сохраняем")
	}
	if _, e := a.db.Exec(ctx, `INSERT INTO book_pages(book_id,page,text) SELECT $1,v.n,v.t FROM unnest($2::int[],$3::text[]) AS v(n,t) ON CONFLICT DO NOTHING`, id, nums, texts); e != nil {
		return false, e
	}
	return true, nil
}

// findExcerptPage ищет дословный отрывок в тексте книги и
// возвращает номер страницы, где он найден (пробелы при
// сравнении игнорируются).
func (a *app) findExcerptPage(ctx context.Context, bookID int64, text string) (int, bool) {
	squash := func(s string) string {
		var b strings.Builder
		for _, r := range s {
			if !unicode.IsSpace(r) {
				b.WriteRune(r)
			}
		}
		return strings.ToLower(b.String())
	}
	needle := squash(text)
	if len(needle) == 0 {
		return 0, false
	}
	rows, e := a.db.Query(ctx, `SELECT page,text FROM book_pages WHERE book_id=$1 ORDER BY page`, bookID)
	if e != nil {
		return 0, false
	}
	defer rows.Close()
	for rows.Next() {
		var p int
		var t string
		if e = rows.Scan(&p, &t); e != nil {
			return 0, false
		}
		if !isContentPage(t) {
			continue
		}
		if strings.Contains(squash(t), needle) {
			return p, true
		}
	}
	return 0, false
}

// parseMoodFinal разбирает финальный ответ модели: JSON с ровно 3
// уникальными книгами, все id должны существовать в библиотеке.
func (a *app) parseMoodFinal(ctx context.Context, viewer int64, content string) (*moodResult, error) {
	s := extractJSON(content)
	var out struct {
		Summary string `json:"summary"`
		Books   []struct {
			ID  int64  `json:"id"`
			Why string `json:"why"`
		} `json:"books"`
	}
	if s == "" || json.Unmarshal([]byte(s), &out) != nil {
		return nil, errMoodResult
	}
	seen := map[int64]bool{}
	type pick struct {
		id  int64
		why string
	}
	var picks []pick
	for _, b := range out.Books {
		if b.ID <= 0 || seen[b.ID] {
			continue
		}
		seen[b.ID] = true
		picks = append(picks, pick{b.ID, capRunes(strings.TrimSpace(b.Why), moodWhyMax)})
	}
	if len(picks) != moodPickCount {
		return nil, errMoodResult
	}
	ids := make([]int64, 0, len(picks))
	for _, p := range picks {
		ids = append(ids, p.id)
	}
	var n int
	if e := a.db.QueryRow(ctx, `SELECT count(*) FROM books WHERE id=ANY($1::bigint[])`, ids).Scan(&n); e != nil || n != moodPickCount {
		return nil, errMoodResult
	}
	rows, e := a.db.Query(ctx, bookSelect+`WHERE b.id=ANY($2::bigint[]) ORDER BY b.id`, viewer, ids)
	if e != nil {
		return nil, e
	}
	defer rows.Close()
	byID := map[int64]book{}
	for rows.Next() {
		var b book
		if e = rows.Scan(&b.ID, &b.Title, &b.Author, &b.Description, &b.Color, &b.File, &b.Topic, &b.Language, &b.Source, &b.License, &b.Pages, &b.Cover, &b.CoverSource, &b.CoverEdition, &b.UploaderID, &b.Uploader, &b.Likes, &b.Liked, &b.Saved); e != nil {
			return nil, e
		}
		byID[b.ID] = b
	}
	res := &moodResult{Summary: capRunes(strings.TrimSpace(out.Summary), moodSummaryMax), Books: []moodPick{}}
	for _, p := range picks {
		b, ok := byID[p.id]
		if !ok {
			return nil, errMoodResult
		}
		if p.why == "" {
			p.why = "Куратор выбрал эту книгу под ваше состояние."
		}
		res.Books = append(res.Books, moodPick{Book: b, Why: p.why})
	}
	if res.Summary == "" {
		res.Summary = "Подобрали три книги под ваше состояние."
	}
	return res, nil
}

// isContentPage отличает реальный текст книги от титульных страниц,
// оглавлений и служебных заставок (URL, заголовки, перечисления).
func isContentPage(t string) bool {
	if digitGarbleRatio(t) > 0.03 {
		return false // страница из «сломанной» кодировки PDF — не показываем
	}
	if strings.Contains(t, "http") {
		return false
	}
	if len([]rune(t)) < 200 {
		return false
	}
	sentences, total, upper := 0, 0, 0
	for _, part := range strings.FieldsFunc(t, func(r rune) bool { return r == '.' || r == '!' || r == '?' || r == '…' || r == '\n' }) {
		words := strings.Fields(part)
		if len(words) >= 4 {
			sentences++
		}
		for _, w := range words {
			w = strings.Trim(w, "“”\"'()[]—–:;,")
			letters, upperRunes := 0, 0
			for _, r := range w {
				if unicode.IsLetter(r) {
					letters++
					if unicode.IsUpper(r) {
						upperRunes++
					}
				}
			}
			if letters >= 3 {
				total++
				if upperRunes == letters {
					upper++
				}
			}
		}
	}
	for _, ln := range strings.Split(strings.ToLower(t), "\n") {
		ln = strings.TrimSpace(ln)
		if ln == "содержание" || ln == "оглавление" || ln == "contents" || ln == "navigation" || strings.HasPrefix(ln, "table of contents") {
			return false
		}
	}
	if sentences < 3 {
		return false
	}
	// Титулы и оглавления: заметная часть слов набрана заглавными буквами.
	return total == 0 || upper*10 < total*3
}

// fallbackExcerpt берёт первые полные предложения со страницы книги —
// запасной вариант, если цитата модели не совпала с текстом. Начинаем
// не с титула, а с «тела» книги (со страницы moodQuoteMinPage).
func (a *app) fallbackExcerpt(ctx context.Context, bookID int64) *moodExcerpt {
	rows, e := a.db.Query(ctx, `SELECT page,text FROM book_pages WHERE book_id=$1 ORDER BY page LIMIT 30`, bookID)
	if e != nil {
		return nil
	}
	defer rows.Close()
	var fallback *moodExcerpt
	for rows.Next() {
		var p int
		var t string
		if e = rows.Scan(&p, &t); e != nil {
			return nil
		}
		if !isContentPage(t) {
			continue
		}
		t = strings.Join(strings.Fields(t), " ")
		var b strings.Builder
		for _, part := range strings.Split(t, ". ") {
			part = strings.TrimSpace(part)
			if part == "" {
				continue
			}
			if b.Len() > 0 {
				b.WriteString(". ")
			}
			b.WriteString(part)
			if len([]rune(b.String())) >= 140 {
				break
			}
		}
		text := b.String()
		if len([]rune(text)) > moodExcerptMax {
			text = string([]rune(text)[:moodExcerptMax])
		}
		if len([]rune(text)) < moodExcerptMin {
			continue
		}
		if !strings.HasSuffix(text, ".") && !strings.HasSuffix(text, "?") && !strings.HasSuffix(text, "!") {
			text += "."
		}
		if p >= moodQuoteMinPage {
			return &moodExcerpt{Page: p, Text: text}
		}
		if fallback == nil {
			fallback = &moodExcerpt{Page: p, Text: text}
		}
	}
	return fallback
}

// ---------- LLM: OpenAI-совместимый chat completions ----------

func (a *app) llmChat(ctx context.Context, messages []llmMessage, maxRetry int) (*llmMessage, error) {
	wire := make([]map[string]any, 0, len(messages))
	for _, m := range messages {
		wire = append(wire, map[string]any{"role": m.Role, "content": m.Content})
	}
	payload := map[string]any{
		"model":    a.llmModel,
		"messages": wire,
		"stream":   false,
	}
	body, e := json.Marshal(payload)
	if e != nil {
		return nil, e
	}
	var res *http.Response
	var doErr error
	for attempt := 0; ; attempt++ {
		req, e := http.NewRequestWithContext(ctx, "POST", a.llmURL, bytes.NewReader(body))
		if e != nil {
			return nil, e
		}
		req.Header.Set("Content-Type", "application/json")
		if a.llmAPIKey != "" {
			req.Header.Set("Authorization", "Bearer "+a.llmAPIKey)
		}
		res, doErr = a.moodHTTP.Do(req)
		if doErr != nil || res.StatusCode != http.StatusTooManyRequests {
			break
		}
		// Провайдер ограничивает запросы в минуту: подождём окно и повторим,
		// чтобы одиночный подбор не падал из-за чужих (или своих) запросов.
		res.Body.Close()
		if attempt >= maxRetry {
			log.Printf("mood: llm: 429 rate limit, retries exhausted")
			return nil, errMoodRateLimited
		}
		log.Printf("mood: llm: 429 rate limit, retry %d in 12s", attempt+1)
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(12 * time.Second):
		}
	}
	if doErr != nil {
		if ctx.Err() != nil {
			return nil, ctx.Err()
		}
		log.Printf("mood: llm: %v", doErr)
		return nil, errMoodEngine
	}
	defer res.Body.Close()
	data, _ := io.ReadAll(io.LimitReader(res.Body, 8<<20))
	var out struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
			FinishReason string `json:"finish_reason"`
		} `json:"choices"`
		Usage json.RawMessage `json:"usage"`
		Error json.RawMessage `json:"error"`
	}
	if e := json.Unmarshal(data, &out); e != nil || len(out.Choices) == 0 {
		log.Printf("mood: llm: status=%d body=%.300s", res.StatusCode, string(data))
		return nil, errMoodEngine
	}
	if res.StatusCode == http.StatusTooManyRequests {
		return nil, errMoodRateLimited
	}
	if res.StatusCode != 200 {
		log.Printf("mood: llm: status=%d body=%.300s", res.StatusCode, string(data))
		return nil, errMoodEngine
	}
	if len(out.Error) > 0 && string(out.Error) != "null" {
		log.Printf("mood: llm error: %.300s", string(out.Error))
		return nil, errMoodEngine
	}
	content := out.Choices[0].Message.Content
	if content == "" {
		log.Printf("mood: llm: empty answer finish_reason=%s usage=%s", out.Choices[0].FinishReason, string(out.Usage))
	}
	return &llmMessage{Role: "assistant", Content: content}, nil
}

// extractJSON находит первый JSON-объект в ответе модели,
// игнорируя markdown-обёртки и лишний текст вокруг.
func extractJSON(s string) string {
	start := strings.Index(s, "{")
	end := strings.LastIndex(s, "}")
	if start < 0 || end <= start {
		return ""
	}
	return s[start : end+1]
}

func capRunes(s string, max int) string {
	r := []rune(s)
	if len(r) > max {
		return string(r[:max])
	}
	return s
}
