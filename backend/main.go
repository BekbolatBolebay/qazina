package main

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	_ "embed"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net"
	"net/http"
	"net/mail"
	"net/url"
	"os"
	"os/signal"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/argon2"
)

//go:embed schema.sql
var schema string

type app struct {
	db              *pgxpool.Pool
	origin, uploads string
	secure          bool
	limiter         *rateLimiter
	authSlots       chan struct{}
	llmURL          string
	llmAPIKey       string
	llmModel        string
	moodHTTP        *http.Client
}
type user struct {
	ID       int64  `json:"id"`
	Username string `json:"username"`
	Name     string `json:"full_name"`
	Avatar   string `json:"avatar"`
	Bio      string `json:"bio"`
	Demo     bool   `json:"is_demo"`
}
type book struct {
	ID           int64  `json:"id"`
	Title        string `json:"title"`
	Author       string `json:"author"`
	Description  string `json:"description"`
	Color        string `json:"color"`
	File         string `json:"file"`
	UploaderID   int64  `json:"uploader_id"`
	Uploader     string `json:"uploader"`
	Likes        int    `json:"likes"`
	Liked        bool   `json:"liked"`
	Saved        bool   `json:"saved"`
	Topic        string `json:"topic"`
	Language     string `json:"language"`
	Source       string `json:"source_url"`
	License      string `json:"license"`
	Pages        int    `json:"pages"`
	Cover        string `json:"cover"`
	CoverSource  string `json:"cover_source"`
	CoverEdition string `json:"cover_edition"`
}
type post struct {
	ID       int64     `json:"id"`
	User     user      `json:"user"`
	Book     book      `json:"book"`
	Kind     string    `json:"kind"`
	Quote    string    `json:"quote"`
	Opinion  string    `json:"opinion"`
	Page     int       `json:"page"`
	Lines    string    `json:"lines"`
	Created  time.Time `json:"created_at"`
	Likes    int       `json:"likes"`
	Comments int       `json:"comments"`
	Liked    bool      `json:"liked"`
	Saved    bool      `json:"saved"`
}

