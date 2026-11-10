package main

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
)

func TestPasswords(t *testing.T) {
	hash := hashPassword("a-long-password-123")
	if !checkPassword("a-long-password-123", hash) || checkPassword("wrong", hash) || checkPassword("x", "!disabled") {
		t.Fatal("password verification failed")
	}
	if hash == hashPassword("a-long-password-123") {
		t.Fatal("missing random salt")
	}
}
func TestRateLimit(t *testing.T) {
	l := &rateLimiter{items: map[string]rateEntry{}}
	if !l.allow("ip", 2) || !l.allow("ip", 2) || l.allow("ip", 2) || !l.allow("other", 2) {
		t.Fatal("rate limiter failed")
	}
}
func TestExtractJSON(t *testing.T) {
	cases := map[string]string{
		`{"a":1}`:                 `{"a":1}`,
		"```json\n{\"a\":1}\n```": `{"a":1}`,
		"Вот подбор: {\"a\":1} и ещё":   `{"a":1}`,
		"{\"a\":1} средина {\"b\":2}\n": `{"a":1} средина {"b":2}`,
		"без json":                      "",
		"{":                             "",
	}
	for in, want := range cases {
		if got := extractJSON(in); got != want {
			t.Fatalf("extractJSON(%q) = %q, want %q", in, got, want)
		}
	}
}
func TestEmotionWords(t *testing.T) {
	words := emotionWords("  Устал, уставшая голова и ТИШИНА! ")
	if len(words) != 4 || words[0] != "устал" || words[1] != "уставшая" || words[2] != "голова" || words[3] != "тишина" {
		t.Fatalf("emotionWords = %v, want [устал уставшая голова тишина]", words)
	}
	// Короткие слова отбрасываются, повторы убираются.
	words = emotionWords("я я я а ну тишина тишина тишина")
	if len(words) != 1 || words[0] != "тишина" {
		t.Fatalf("emotionWords short/dup = %v, want [тишина]", words)
	}
	// Количество слов ограничено moodWordMax.
	parts := make([]string, 0, 30)
	for i := 0; i < 30; i++ {
		parts = append(parts, "слово"+string(rune('а'+i)))
	}
	words = emotionWords(strings.Join(parts, ", "))
	if len(words) != moodWordMax {
		t.Fatalf("emotionWords cap = %d, want %d", len(words), moodWordMax)
	}
}

