package main

import (
	"bytes"
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"image"
	_ "image/jpeg"
	"image/png"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

const postSelect = `SELECT p.id,u.id,u.username,u.full_name,u.avatar,u.bio,u.is_demo,b.id,b.title,b.author,b.description,b.color,p.kind,p.quote,p.opinion,p.page,p.lines,p.created_at,b.topic,b.language,b.cover_path,
 (SELECT count(*) FROM post_likes l WHERE l.post_id=p.id),(SELECT count(*) FROM comments c WHERE c.post_id=p.id),
 EXISTS(SELECT 1 FROM post_likes l WHERE l.post_id=p.id AND l.user_id=$1),EXISTS(SELECT 1 FROM bookmarks s WHERE s.post_id=p.id AND s.user_id=$1)
 FROM posts p JOIN users u ON u.id=p.user_id JOIN books b ON b.id=p.book_id `

func scanPost(row pgx.Row) (post, error) {
	var p post
	e := row.Scan(&p.ID, &p.User.ID, &p.User.Username, &p.User.Name, &p.User.Avatar, &p.User.Bio, &p.User.Demo, &p.Book.ID, &p.Book.Title, &p.Book.Author, &p.Book.Description, &p.Book.Color, &p.Kind, &p.Quote, &p.Opinion, &p.Page, &p.Lines, &p.Created, &p.Book.Topic, &p.Book.Language, &p.Book.Cover, &p.Likes, &p.Comments, &p.Liked, &p.Saved)
	return p, e
}
func (a *app) posts(w http.ResponseWriter, r *http.Request) {
	v := a.viewer(r)
	q := r.URL.Query()
	before, _ := strconv.ParseInt(q.Get("before"), 10, 64)
	uid, _ := strconv.ParseInt(q.Get("user"), 10, 64)
	bid, _ := strconv.ParseInt(q.Get("book"), 10, 64)
	mode := q.Get("feed")
	topic := q.Get("topic")
	if len(topic) > 60 {
		fail(w, 400, "Слишком длинное название темы")
		return
	}
	if (mode == "following" || mode == "saved") && v == 0 {
		fail(w, 401, "Войдите, чтобы продолжить")
		return
	}
	search := strings.TrimSpace(q.Get("q"))
	if len(search) > 200 {
		fail(w, 400, "Поисковый запрос слишком длинный")
		return
	}
	rows, e := a.db.Query(r.Context(), postSelect+`WHERE ($2::bigint=0 OR p.id<$2) AND ($3::bigint=0 OR p.user_id=$3) AND ($4::bigint=0 OR p.book_id=$4)
 AND ($5::text='' OR p.opinion ILIKE '%'||$5||'%' OR p.quote ILIKE '%'||$5||'%' OR b.title ILIKE '%'||$5||'%' OR b.author ILIKE '%'||$5||'%')
 AND ($6::text<>'following' OR EXISTS(SELECT 1 FROM follows f WHERE f.user_id=$1 AND f.target_id=p.user_id))
 AND ($6::text<>'saved' OR EXISTS(SELECT 1 FROM bookmarks s WHERE s.user_id=$1 AND s.post_id=p.id)) AND ($7::text='' OR b.topic=$7) ORDER BY p.id DESC LIMIT 20`, v, before, uid, bid, search, mode, topic)
	if e != nil {
		a.dberr(w, e)
		return
	}
	defer rows.Close()
	items := []post{}
	for rows.Next() {
		p, e := scanPost(rows)
		if e != nil {
			a.dberr(w, e)
			return
		}
		items = append(items, p)
	}
	if e = rows.Err(); e != nil {
		a.dberr(w, e)
		return
	}
	respond(w, 200, items)
}
func (a *app) singlePost(w http.ResponseWriter, r *http.Request) {
	p, e := scanPost(a.db.QueryRow(r.Context(), postSelect+`WHERE p.id=$2`, a.viewer(r), id(r)))
	if e != nil {
		if errors.Is(e, pgx.ErrNoRows) {
			fail(w, 404, "Публикация не найдена")
		} else {
			a.dberr(w, e)
		}
		return
	}
	respond(w, 200, p)
}
func (a *app) createPost(w http.ResponseWriter, r *http.Request) {
	u := a.require(w, r)
	if u == nil {
		return
	}
	var in struct {
		BookID  int64  `json:"book_id"`
		Kind    string `json:"kind"`
		Quote   string `json:"quote"`
		Opinion string `json:"opinion"`
		Page    int    `json:"page"`
		Lines   string `json:"lines"`
	}
	if !decode(w, r, &in) {
		return
	}
	in.Quote = strings.TrimSpace(in.Quote)
	in.Opinion = strings.TrimSpace(in.Opinion)
	in.Lines = strings.TrimSpace(in.Lines)
	if in.BookID <= 0 || (in.Kind != "quote" && in.Kind != "recommendation") || len([]rune(in.Opinion)) < 1 || len([]rune(in.Opinion)) > 5000 || len([]rune(in.Quote)) > 3000 || (in.Kind == "quote" && in.Quote == "") || in.Page < 0 || in.Page > 100000 || len([]rune(in.Lines)) > 60 {
		fail(w, 400, "Выберите книгу, добавьте цитату и своё мнение. Мнение — до 5000 символов, цитата — до 3000")
		return
	}
	if in.Kind == "recommendation" {
		in.Quote = ""
		in.Page = 0
		in.Lines = ""
	}
	var pid int64
	e := a.db.QueryRow(r.Context(), `INSERT INTO posts(user_id,book_id,kind,quote,opinion,page,lines) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`, u.ID, in.BookID, in.Kind, in.Quote, in.Opinion, in.Page, in.Lines).Scan(&pid)
	if e != nil {
		a.dberr(w, e)
		return
	}
	p, e := scanPost(a.db.QueryRow(r.Context(), postSelect+`WHERE p.id=$2`, u.ID, pid))
	if e != nil {
		a.dberr(w, e)
		return
	}
	respond(w, 201, p)
}
func (a *app) toggle(w http.ResponseWriter, r *http.Request, table, column, targetTable string) {
	u := a.require(w, r)
	if u == nil {
		return
	}
	var found bool
	if e := a.db.QueryRow(r.Context(), "SELECT EXISTS(SELECT 1 FROM "+targetTable+" WHERE id=$1)", id(r)).Scan(&found); e != nil {
		a.dberr(w, e)
		return
	}
	if !found {
		fail(w, 404, "Запись не найдена")
		return
	}
	if table == "follows" && u.ID == id(r) {
		fail(w, 400, "Нельзя подписаться на себя")
		return
	}
	var e error
	if r.Method == "PUT" {
		_, e = a.db.Exec(r.Context(), "INSERT INTO "+table+"(user_id,"+column+") VALUES($1,$2) ON CONFLICT DO NOTHING", u.ID, id(r))
	} else {
		_, e = a.db.Exec(r.Context(), "DELETE FROM "+table+" WHERE user_id=$1 AND "+column+"=$2", u.ID, id(r))
	}
	if e != nil {
		a.dberr(w, e)
		return
	}
	respond(w, 200, map[string]bool{"active": r.Method == "PUT"})
}
func (a *app) likePost(w http.ResponseWriter, r *http.Request) {
	a.toggle(w, r, "post_likes", "post_id", "posts")
}
func (a *app) savePost(w http.ResponseWriter, r *http.Request) {
	a.toggle(w, r, "bookmarks", "post_id", "posts")
}
func (a *app) likeBook(w http.ResponseWriter, r *http.Request) {
	a.toggle(w, r, "book_likes", "book_id", "books")
}
func (a *app) follow(w http.ResponseWriter, r *http.Request) {
	a.toggle(w, r, "follows", "target_id", "users")
}

type comment struct {
	ID      int64     `json:"id"`
	User    user      `json:"user"`
	Body    string    `json:"body"`
	Created time.Time `json:"created_at"`
}

func (a *app) comments(w http.ResponseWriter, r *http.Request) {
	after, _ := strconv.ParseInt(r.URL.Query().Get("after"), 10, 64)
	rows, e := a.db.Query(r.Context(), `SELECT c.id,u.id,u.username,u.full_name,u.avatar,u.bio,u.is_demo,c.body,c.created_at FROM comments c JOIN users u ON u.id=c.user_id WHERE c.post_id=$1 AND c.id>$2 ORDER BY c.id LIMIT 50`, id(r), after)
	if e != nil {
		a.dberr(w, e)
		return
	}
	defer rows.Close()
	items := []comment{}
	for rows.Next() {
		var c comment
		if e = rows.Scan(&c.ID, &c.User.ID, &c.User.Username, &c.User.Name, &c.User.Avatar, &c.User.Bio, &c.User.Demo, &c.Body, &c.Created); e != nil {
			a.dberr(w, e)
			return
		}
		items = append(items, c)
	}
	if e = rows.Err(); e != nil {
		a.dberr(w, e)
		return
	}
	respond(w, 200, items)
}
func (a *app) createComment(w http.ResponseWriter, r *http.Request) {
	u := a.require(w, r)
	if u == nil {
		return
	}
	var in struct {
		Body string `json:"body"`
	}
	if !decode(w, r, &in) {
		return
	}
	in.Body = strings.TrimSpace(in.Body)
	if len([]rune(in.Body)) < 1 || len([]rune(in.Body)) > 2000 {
		fail(w, 400, "Комментарий — от 1 до 2000 символов")
		return
	}
	var postExists bool
	e := a.db.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM posts WHERE id=$1)`, id(r)).Scan(&postExists)
	if e != nil {
		a.dberr(w, e)
		return
	}
	if !postExists {
		fail(w, 404, "Публикация не найдена")
		return
	}
	var c comment
	c.User = *u
	e = a.db.QueryRow(r.Context(), `INSERT INTO comments(user_id,post_id,body) VALUES($1,$2,$3) RETURNING id,body,created_at`, u.ID, id(r), in.Body).Scan(&c.ID, &c.Body, &c.Created)
	if e != nil {
		a.dberr(w, e)
		return
	}
	respond(w, 201, c)
}

const bookSelect = `SELECT b.id,b.title,b.author,b.description,b.color,b.file_path,b.topic,b.language,b.source_url,b.license,b.pages,b.cover_path,b.cover_source,b.cover_edition,coalesce(b.uploader_id,0),coalesce(u.full_name,''),(SELECT count(*) FROM book_likes l WHERE l.book_id=b.id),EXISTS(SELECT 1 FROM book_likes l WHERE l.book_id=b.id AND l.user_id=$1),EXISTS(SELECT 1 FROM book_saves s WHERE s.book_id=b.id AND s.user_id=$1) FROM books b LEFT JOIN users u ON u.id=b.uploader_id `

func (a *app) books(w http.ResponseWriter, r *http.Request) {
	viewer := a.viewer(r)
	savedOnly := r.URL.Query().Get("feed") == "saved"
	if savedOnly && viewer == 0 {
		fail(w, 401, "Войдите, чтобы открыть сохранённые книги")
		return
	}
	genre := strings.TrimSpace(r.URL.Query().Get("genre"))
	if len([]rune(genre)) > 60 {
		fail(w, 400, "Название жанра слишком длинное")
		return
	}
	q := r.URL.Query().Get("q")
	if len(q) > 200 {
		fail(w, 400, "Поисковый запрос слишком длинный")
		return
	}
	before, _ := strconv.ParseInt(r.URL.Query().Get("before"), 10, 64)
	rows, e := a.db.Query(r.Context(), bookSelect+`WHERE ($2::text='' OR b.title ILIKE '%'||$2||'%' OR b.author ILIKE '%'||$2||'%') AND ($3::bigint=0 OR b.id<$3) AND ($4::text='' OR b.topic=$4) AND (NOT $5::boolean OR EXISTS(SELECT 1 FROM book_saves s WHERE s.book_id=b.id AND s.user_id=$1)) ORDER BY b.id DESC LIMIT 30`, viewer, q, before, genre, savedOnly)
	if e != nil {
		a.dberr(w, e)
		return
	}
	defer rows.Close()
	items := []book{}
	for rows.Next() {
		var b book
		if e = rows.Scan(&b.ID, &b.Title, &b.Author, &b.Description, &b.Color, &b.File, &b.Topic, &b.Language, &b.Source, &b.License, &b.Pages, &b.Cover, &b.CoverSource, &b.CoverEdition, &b.UploaderID, &b.Uploader, &b.Likes, &b.Liked, &b.Saved); e != nil {
			a.dberr(w, e)
			return
		}
		items = append(items, b)
	}
	if e = rows.Err(); e != nil {
		a.dberr(w, e)
		return
	}
	respond(w, 200, items)
}

// bookPages — GET /api/books/{id}/pages: страницы текста книги
// для текстового ридера (EPUB/FB2/TXT/DOCX) и для предпросмотра.
func (a *app) bookPages(w http.ResponseWriter, r *http.Request) {
	id, e := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if e != nil {
		fail(w, 404, "Книга не найдена")
		return
	}
	var exists bool
	if e := a.db.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM books WHERE id=$1)`, id).Scan(&exists); e != nil {
		a.dberr(w, e)
		return
	}
	if !exists {
		fail(w, 404, "Книга не найдена")
		return
	}
	from, _ := strconv.Atoi(r.URL.Query().Get("from"))
	if from < 1 {
		from = 1
	}
	to, _ := strconv.Atoi(r.URL.Query().Get("to"))
	if to < from {
		to = from
	}
	if to > from+9 {
		to = from + 9
	}
	var total int
	if e := a.db.QueryRow(r.Context(), `SELECT coalesce(max(page),0) FROM book_pages WHERE book_id=$1`, id).Scan(&total); e != nil {
		a.dberr(w, e)
		return
	}
	rows, e := a.db.Query(r.Context(), `SELECT page,text FROM book_pages WHERE book_id=$1 AND page BETWEEN $2 AND $3 ORDER BY page`, id, from, to)
	if e != nil {
		a.dberr(w, e)
		return
	}
	defer rows.Close()
	items := []map[string]any{}
	for rows.Next() {
		var p int
		var text string
		if e := rows.Scan(&p, &text); e != nil {
			a.dberr(w, e)
			return
		}
		items = append(items, map[string]any{"page": p, "text": text})
	}
	if e := rows.Err(); e != nil {
		a.dberr(w, e)
		return
	}
	respond(w, 200, map[string]any{"pages": total, "items": items})
}
func (a *app) profile(w http.ResponseWriter, r *http.Request) {
	var u user
	e := a.db.QueryRow(r.Context(), `SELECT id,username,full_name,avatar,bio,is_demo FROM users WHERE lower(username)=lower($1)`, r.PathValue("username")).Scan(&u.ID, &u.Username, &u.Name, &u.Avatar, &u.Bio, &u.Demo)
	if e != nil {
		if errors.Is(e, pgx.ErrNoRows) {
			fail(w, 404, "Читатель не найден")
		} else {
			a.dberr(w, e)
		}
		return
	}
	var followers, following, posts int
	var followed bool
	e = a.db.QueryRow(r.Context(), `SELECT (SELECT count(*) FROM follows WHERE target_id=$1),(SELECT count(*) FROM follows WHERE user_id=$1),(SELECT count(*) FROM posts WHERE user_id=$1),EXISTS(SELECT 1 FROM follows WHERE target_id=$1 AND user_id=$2)`, u.ID, a.viewer(r)).Scan(&followers, &following, &posts, &followed)
	if e != nil {
		a.dberr(w, e)
		return
	}
	respond(w, 200, map[string]any{"user": u, "followers": followers, "following": following, "posts": posts, "followed": followed})
}
func (a *app) avatar(data string) (string, error) {
	parts := strings.SplitN(data, ",", 2)
	if len(parts) != 2 || (!strings.HasPrefix(parts[0], "data:image/png;") && !strings.HasPrefix(parts[0], "data:image/jpeg;")) {
		return "", errors.New("Добавьте фото в формате JPG или PNG")
	}
	raw, e := base64.StdEncoding.DecodeString(parts[1])
	if e != nil || len(raw) > 4<<20 {
		return "", errors.New("Фото должно быть меньше 4 МБ")
	}
	cfg, _, e := image.DecodeConfig(bytes.NewReader(raw))
	if e != nil || cfg.Width > 4096 || cfg.Height > 4096 || cfg.Width < 1 || cfg.Height < 1 {
		return "", errors.New("Выберите изображение до 4096 × 4096 пикселей")
	}
	img, _, e := image.Decode(bytes.NewReader(raw))
	if e != nil {
		return "", errors.New("Не удалось прочитать фото")
	}
	path := "/uploads/" + token() + ".png"
	f, e := os.OpenFile(filepath.Join(a.uploads, filepath.Base(path)), os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
	if e != nil {
		return "", fmt.Errorf("Не удалось сохранить фото")
	}
	e = png.Encode(f, img)
	f.Close()
	if e != nil {
		return "", errors.New("Не удалось сохранить фото")
	}
	return path, nil
}
func (a *app) seed(ctx context.Context) error {
	tx, e := a.db.Begin(ctx)
	if e != nil {
		return e
	}
	defer tx.Rollback(ctx)
	// Serialize first boot so two instances cannot create duplicate starter content.
	if _, e = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(847291)`); e != nil {
		return e
	}
	var count int
	if e = tx.QueryRow(ctx, `SELECT count(*) FROM users`).Scan(&count); e != nil {
		return e
	}
	if count > 0 {
		return tx.Commit(ctx)
	}
	names := [][4]string{{"aigerim.reads", "Серикова Айгерим", "Читаю, чтобы замечать больше. Алматы 📍", ""}, {"arman.books", "Омаров Арман", "На полях книг и где-то между строк.", ""}, {"dana.s", "Садыкова Дана", "Книги, которые остаются с нами.", ""}}
	ids := []int64{}
	for _, n := range names {
		var uid int64
		e = tx.QueryRow(ctx, `INSERT INTO users(username,full_name,email,password_hash,bio,is_demo) VALUES($1,$2,$3,'!disabled',$4,true) RETURNING id`, n[0], n[1], n[0]+"@example.invalid", n[2]).Scan(&uid)
		if e != nil {
			return e
		}
		ids = append(ids, uid)
	}
	bs := [][4]string{{"Слова назидания", "Абай Кунанбаев", "О человеке, знании и том, как прожить осмысленную жизнь.", "#285345"}, {"Маленький принц", "Антуан де Сент-Экзюпери", "История о дружбе, заботе и умении видеть сердцем.", "#536b91"}, {"Белые ночи", "Фёдор Достоевский", "Четыре ночи и одно утро из жизни мечтателя.", "#9b6357"}, {"Абай жолы", "Мухтар Ауэзов", "Путь поэта и целая эпоха в жизни казахской степи.", "#b09660"}, {"Гордость и предубеждение", "Джейн Остин", "О первых впечатлениях и смелости изменить своё мнение.", "#777852"}}
	bids := []int64{}
	for _, b := range bs {
		var bid int64
		e = tx.QueryRow(ctx, `INSERT INTO books(title,author,description,color,uploader_id) VALUES($1,$2,$3,$4,$5) RETURNING id`, b[0], b[1], b[2], b[3], ids[0]).Scan(&bid)
		if e != nil {
			return e
		}
		bids = append(bids, bid)
	}
	entries := []struct {
		u, b                 int
		kind, quote, opinion string
		page                 int
		lines                string
	}{{2, 2, "quote", "Боже мой! Целая минута блаженства! Да разве этого мало хоть бы и на всю жизнь человеческую?..", "Иногда книга напоминает: ценность момента не в том, сколько он длился. Бывает, один разговор помнишь дольше, чем целый год. У вас есть такой момент?", 112, "8–10"}, {1, 1, "recommendation", "", "Перечитал «Маленького принца» спустя десять лет. В детстве это было путешествие по планетам, а сейчас — разговор о том, на что мы тратим свою жизнь. Подарите себе вечер с этой книгой. Совсем другое чтение.", 0, ""}, {0, 0, "quote", "Адам баласы адам баласынан ақыл, ғылым, ар, мінез деген нәрселермен озбақ.", "Возвращаюсь к этим словам, когда начинаю сравнивать себя с другими. Абай так точно называет вещи, в которых действительно стоит расти: ум, знания, совесть, характер. Всё остальное — шум.", 38, "4–6"}}
	for i, p := range entries {
		_, e = tx.Exec(ctx, `INSERT INTO posts(user_id,book_id,kind,quote,opinion,page,lines,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,now()-($8 * interval '1 hour'))`, ids[p.u], bids[p.b], p.kind, p.quote, p.opinion, p.page, p.lines, len(entries)-i)
		if e != nil {
			return e
		}
	}
	return tx.Commit(ctx)
}

func (a *app) singleBook(w http.ResponseWriter, r *http.Request) {
	var b book
	e := a.db.QueryRow(r.Context(), bookSelect+`WHERE b.id=$2`, a.viewer(r), id(r)).Scan(&b.ID, &b.Title, &b.Author, &b.Description, &b.Color, &b.File, &b.Topic, &b.Language, &b.Source, &b.License, &b.Pages, &b.Cover, &b.CoverSource, &b.CoverEdition, &b.UploaderID, &b.Uploader, &b.Likes, &b.Liked, &b.Saved)
	if e != nil {
		if errors.Is(e, pgx.ErrNoRows) {
			fail(w, 404, "Книга не найдена")
		} else {
			a.dberr(w, e)
		}
		return
	}
	respond(w, 200, b)
}

var uploadNameRE = regexp.MustCompile(`^[a-f0-9]{64}\.(png|jpg|webp|pdf)$`)

func (a *app) serveUpload(w http.ResponseWriter, r *http.Request) {
	name := strings.TrimPrefix(r.URL.Path, "/uploads/")
	if !uploadNameRE.MatchString(name) {
		http.NotFound(w, r)
		return
	}
	if strings.HasSuffix(name, ".pdf") {
		w.Header().Set("Content-Disposition", `attachment; filename="book.pdf"`)
	}
	w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	http.ServeFile(w, r, filepath.Join(a.uploads, name))
}

func (a *app) readBook(w http.ResponseWriter, r *http.Request) {
	var file string
	err := a.db.QueryRow(r.Context(), `SELECT file_path FROM books WHERE id=$1`, id(r)).Scan(&file)
	if err != nil || file == "" {
		fail(w, 404, "У этой книги пока нет файла для чтения")
		return
	}
	name := strings.TrimPrefix(file, "/uploads/")
	if !uploadNameRE.MatchString(name) || !strings.HasSuffix(name, ".pdf") {
		fail(w, 404, "Файл недоступен")
		return
	}
	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", `inline; filename="book.pdf"`)
	w.Header().Set("Cache-Control", "public, max-age=3600")
	http.ServeFile(w, r, filepath.Join(a.uploads, name))
}
func (a *app) readers(w http.ResponseWriter, r *http.Request) {
	rows, err := a.db.Query(r.Context(), `SELECT u.id,u.username,u.full_name,u.avatar,u.bio,u.is_demo FROM users u WHERE EXISTS(SELECT 1 FROM posts p WHERE p.user_id=u.id) ORDER BY u.id DESC LIMIT 8`)
	if err != nil {
		a.dberr(w, err)
		return
	}
	defer rows.Close()
	items := []user{}
	for rows.Next() {
		var u user
		if err = rows.Scan(&u.ID, &u.Username, &u.Name, &u.Avatar, &u.Bio, &u.Demo); err != nil {
			a.dberr(w, err)
			return
		}
		items = append(items, u)
	}
	if err = rows.Err(); err != nil {
		a.dberr(w, err)
		return
	}
	respond(w, 200, items)
}

func (a *app) bookGenres(w http.ResponseWriter, r *http.Request) {
	rows, err := a.db.Query(r.Context(), `SELECT DISTINCT topic FROM books WHERE trim(topic)<>'' ORDER BY topic`)
	if err != nil {
		a.dberr(w, err)
		return
	}
	defer rows.Close()
	genres := []string{}
	for rows.Next() {
		var genre string
		if err = rows.Scan(&genre); err != nil {
			a.dberr(w, err)
			return
		}
		genres = append(genres, genre)
	}
	if err = rows.Err(); err != nil {
		a.dberr(w, err)
		return
	}
	respond(w, 200, genres)
}

func (a *app) saveBook(w http.ResponseWriter, r *http.Request) {
	a.toggle(w, r, "book_saves", "book_id", "books")
}