func env(k, d string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return d
}
func main() {
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()
	cfg, err := pgxpool.ParseConfig(env("DATABASE_URL", "postgres://mood:mood@127.0.0.1:5438/mood?sslmode=disable"))
	if err != nil {
		log.Fatal(err)
	}
	cfg.MaxConns = 10
	cfg.MinConns = 1
	cfg.MaxConnLifetime = time.Hour
	db, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()
	if err = db.Ping(ctx); err != nil {
		log.Fatal("PostgreSQL: ", err)
	}
	if _, err = db.Exec(ctx, schema); err != nil {
		log.Fatal(err)
	}
	a := &app{db: db, origin: env("APP_ORIGIN", "http://localhost:8088"), uploads: env("UPLOAD_DIR", "./uploads"), secure: env("COOKIE_SECURE", "false") == "true", limiter: &rateLimiter{items: map[string]rateEntry{}}, authSlots: make(chan struct{}, 4), llmURL: env("LLM_API_URL", "https://llm.alem.ai/chat/completions"), llmAPIKey: env("LLM_API_KEY", ""), llmModel: env("LLM_MODEL", "gpt-oss"), moodHTTP: &http.Client{Timeout: 120 * time.Second}}
	if err = os.MkdirAll(a.uploads, 0700); err != nil {
		log.Fatal(err)
	}
	if env("SEED_DATA", "true") == "true" {
		if err = a.seed(ctx); err != nil {
			log.Fatal(err)
		}
	}
	go a.cleanSessions(ctx)
	server := &http.Server{Addr: env("ADDR", "127.0.0.1:8088"), Handler: a.routes(), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 5 * time.Minute, WriteTimeout: 300 * time.Second, IdleTimeout: 60 * time.Second, MaxHeaderBytes: 16 << 10}
	go func() {
		<-ctx.Done()
		c, stop := context.WithTimeout(context.Background(), 10*time.Second)
		defer stop()
		server.Shutdown(c)
	}()
	log.Printf("Mood: %s", a.origin)
	if err = server.ListenAndServe(); !errors.Is(err, http.ErrServerClosed) {
		log.Fatal(err)
	}
}
func (a *app) routes() http.Handler {
	m := http.NewServeMux()
	m.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		if e := a.db.Ping(r.Context()); e != nil {
			fail(w, 503, "База данных недоступна")
			return
		}
		respond(w, 200, map[string]string{"status": "ok"})
	})
	m.HandleFunc("POST /api/auth/register", a.register)
	m.HandleFunc("POST /api/auth/login", a.login)
	m.HandleFunc("POST /api/auth/logout", a.logout)
	m.HandleFunc("GET /api/me", a.me)
	m.HandleFunc("GET /api/posts", a.posts)
	m.HandleFunc("POST /api/posts", a.createPost)
	m.HandleFunc("GET /api/posts/{id}", a.singlePost)
	m.HandleFunc("PUT /api/posts/{id}/like", a.likePost)
	m.HandleFunc("DELETE /api/posts/{id}/like", a.likePost)
	m.HandleFunc("PUT /api/posts/{id}/save", a.savePost)
	m.HandleFunc("DELETE /api/posts/{id}/save", a.savePost)
	m.HandleFunc("GET /api/posts/{id}/comments", a.comments)
	m.HandleFunc("POST /api/posts/{id}/comments", a.createComment)
	m.HandleFunc("GET /api/books", a.books)
	m.HandleFunc("GET /api/books/genres", a.bookGenres)
	m.HandleFunc("GET /api/books/{id}", a.singleBook)
	m.HandleFunc("GET /api/books/{id}/read", a.readBook)
	m.HandleFunc("GET /api/readers", a.readers)
	m.HandleFunc("POST /api/mood", a.moodBooks)
	m.HandleFunc("POST /api/mood/stream", a.moodStream)
	m.HandleFunc("GET /api/mood/status", a.moodStatus)
	m.HandleFunc("POST /api/books", a.createBook)
	m.HandleFunc("GET /api/books/{id}/pages", a.bookPages)
	m.HandleFunc("PUT /api/books/{id}/like", a.likeBook)
	m.HandleFunc("DELETE /api/books/{id}/like", a.likeBook)
	m.HandleFunc("PUT /api/books/{id}/save", a.saveBook)
	m.HandleFunc("DELETE /api/books/{id}/save", a.saveBook)
	m.HandleFunc("GET /api/users/{username}", a.profile)
	m.HandleFunc("PUT /api/users/{id}/follow", a.follow)
	m.HandleFunc("DELETE /api/users/{id}/follow", a.follow)
	m.HandleFunc("GET /uploads/", a.serveUpload)
	dist := env("FRONTEND_DIR", "../frontend/dist")
	m.HandleFunc("GET /", func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/") {
			fail(w, 404, "Не найдено")
			return
		}
		p := filepath.Join(dist, filepath.Clean("/"+r.URL.Path))
		if st, e := os.Stat(p); e == nil && !st.IsDir() {
			http.ServeFile(w, r, p)
			return
		}
		http.ServeFile(w, r, filepath.Join(dist, "index.html"))
	})
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		w.Header().Set("Content-Security-Policy", "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self' blob:; worker-src 'self' blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'")
		if strings.HasPrefix(r.URL.Path, "/api/") {
			w.Header().Set("Cache-Control", "no-store")
		}
		if r.Method != "GET" && r.Method != "HEAD" {
			o := r.Header.Get("Origin")
			u, e := url.Parse(o)
			if o != "" && (e != nil || o != a.origin && u.Host != r.Host) {
				log.Printf("403 %s %s: origin=%q host=%s (ожидалось %s)", r.Method, r.URL.Path, o, r.Host, a.origin)
				fail(w, 403, "Запрос с другого сайта запрещён")
				return
			}
			if r.Header.Get("Sec-Fetch-Site") == "cross-site" {
				log.Printf("403 %s %s: cross-site запрос (origin=%q)", r.Method, r.URL.Path, o)
				fail(w, 403, "Запрос с другого сайта запрещён")
				return
			}
			host, _, _ := net.SplitHostPort(r.RemoteAddr)
			limit := 120
			if strings.HasPrefix(r.URL.Path, "/api/auth/") {
				limit = 15
			}
			if !a.limiter.allow(host+rateScope(r.URL.Path), limit) {
				fail(w, 429, "Слишком много запросов. Попробуйте через минуту")
				return
			}
		}
		timeout := 15 * time.Second
		switch {
		case r.URL.Path == "/api/mood" || r.URL.Path == "/api/mood/stream":
			// Фаза 1 до 60 секунд + параллельные цитаты до 150 секунд.
			timeout = 240 * time.Second
		case r.URL.Path == "/api/books" && r.Method == http.MethodPost:
			timeout = 5 * time.Minute // загрузка книги файлом до 100 МБ
		}
		ctx, cancel := context.WithTimeout(r.Context(), timeout)
		defer cancel()
		m.ServeHTTP(w, r.WithContext(ctx))
	})
}
func respond(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}
func fail(w http.ResponseWriter, status int, s string) {
	respond(w, status, map[string]string{"error": s})
}
func decode(w http.ResponseWriter, r *http.Request, v any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 6<<20)
	d := json.NewDecoder(r.Body)
	d.DisallowUnknownFields()
	if e := d.Decode(v); e != nil {
		fail(w, 400, "Проверьте заполненные поля")
		return false
	}
	if d.Decode(new(any)) != io.EOF {
		fail(w, 400, "Некорректный запрос")
		return false
	}
	return true
}
func (a *app) dberr(w http.ResponseWriter, e error) {
	var pe *pgconn.PgError
	if errors.As(e, &pe) {
		if pe.Code == "23505" {
			fail(w, 409, "Эта запись уже существует")
			return
		}
		if pe.Code == "23503" {
			fail(w, 404, "Запись не найдена")
			return
		}
	}
	log.Printf("database: %v", e)
	fail(w, 500, "Не удалось сохранить. Попробуйте ещё раз")
}
func id(r *http.Request) int64 { n, _ := strconv.ParseInt(r.PathValue("id"), 10, 64); return n }
func token() string {
	b := make([]byte, 32)
	if _, e := rand.Read(b); e != nil {
		panic(e)
	}
	return hex.EncodeToString(b)
}
func digest(s string) string { h := sha256.Sum256([]byte(s)); return hex.EncodeToString(h[:]) }
func hashPassword(s string) string {
	salt := make([]byte, 16)
	rand.Read(salt)
	h := argon2.IDKey([]byte(s), salt, 2, 19456, 1, 32)
	return base64.RawStdEncoding.EncodeToString(salt) + "." + base64.RawStdEncoding.EncodeToString(h)
}
func checkPassword(s, h string) bool {
	parts := strings.Split(h, ".")
	if len(parts) != 2 {
		return false
	}
	salt, e := base64.RawStdEncoding.DecodeString(parts[0])
	if e != nil || len(salt) != 16 {
		return false
	}
	want, e := base64.RawStdEncoding.DecodeString(parts[1])
	if e != nil || len(want) != 32 {
		return false
	}
	got := argon2.IDKey([]byte(s), salt, 2, 19456, 1, 32)
	return subtle.ConstantTimeCompare(want, got) == 1
}
func (a *app) current(r *http.Request) *user {
	c, e := r.Cookie("mood_session")
	if e != nil {
		return nil
	}
	var u user
	e = a.db.QueryRow(r.Context(), `SELECT u.id,u.username,u.full_name,u.avatar,u.bio,u.is_demo FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()`, digest(c.Value)).Scan(&u.ID, &u.Username, &u.Name, &u.Avatar, &u.Bio, &u.Demo)
	if e != nil {
		return nil
	}
	return &u
}
func (a *app) require(w http.ResponseWriter, r *http.Request) *user {
	u := a.current(r)
	if u == nil {
		fail(w, 401, "Войдите, чтобы продолжить")
	}
	return u
}
func (a *app) viewer(r *http.Request) int64 {
	if u := a.current(r); u != nil {
		return u.ID
	}
	return 0
}
func (a *app) session(w http.ResponseWriter, r *http.Request, uid int64) error {
	t := token()
	_, e := a.db.Exec(r.Context(), `INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '30 days')`, digest(t), uid)
	if e != nil {
		return e
	}
	http.SetCookie(w, &http.Cookie{Name: "mood_session", Value: t, Path: "/", HttpOnly: true, Secure: a.secure, SameSite: http.SameSiteLaxMode, MaxAge: 30 * 86400})
	return nil
}
func (a *app) authSlot(w http.ResponseWriter) bool {
	select {
	case a.authSlots <- struct{}{}:
		return true
	default:
		fail(w, 429, "Сервис занят. Попробуйте чуть позже")
		return false
	}
}