// makeEpubFixture собирает минимальный EPUB в памяти (zip с container, OPF и главой).
func makeEpubFixture(t *testing.T) string {
	t.Helper()
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	put := func(name, content string) {
		w, e := zw.Create(name)
		if e != nil {
			t.Fatal(e)
		}
		if _, e := w.Write([]byte(content)); e != nil {
			t.Fatal(e)
		}
	}
	put("mimetype", "application/epub+zip")
	put("META-INF/container.xml", `<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`)
	put("OEBPS/content.opf", `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" xmlns:dc="http://purl.org/dc/elements/1.1/" version="2.0"><metadata><dc:title>Epub Title</dc:title><dc:creator>Epub Author</dc:creator></metadata><manifest><item id="ch1" href="ch1.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="ch1"/></spine></package>`)
	put("OEBPS/ch1.xhtml", `<html xmlns="http://www.w3.org/1999/xhtml"><body><p>`+strings.Repeat("Глава текста EPUB книги. ", 15)+`</p></body></html>`)
	if e := zw.Close(); e != nil {
		t.Fatal(e)
	}
	return buf.String()
}
func TestMoodHelpers(t *testing.T) {
	if got := normalizeEmotion("  устала\tпосле   работы «сдаться»"); got != "устала после работы «сдаться" {
		t.Fatalf("normalizeEmotion = %q", got)
	}
	long := normalizeEmotion(strings.Repeat("а", 500))
	if len([]rune(long)) != moodEmotionMax {
		t.Fatalf("emotion cap = %d runes, want %d", len([]rune(long)), moodEmotionMax)
	}
	if normalizeEmotion("   ") != "" {
		t.Fatal("blank emotion must normalize to empty")
	}
	if capRunes(strings.Repeat("б", 10), 5) != strings.Repeat("б", 5) || capRunes("короткий", 10) != "короткий" {
		t.Fatal("capRunes failed")
	}
}
func TestMoodParseFinal(t *testing.T) {
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("set TEST_DATABASE_URL to run PostgreSQL integration tests")
	}
	ctx := context.Background()
	admin, e := pgxpool.New(ctx, dsn)
	if e != nil {
		t.Fatal(e)
	}
	defer admin.Close()
	schemaName := "test_" + token()[:12]
	if _, e = admin.Exec(ctx, "CREATE SCHEMA "+schemaName); e != nil {
		t.Fatal(e)
	}
	defer admin.Exec(ctx, "DROP SCHEMA "+schemaName+" CASCADE")
	cfg, e := pgxpool.ParseConfig(dsn)
	if e != nil {
		t.Fatal(e)
	}
	cfg.ConnConfig.RuntimeParams["search_path"] = schemaName
	db, e := pgxpool.NewWithConfig(ctx, cfg)
	if e != nil {
		t.Fatal(e)
	}
	defer db.Close()
	if _, e = db.Exec(ctx, schema); e != nil {
		t.Fatal(e)
	}
	ids := make([]int64, 0, 6)
	for i := 1; i <= 6; i++ {
		var id int64
		if e = db.QueryRow(ctx, `INSERT INTO books(title,author) VALUES($1,$2) RETURNING id`, fmt.Sprintf("Mood Book %d", i), fmt.Sprintf("Mood Author %d", i)).Scan(&id); e != nil {
			t.Fatal(e)
		}
		ids = append(ids, id)
	}
	a := &app{db: db, uploads: t.TempDir()}
	bookEntries := make([]string, 0, moodPickCount)
	for i := 0; i < moodPickCount; i++ {
		bookEntries = append(bookEntries, fmt.Sprintf(`{"id": %d, "why": "причина %d"}`, ids[i], i))
	}
	valid := `{"summary": "Человеку нужен покой", "books": [` + strings.Join(bookEntries, ",") + `]}`
	res, e := a.parseMoodFinal(ctx, 0, "Думаю, вот:```json\n"+valid+"\n``` — надеюсь, подойдёт")
	if e != nil {
		t.Fatalf("valid fenced answer rejected: %v", e)
	}
	if len(res.Books) != moodPickCount || res.Summary != "Человеку нужен покой" || res.Books[0].Book.ID != ids[0] || res.Books[0].Why != "причина 0" {
		t.Fatalf("unexpected result: %+v", res)
	}
	for i, p := range res.Books {
		if p.Book.ID != ids[i] {
			t.Fatalf("books must come back ordered by id: %+v", res.Books)
		}
	}
	short := `{"summary":"", "books":[` + strings.Join(bookEntries[:moodPickCount-1], ",") + `]}`
	if _, e = a.parseMoodFinal(ctx, 0, short); !errors.Is(e, errMoodResult) {
		t.Fatal("fewer than required books must be rejected")
	}
	ghost := `{"summary":"", "books":[` + strings.Join(bookEntries[:moodPickCount-1], ",") + `,` + `{"id": 999999, "why": "нет такой"}]}`
	if _, e = a.parseMoodFinal(ctx, 0, ghost); !errors.Is(e, errMoodResult) {
		t.Fatal("unknown book id must be rejected")
	}
	dup := `{"summary":"", "books":[` + bookEntries[0] + "," + strings.Join(bookEntries[1:moodPickCount], ",") + `]}`
	dupRes, e := a.parseMoodFinal(ctx, 0, dup)
	if e != nil || len(dupRes.Books) != moodPickCount {
		t.Fatalf("duplicate entries must dedupe to %d: %v", moodPickCount, e)
	}
	emptyWhy := `{"summary":"", "books":[` + strings.Join(bookEntries[:moodPickCount-1], ",") + `,` + fmt.Sprintf(`{"id": %d}`, ids[moodPickCount]) + `]}`
	emptyRes, e := a.parseMoodFinal(ctx, 0, emptyWhy)
	if e != nil || emptyRes.Books[moodPickCount-1].Why == "" || emptyRes.Summary == "" {
		t.Fatalf("empty fields must get defaults: %+v %v", emptyRes, e)
	}
	if _, e = a.parseMoodFinal(ctx, 0, "просто текст без json"); !errors.Is(e, errMoodResult) {
		t.Fatal("non-json answer must be rejected")
	}
	// Код-поиск по словам: все 6 тестовых книг содержат "mood book".
	scores, e := a.moodCodeSearch(ctx, emotionWords("mood book"))
	if e != nil {
		t.Fatal(e)
	}
	if len(scores) != 6 {
		t.Fatalf("code search should match all 6 books, got %d: %v", len(scores), scores)
	}
	if scores[ids[0]] <= 0 {
		t.Fatalf("matched book must have positive score: %v", scores)
	}
	// Каталог: до порога — все книги, с меткой has_text.
	catalog, e := a.moodCatalog(ctx, scores)
	if e != nil {
		t.Fatal(e)
	}
	if len(catalog) != 6 {
		t.Fatalf("catalog = %d books, want 6", len(catalog))
	}
	for _, it := range catalog {
		if it.HasText {
			t.Fatalf("book %d has no pages, has_text must be false", it.ID)
		}
	}
	// findExcerptPage: дословный фрагмент ищется только в тексте контентных страниц book_pages.
	page1 := "Первая страница: читатель видит человека в пути. Дорога вела через тёмное поле, и ветер гнал перед ним низкие тучи. Он шёл медленно, переступая через сухие стебли, и думал о том, зачем ему этот долгий и утомительный путь."
	page2 := "Вторая страница: в глубине леса начинается тихий разговор. Два старика сидели на поваленном пне и делили между собой последнее яблоко. Речь шла о том, что человек живёт по-настоящему, пока о нём кто-то помнит и ждёт его возвращения домой."
	if _, e := db.Exec(ctx, `INSERT INTO book_pages(book_id,page,text) VALUES($1,1,$2),($1,2,$3)`, ids[0], page1, page2); e != nil {
		t.Fatal(e)
	}
	page, found := a.findExcerptPage(ctx, ids[0], "читатель видит человека в пути")
	if !found || page != 1 {
		t.Fatalf("excerpt on page 1 not found: %d %v", page, found)
	}
	page, found = a.findExcerptPage(ctx, ids[0], "Вторая страница: в глубине леса начинается")
	if !found || page != 2 {
		t.Fatalf("excerpt on page 2 not found: %d %v", page, found)
	}
	if _, found = a.findExcerptPage(ctx, ids[0], "цитата, которой нет в книге"); found {
		t.Fatal("hallucinated excerpt must not be found")
	}
	if _, found = a.findExcerptPage(ctx, ids[1], "любой текст"); found {
		t.Fatal("book without pages must yield no excerpt")
	}
	// Короткие служебные страницы (титулы, оглавления) цитатами не считаются.
	if _, found = a.findExcerptPage(ctx, ids[1], "QAZINA"); found {
		t.Fatal("title-page text must not count as an excerpt")
	}
}
func TestIntegration(t *testing.T) {
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("set TEST_DATABASE_URL to run PostgreSQL integration tests")
	}
	ctx := context.Background()
	admin, e := pgxpool.New(ctx, dsn)
	if e != nil {
		t.Fatal(e)
	}
	defer admin.Close()
	schemaName := "test_" + token()[:12]
	if _, e = admin.Exec(ctx, "CREATE SCHEMA "+schemaName); e != nil {
		t.Fatal(e)
	}
	defer admin.Exec(ctx, "DROP SCHEMA "+schemaName+" CASCADE")
	cfg, e := pgxpool.ParseConfig(dsn)
	if e != nil {
		t.Fatal(e)
	}
	cfg.ConnConfig.RuntimeParams["search_path"] = schemaName
	db, e := pgxpool.NewWithConfig(ctx, cfg)
	if e != nil {
		t.Fatal(e)
	}
	defer db.Close()
	if _, e = db.Exec(ctx, schema); e != nil {
		t.Fatal(e)
	}
	a := &app{db: db, origin: "http://example.com", uploads: t.TempDir(), limiter: &rateLimiter{items: map[string]rateEntry{}}, authSlots: make(chan struct{}, 4)}
	if e = a.seed(ctx); e != nil {
		t.Fatal(e)
	}
	handler := a.routes()
	var cookie *http.Cookie
	call := func(method, path string, body any, want int) *httptest.ResponseRecorder {
		var b bytes.Buffer
		if body != nil {
			json.NewEncoder(&b).Encode(body)
		}
		r := httptest.NewRequest(method, path, &b)
		r.RemoteAddr = "127.0.0.1:12345"
		r.Header.Set("Content-Type", "application/json")
		if cookie != nil {
			r.AddCookie(cookie)
		}
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		if w.Code != want {
			t.Fatalf("%s %s: got %d, want %d: %s", method, path, w.Code, want, w.Body.String())
		}
		return w
	}
	call("GET", "/api/posts", nil, 200)
	call("GET", "/api/books?feed=saved", nil, 401)
	call("PUT", "/api/books/1/save", nil, 401)
	call("GET", "/uploads/", nil, 404)
	call("PUT", "/api/posts/1/like", nil, 401)
	call("POST", "/api/posts/1/comments", map[string]string{"body": "guest"}, 401)
	img := image.NewRGBA(image.Rect(0, 0, 4, 4))
	img.Set(1, 1, color.RGBA{30, 80, 40, 255})
	var picture bytes.Buffer
	png.Encode(&picture, img)
	registration := map[string]string{"username": "integration_reader", "full_name": "Тестовый Читатель", "email": "integration@gmail.com", "password": "secure-password-123", "avatar": "data:image/png;base64," + base64.StdEncoding.EncodeToString(picture.Bytes())}
	w := call("POST", "/api/auth/register", registration, 201)
	var u user
	json.Unmarshal(w.Body.Bytes(), &u)
	cookies := w.Result().Cookies()
	if len(cookies) == 0 || !cookies[0].HttpOnly || cookies[0].SameSite != http.SameSiteLaxMode {
		t.Fatal("session cookie flags missing")
	}
	cookie = cookies[0]
	call("GET", u.Avatar, nil, 200)
	call("POST", "/api/auth/register", registration, 409)
	var hash string
	if e = db.QueryRow(ctx, "SELECT password_hash FROM users WHERE id=$1", u.ID).Scan(&hash); e != nil || hash == registration["password"] || !checkPassword(registration["password"], hash) {
		t.Fatal("password storage failed")
	}
	if strings.Contains(call("GET", "/api/users/integration_reader", nil, 200).Body.String(), "gmail.com") {
		t.Fatal("public profile exposed email")
	}
	createBook := func(title, author, file string, want int) int64 {
		var body bytes.Buffer
		writer := multipart.NewWriter(&body)
		writer.WriteField("title", title)
		writer.WriteField("author", author)
		writer.WriteField("genre", "Наука")
		if file != "" {
			f, _ := writer.CreateFormFile("file", "book.pdf")
			f.Write([]byte(file))
		}
		writer.Close()
		r := httptest.NewRequest("POST", "/api/books", &body)
		r.RemoteAddr = "127.0.0.1:12345"
		r.Header.Set("Content-Type", writer.FormDataContentType())
		r.AddCookie(cookie)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		if w.Code != want {
			t.Fatalf("create book: got %d want %d: %s", w.Code, want, w.Body.String())
		}
		var out struct {
			ID int64 `json:"id"`
		}
		json.Unmarshal(w.Body.Bytes(), &out)
		return out.ID
	}
	bid := createBook("Integration Book", "Test Author", "%PDF-1.4\nIntegration fixture", 201)
	genreQuery := "/api/books?genre=" + url.QueryEscape("Наука")
	var filtered []book
	json.Unmarshal(call("GET", genreQuery, nil, 200).Body.Bytes(), &filtered)
	if len(filtered) != 1 || filtered[0].ID != bid || filtered[0].Topic != "Наука" {
		t.Fatalf("genre filter or storage failed: %+v", filtered)
	}
	json.Unmarshal(call("GET", genreQuery+"&q=Integration", nil, 200).Body.Bytes(), &filtered)
	if len(filtered) != 1 || filtered[0].ID != bid {
		t.Fatal("genre and search must combine")
	}
	json.Unmarshal(call("GET", genreQuery+"&q=not-found", nil, 200).Body.Bytes(), &filtered)
	if len(filtered) != 0 {
		t.Fatal("search must not ignore genre filter")
	}
	json.Unmarshal(call("GET", genreQuery+fmt.Sprintf("&before=%d", bid), nil, 200).Body.Bytes(), &filtered)
	if len(filtered) != 0 {
		t.Fatal("genre cursor pagination failed")
	}
	json.Unmarshal(call("GET", "/api/books?genre="+url.QueryEscape("Классика"), nil, 200).Body.Bytes(), &filtered)
	for _, b := range filtered {
		if b.ID == bid || b.Topic != "Классика" {
			t.Fatal("books leaked between genres")
		}
	}
	var genres []string
	json.Unmarshal(call("GET", "/api/books/genres", nil, 200).Body.Bytes(), &genres)
	foundGenre := false
	for _, g := range genres {
		if g == "Наука" {
			foundGenre = true
		}
	}
	if !foundGenre {
		t.Fatal("catalogue genres must include uploaded book genre")
	}
	call("GET", "/api/books?genre="+url.QueryEscape(strings.Repeat("я", 61)), nil, 400)

	bookSavePath := fmt.Sprintf("/api/books/%d/save", bid)
	call("PUT", bookSavePath, nil, 200)
	call("PUT", bookSavePath, nil, 200)
	var savedBooks []book
	json.Unmarshal(call("GET", "/api/books?feed=saved", nil, 200).Body.Bytes(), &savedBooks)
	if len(savedBooks) != 1 || savedBooks[0].ID != bid || !savedBooks[0].Saved {
		t.Fatalf("book save must be persistent and idempotent: %+v", savedBooks)
	}
	json.Unmarshal(call("GET", "/api/books?feed=saved&genre="+url.QueryEscape("Наука")+"&q=Integration", nil, 200).Body.Bytes(), &savedBooks)
	if len(savedBooks) != 1 {
		t.Fatal("saved books must support catalogue filters")
	}
	json.Unmarshal(call("GET", fmt.Sprintf("/api/books?feed=saved&before=%d", bid), nil, 200).Body.Bytes(), &savedBooks)
	if len(savedBooks) != 0 {
		t.Fatal("saved book cursor did not apply")
	}
	firstCookie := cookie
	var secondID int64
	if err := db.QueryRow(ctx, `INSERT INTO users(username,full_name,email,password_hash) VALUES('private_reader','Другой Читатель','private@example.invalid','!disabled') RETURNING id`).Scan(&secondID); err != nil {
		t.Fatal(err)
	}
	secondSession := httptest.NewRecorder()
	if err := a.session(secondSession, httptest.NewRequest("POST", "/", nil), secondID); err != nil {
		t.Fatal(err)
	}
	secondCookie := secondSession.Result().Cookies()[0]
	cookie = secondCookie
	json.Unmarshal(call("GET", "/api/books?feed=saved", nil, 200).Body.Bytes(), &savedBooks)
	if len(savedBooks) != 0 {
		t.Fatal("another user can see private saved books")
	}
	var privateBook book
	json.Unmarshal(call("GET", fmt.Sprintf("/api/books/%d", bid), nil, 200).Body.Bytes(), &privateBook)
	if privateBook.Saved {
		t.Fatal("another user's saved status leaked")
	}
	call("PUT", bookSavePath, nil, 200)
	cookie = firstCookie
	readPath := fmt.Sprintf("/api/books/%d/read", bid)
	readable := call("GET", readPath, nil, 200)
	if !strings.HasPrefix(readable.Header().Get("Content-Type"), "application/pdf") || !strings.HasPrefix(readable.Header().Get("Content-Disposition"), "inline") {
		t.Fatal("reader endpoint must return inline PDF")
	}
	rangeRequest := httptest.NewRequest("GET", readPath, nil)
	rangeRequest.Header.Set("Range", "bytes=0-4")
	rangeResult := httptest.NewRecorder()
	handler.ServeHTTP(rangeResult, rangeRequest)
	if rangeResult.Code != 206 || rangeResult.Body.String() != "%PDF-" {
		t.Fatal("PDF byte range support failed")
	}
	call("GET", "/api/books/9999999/read", nil, 404)
	call("GET", "/api/readers", nil, 200)
	call("GET", "/api/posts?topic=Наука", nil, 200)

	createBook("  integration   book ", "TEST AUTHOR", "", 409)
	createBook("Another title", "Other author", "%PDF-1.4\nIntegration fixture", 409)
	createBook("Bad file", "Bad author", "<html>not pdf</html>", 400)
	// Книга из текстового файла: загрузка, разбиение на страницы, чтение.
	txtText := strings.Repeat("Это абзац текста для проверки разбиения на страницы. ", 100)
	txtBook := createBook("Integration Text Book", "Test Author", txtText, 201)
	pagesW := call("GET", fmt.Sprintf("/api/books/%d/pages?from=1", txtBook), nil, 200)
	var pagesOut struct {
		Pages int `json:"pages"`
		Items []struct {
			Page int    `json:"page"`
			Text string `json:"text"`
		} `json:"items"`
	}
	json.Unmarshal(pagesW.Body.Bytes(), &pagesOut)
	if pagesOut.Pages < 4 || len(pagesOut.Items) == 0 || !strings.Contains(pagesOut.Items[0].Text, "Это абзац текста") {
		t.Fatalf("text book pages: %+v", pagesOut)
	}
	epubBook := createBook("Epub Book", "Epub Author", makeEpubFixture(t), 201)
	if epBody := call("GET", fmt.Sprintf("/api/books/%d/pages?from=1", epubBook), nil, 200).Body.String(); !strings.Contains(epBody, "Глава текста EPUB книги.") {
		t.Fatalf("epub pages: %s", epBody)
	}
	// Загруженная книга видна гостю без сессии.
	guestW := httptest.NewRecorder()
	handler.ServeHTTP(guestW, httptest.NewRequest("GET", "/api/books?q="+url.QueryEscape("Integration Text Book"), nil))
	if guestW.Code != 200 || !strings.Contains(guestW.Body.String(), "Integration Text Book") {
		t.Fatalf("guest cannot see uploaded book: %d %s", guestW.Code, guestW.Body.String())
	}
	call("POST", "/api/posts", map[string]any{"book_id": bid, "kind": "quote", "opinion": "Missing quote"}, 400)
	pbody := map[string]any{"book_id": bid, "kind": "quote", "quote": "Тестовая цитата", "opinion": "Отдельная мысль читателя", "page": 12, "lines": "3–5"}
	w = call("POST", "/api/posts", pbody, 201)
	var p post
	json.Unmarshal(w.Body.Bytes(), &p)
	if p.Quote != pbody["quote"] || p.Opinion != pbody["opinion"] {
		t.Fatal("quote and opinion not separate")
	}
	path := fmt.Sprintf("/api/posts/%d", p.ID)
	call("PUT", path+"/like", nil, 200)
	call("PUT", path+"/like", nil, 200)
	call("PUT", path+"/save", nil, 200)
	call("POST", path+"/comments", map[string]string{"body": "Есть о чём подумать"}, 201)
	w = call("GET", path, nil, 200)
	json.Unmarshal(w.Body.Bytes(), &p)
	if p.Likes != 1 || !p.Saved || p.Comments != 1 {
		t.Fatalf("actions not persisted: %+v", p)
	}
	call("GET", "/api/posts?feed=saved", nil, 200)
	call("PUT", "/api/users/1/follow", nil, 200)
	call("GET", "/api/posts?feed=following", nil, 200)
	call("PUT", fmt.Sprintf("/api/books/%d/like", bid), nil, 200)
	call("GET", fmt.Sprintf("/api/books/%d", bid), nil, 200)
	r := httptest.NewRequest("POST", "/api/auth/logout", nil)
	r.Header.Set("Origin", "https://evil.example")
	r.AddCookie(cookie)
	w = httptest.NewRecorder()
	handler.ServeHTTP(w, r)
	if w.Code != 403 {
		t.Fatal("cross-origin request accepted")
	}
	call("POST", "/api/auth/logout", nil, 200)
	call("POST", "/api/posts", pbody, 401)
	cookie = nil
	call("GET", path, nil, 200)
	call("POST", "/api/auth/login", map[string]string{"email": "integration@gmail.com", "password": "wrong"}, 401)
	w = call("POST", "/api/auth/login", map[string]string{"email": "integration@gmail.com", "password": "secure-password-123"}, 200)
	cookie = w.Result().Cookies()[0]
	json.Unmarshal(call("GET", "/api/books?feed=saved", nil, 200).Body.Bytes(), &savedBooks)
	if len(savedBooks) != 1 || savedBooks[0].ID != bid {
		t.Fatal("saved books must survive logout and login")
	}
	call("DELETE", bookSavePath, nil, 200)
	call("DELETE", bookSavePath, nil, 200)
	json.Unmarshal(call("GET", "/api/books?feed=saved", nil, 200).Body.Bytes(), &savedBooks)
	if len(savedBooks) != 0 {
		t.Fatal("book was not removed from saved list")
	}
	var stillSavedPost post
	json.Unmarshal(call("GET", path, nil, 200).Body.Bytes(), &stillSavedPost)
	if !stillSavedPost.Saved {
		t.Fatal("removing a saved book must not remove saved publications")
	}
	currentCookie := cookie
	cookie = secondCookie
	json.Unmarshal(call("GET", "/api/books?feed=saved", nil, 200).Body.Bytes(), &savedBooks)
	if len(savedBooks) != 1 || savedBooks[0].ID != bid {
		t.Fatal("removing a book must not affect another user's saved books")
	}
	cookie = currentCookie
	call("PUT", "/api/books/9999999/save", nil, 404)
	call("DELETE", path+"/like", nil, 200)
	call("DELETE", path+"/save", nil, 200)
	call("DELETE", "/api/users/1/follow", nil, 200)
	call("DELETE", fmt.Sprintf("/api/books/%d/like", bid), nil, 200)
	call("GET", "/api/posts/9999999", nil, 404)
	call("PUT", "/api/posts/9999999/like", nil, 404)
}