var usernameRE = regexp.MustCompile(`^[a-zA-Z0-9_]{3,24}$`)

func (a *app) register(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Username string `json:"username"`
		Name     string `json:"full_name"`
		Email    string `json:"email"`
		Password string `json:"password"`
		Avatar   string `json:"avatar"`
	}
	if !decode(w, r, &in) {
		return
	}
	in.Username = strings.ToLower(strings.TrimSpace(in.Username))
	in.Name = strings.TrimSpace(in.Name)
	in.Email = strings.ToLower(strings.TrimSpace(in.Email))
	addr, e := mail.ParseAddress(in.Email)
	if !usernameRE.MatchString(in.Username) || len([]rune(in.Name)) < 3 || len([]rune(in.Name)) > 100 || len(strings.Fields(in.Name)) < 2 || e != nil || addr.Address != in.Email || len(in.Email) > 254 || !strings.HasSuffix(in.Email, "@gmail.com") || len([]rune(in.Password)) < 10 || len(in.Password) > 256 {
		fail(w, 400, "Укажите никнейм (3–24 латинских символа), фамилию и имя, Gmail и пароль от 10 символов")
		return
	}
	if !a.authSlot(w) {
		return
	}
	defer func() { <-a.authSlots }()
	avatar, e := a.avatar(in.Avatar)
	if e != nil {
		fail(w, 400, e.Error())
		return
	}
	var u user
	e = a.db.QueryRow(r.Context(), `INSERT INTO users(username,full_name,email,password_hash,avatar) VALUES($1,$2,$3,$4,$5) RETURNING id,username,full_name,avatar,bio,is_demo`, in.Username, in.Name, in.Email, hashPassword(in.Password), avatar).Scan(&u.ID, &u.Username, &u.Name, &u.Avatar, &u.Bio, &u.Demo)
	if e != nil {
		os.Remove(filepath.Join(a.uploads, filepath.Base(avatar)))
		var p *pgconn.PgError
		if errors.As(e, &p) && p.Code == "23505" {
			fail(w, 409, "Никнейм или Gmail уже занят")
			return
		}
		a.dberr(w, e)
		return
	}
	if e = a.session(w, r, u.ID); e != nil {
		a.dberr(w, e)
		return
	}
	respond(w, 201, u)
}
func (a *app) login(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if !decode(w, r, &in) {
		return
	}
	if len(in.Password) > 256 || len(in.Email) > 254 {
		fail(w, 400, "Проверьте email и пароль")
		return
	}
	if !a.authSlot(w) {
		return
	}
	defer func() { <-a.authSlots }()
	var u user
	var hash string
	e := a.db.QueryRow(r.Context(), `SELECT id,username,full_name,avatar,bio,is_demo,password_hash FROM users WHERE lower(email)=$1`, strings.ToLower(strings.TrimSpace(in.Email))).Scan(&u.ID, &u.Username, &u.Name, &u.Avatar, &u.Bio, &u.Demo, &hash)
	if e != nil {
		hash = "MDEyMzQ1Njc4OWFiY2RlZg.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
	}
	valid := checkPassword(in.Password, hash)
	if e != nil || !valid {
		fail(w, 401, "Неверный email или пароль")
		return
	}
	if e = a.session(w, r, u.ID); e != nil {
		a.dberr(w, e)
		return
	}
	respond(w, 200, u)
}
func (a *app) logout(w http.ResponseWriter, r *http.Request) {
	if c, e := r.Cookie("mood_session"); e == nil {
		if _, e = a.db.Exec(r.Context(), `DELETE FROM sessions WHERE token_hash=$1`, digest(c.Value)); e != nil {
			a.dberr(w, e)
			return
		}
	}
	http.SetCookie(w, &http.Cookie{Name: "mood_session", Value: "", Path: "/", HttpOnly: true, Secure: a.secure, SameSite: http.SameSiteLaxMode, MaxAge: -1})
	respond(w, 200, map[string]bool{"ok": true})
}
func (a *app) me(w http.ResponseWriter, r *http.Request) { respond(w, 200, a.current(r)) }

type rateEntry struct {
	count int
	until time.Time
}
type rateLimiter struct {
	sync.Mutex
	items map[string]rateEntry
}

func (l *rateLimiter) allow(key string, limit int) bool {
	l.Lock()
	defer l.Unlock()
	now := time.Now()
	for k, v := range l.items {
		if now.After(v.until) {
			delete(l.items, k)
		}
	}
	e := l.items[key]
	if e.until.IsZero() {
		e.until = now.Add(time.Minute)
	}
	e.count++
	l.items[key] = e
	return e.count <= limit
}

func rateScope(path string) string {
	parts := strings.Split(path, "/")
	if len(parts) > 2 {
		return parts[2]
	}
	return path
}

func (a *app) cleanSessions(ctx context.Context) {
	ticker := time.NewTicker(time.Hour)
	defer ticker.Stop()
	for {
		c, cancel := context.WithTimeout(ctx, 5*time.Second)
		_, err := a.db.Exec(c, `DELETE FROM sessions WHERE expires_at<now()`)
		cancel()
		if err != nil && ctx.Err() == nil {
			log.Printf("session cleanup: %v", err)
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}
