package main

// Загрузка книг файлом: PDF, EPUB, FB2, TXT, DOCX.
// PDF сохраняется целиком — его читатель открывает в ридере, а текст
// извлекается для подбора по настроению. Остальные форматы разбираются
// в текст: страницы попадают в book_pages, и книгу может читать любой
// читатель, как и любую другую в библиотеке.

import (
	"archive/zip"
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/jackc/pgx/v5/pgconn"
	"golang.org/x/text/encoding/charmap"
)

const (
	bookUploadMax = 100 << 20 // максимум на файл книги — 100 МБ
	coverMax      = 5 << 20   // максимум на обложку — 5 МБ
	textPageSize  = 1500      // символов на страницу текстовой книги
	minBookText   = 300       // минимум текста, чтобы создать книгу из файла
)

type bookFileMeta struct {
	Title  string
	Author string
}

// detectBookFormat определяет формат книги по содержимому сохранённого файла.
// imageExt — расширение файла по сигнатуре: jpg, png или webp; "" — не изображение.
func imageExt(b []byte) string {
	if len(b) >= 3 && b[0] == 0xFF && b[1] == 0xD8 && b[2] == 0xFF {
		return ".jpg"
	}
	if len(b) >= 8 && b[0] == 0x89 && b[1] == 0x50 && b[2] == 0x4E && b[3] == 0x47 {
		return ".png"
	}
	if len(b) >= 12 && string(b[0:4]) == "RIFF" && string(b[8:12]) == "WEBP" {
		return ".webp"
	}
	return ""
}

func detectBookFormat(path string) (string, error) {
	f, e := os.Open(path)
	if e != nil {
		return "", e
	}
	defer f.Close()
	head := make([]byte, 512)
	n, _ := io.ReadFull(f, head)
	head = head[:n]
	if bytes.HasPrefix(head, []byte("%PDF-")) {
		return "pdf", nil
	}
	if bytes.HasPrefix(head, []byte("PK\x03\x04")) {
		z, e := zip.OpenReader(path)
		if e != nil {
			return "", e
		}
		defer z.Close()
		for _, zf := range z.File {
			if zf.Name == "word/document.xml" {
				return "docx", nil
			}
			if zf.Name == "mimetype" {
				rc, e := zf.Open()
				if e == nil {
					b, _ := io.ReadAll(io.LimitReader(rc, 64))
					rc.Close()
					if strings.TrimSpace(string(b)) == "application/epub+zip" {
						return "epub", nil
					}
				}
			}
		}
		return "", nil
	}
	if strings.Contains(string(head), "FictionBook") {
		return "fb2", nil
	}
	if _, e := f.Seek(0, io.SeekStart); e != nil {
		return "", e
	}
	sample, e := io.ReadAll(io.LimitReader(f, 1<<20))
	if e != nil {
		return "", e
	}
	if bytes.IndexByte(sample, 0) >= 0 {
		return "", nil // бинарные данные, не похожие на книгу
	}
	return "txt", nil
}

// parseBookFile извлекает метаданные и полный текст из не-PDF книги.
func parseBookFile(path, format string) (bookFileMeta, string, error) {
	switch format {
	case "epub":
		return parseEpub(path)
	case "fb2":
		raw, e := os.ReadFile(path)
		if e != nil {
			return bookFileMeta{}, "", e
		}
		return parseFB2(raw)
	case "docx":
		text, e := parseDocx(path)
		return bookFileMeta{}, text, e
	default:
		text, e := parseTxt(path)
		return bookFileMeta{}, text, e
	}
}

// parseTxt читает TXT: UTF-8 или Windows-1251, BOM не страшен.
func parseTxt(path string) (string, error) {
	data, e := os.ReadFile(path)
	if e != nil {
		return "", e
	}
	data = bytes.TrimPrefix(data, []byte("\xef\xbb\xbf"))
	if !utf8.Valid(data) {
		conv, e := charmap.Windows1251.NewDecoder().Bytes(data)
		if e != nil {
			return "", e
		}
		data = conv
	}
	text := strings.ReplaceAll(string(data), "\r\n", "\n")
	return strings.ReplaceAll(text, "\r", "\n"), nil
}

// parseEpub: container.xml → OPF → метаданные dc:* и текст spine по порядку.
func parseEpub(path string) (bookFileMeta, string, error) {
	z, e := zip.OpenReader(path)
	if e != nil {
		return bookFileMeta{}, "", e
	}
	defer z.Close()
	byName := map[string]*zip.File{}
	for _, f := range z.File {
		byName[f.Name] = f
	}
	readZip := func(name string) ([]byte, error) {
		f, ok := byName[name]
		if !ok {
			return nil, fmt.Errorf("в EPUB нет файла %s", name)
		}
		rc, e := f.Open()
		if e != nil {
			return nil, e
		}
		defer rc.Close()
		return io.ReadAll(io.LimitReader(rc, 40<<20))
	}
	raw, e := readZip("META-INF/container.xml")
	if e != nil {
		return bookFileMeta{}, "", e
	}
	opfName := strings.TrimPrefix(epubRootPath(raw), "/")
	if opfName == "" {
		for name := range byName {
			if strings.HasSuffix(strings.ToLower(name), ".opf") {
				opfName = name
				break
			}
		}
	}
	opfRaw, e := readZip(opfName)
	if e != nil {
		return bookFileMeta{}, "", e
	}
	metaTitle, metaAuthor, hrefs, spineIDs := parseOPF(opfRaw)
	opfDir := filepath.Dir(opfName)
	names := []string{}
	for _, id := range spineIDs {
		if href := hrefs[id]; href != "" {
			names = append(names, filepath.ToSlash(filepath.Join(opfDir, href)))
		}
	}
	if len(names) == 0 {
		for _, href := range hrefs {
			lower := strings.ToLower(href)
			if strings.HasSuffix(lower, ".xhtml") || strings.HasSuffix(lower, ".html") || strings.HasSuffix(lower, ".htm") {
				names = append(names, filepath.ToSlash(filepath.Join(opfDir, href)))
			}
		}
	}
	parts := make([]string, 0, len(names))
	for _, name := range names {
		raw, e := readZip(name)
		if e != nil {
			continue
		}
		parts = append(parts, xhtmlToText(raw))
	}
	return bookFileMeta{Title: strings.TrimSpace(metaTitle), Author: strings.TrimSpace(metaAuthor)}, strings.Join(parts, "\n"), nil
}

// epubRootPath берёт full-path корневого OPF-файла из container.xml.
func epubRootPath(raw []byte) string {
	dec := xml.NewDecoder(bytes.NewReader(raw))
	for {
		tok, e := dec.Token()
		if e != nil {
			return ""
		}
		if t, ok := tok.(xml.StartElement); ok && t.Name.Local == "rootfile" {
			for _, a := range t.Attr {
				if a.Name.Local == "full-path" {
					return a.Value
				}
			}
		}
	}
}

// parseOPF достаёт из OPF заголовок, автора, манифест (id → href)
// и порядок spine. Namespace-префиксы не важны: смотрим только на local names.
func parseOPF(raw []byte) (title, author string, items map[string]string, spine []string) {
	dec := xml.NewDecoder(bytes.NewReader(raw))
	items = map[string]string{}
	zone := "" // metadata | manifest | spine
	collecting := ""
	var el strings.Builder
	for {
		tok, e := dec.Token()
		if e != nil {
			break
		}
		switch t := tok.(type) {
		case xml.StartElement:
			if zone == "" {
				switch t.Name.Local {
				case "metadata":
					zone = "metadata"
				case "manifest":
					zone = "manifest"
				case "spine":
					zone = "spine"
				}
			}
			switch {
			case zone == "metadata" && collecting == "" && (t.Name.Local == "title" || t.Name.Local == "creator"):
				collecting = t.Name.Local
				el.Reset()
			case zone == "manifest" && t.Name.Local == "item":
				id, href := "", ""
				for _, a := range t.Attr {
					if a.Name.Local == "id" {
						id = a.Value
					}
					if a.Name.Local == "href" {
						href = a.Value
					}
				}
				if id != "" && href != "" {
					items[id] = href
				}
			case zone == "spine" && t.Name.Local == "itemref":
				for _, a := range t.Attr {
					if a.Name.Local == "idref" {
						spine = append(spine, a.Value)
					}
				}
			}
		case xml.CharData:
			if collecting != "" {
				el.Write(t)
			}
		case xml.EndElement:
			if collecting != "" && t.Name.Local == collecting {
				v := strings.TrimSpace(el.String())
				if collecting == "title" && title == "" {
					title = v
				}
				if collecting == "creator" && author == "" {
					author = v
				}
				collecting = ""
			}
			if zone != "" && t.Name.Local == zone {
				zone = ""
			}
		}
	}
	return
}

// xhtmlToText превращает XHTML-разметку EPUB-главы в абзацы по строкам.
func xhtmlToText(raw []byte) string {
	dec := xml.NewDecoder(bytes.NewReader(raw))
	var b strings.Builder
	skipping := 0
	block := map[string]bool{"p": true, "div": true, "h1": true, "h2": true, "h3": true, "h4": true, "h5": true, "h6": true, "li": true, "ul": true, "ol": true, "blockquote": true, "pre": true, "section": true, "article": true, "title": true, "table": true, "tr": true}
	for {
		tok, e := dec.Token()
		if e != nil {
			break
		}
		switch t := tok.(type) {
		case xml.StartElement:
			if t.Name.Local == "script" || t.Name.Local == "style" {
				skipping++
				continue
			}
			if skipping > 0 {
				skipping++
				continue
			}
			if t.Name.Local == "br" || block[t.Name.Local] {
				b.WriteString("\n")
			}
		case xml.CharData:
			if skipping == 0 {
				b.WriteString(string(t))
			}
		case xml.EndElement:
			if skipping > 0 {
				skipping--
				continue
			}
			if block[t.Name.Local] {
				b.WriteString("\n")
			}
		}
	}
	return b.String()
}

// parseFB2: заголовок и автор из title-info, текст из body.
func parseFB2(raw []byte) (bookFileMeta, string, error) {
	dec := xml.NewDecoder(bytes.NewReader(raw))
	var meta bookFileMeta
	var text strings.Builder
	var inTitle, inBody, inP, inAuthor, inNamePart bool
	var nameTarget *strings.Builder
	var authorFirst, authorLast strings.Builder
	var para strings.Builder
	flushPara := func() {
		if p := strings.TrimSpace(para.String()); p != "" {
			text.WriteString(p + "\n")
		}
		para.Reset()
	}
	for {
		tok, e := dec.Token()
		if e != nil {
			break
		}
		switch t := tok.(type) {
		case xml.StartElement:
			switch t.Name.Local {
			case "book-title":
				inTitle = true
			case "author":
				if inAuthor {
					break
				}
				inAuthor = true
			case "first-name", "first-name-alt", "middle-name":
				if inAuthor {
					inNamePart = true
					nameTarget = &authorFirst
				}
			case "last-name", "last-name-alt":
				if inAuthor {
					inNamePart = true
					nameTarget = &authorLast
				}
			case "body":
				inBody = true
			case "p", "title":
				if inBody {
					inP = true
				}
			}
		case xml.CharData:
			s := strings.TrimSpace(string(t))
			switch {
			case inTitle && meta.Title == "":
				meta.Title = s
			case inNamePart && s != "":
				nameTarget.WriteString(s + " ")
			case inP:
				if para.Len() > 0 {
					para.WriteString(" ")
				}
				para.WriteString(s)
			}
		case xml.EndElement:
			switch t.Name.Local {
			case "book-title":
				inTitle = false
			case "author":
				if inAuthor {
					inAuthor = false
					inNamePart = false
					author := strings.TrimSpace(strings.TrimSpace(authorLast.String()) + " " + strings.TrimSpace(authorFirst.String()))
					if author != "" {
						meta.Author = author
					}
				}
			case "first-name", "first-name-alt", "middle-name", "last-name", "last-name-alt":
				inNamePart = false
				nameTarget = nil
			case "body":
				flushPara()
				inBody = false
			case "p", "title", "empty-line":
				if inP {
					flushPara()
					inP = false
				}
			}
		}
	}
	return meta, strings.TrimRight(text.String(), "\n"), nil
}

// parseDocx: абзацы word/document.xml.
func parseDocx(path string) (string, error) {
	z, e := zip.OpenReader(path)
	if e != nil {
		return "", e
	}
	defer z.Close()
	var f *zip.File
	for _, zf := range z.File {
		if zf.Name == "word/document.xml" {
			f = zf
			break
		}
	}
	if f == nil {
		return "", errors.New("не DOCX: нет word/document.xml")
	}
	rc, e := f.Open()
	if e != nil {
		return "", e
	}
	raw, e := io.ReadAll(io.LimitReader(rc, 60<<20))
	rc.Close()
	if e != nil {
		return "", e
	}
	dec := xml.NewDecoder(bytes.NewReader(raw))
	var b, line strings.Builder
	inT := false
	for {
		tok, e := dec.Token()
		if e != nil {
			break
		}
		switch t := tok.(type) {
		case xml.StartElement:
			if t.Name.Local == "t" {
				inT = true
			} else if t.Name.Local == "p" {
				if p := strings.TrimSpace(line.String()); p != "" {
					b.WriteString(p + "\n")
				}
				line.Reset()
			}
		case xml.CharData:
			if inT {
				line.Write(t)
			}
		case xml.EndElement:
			if t.Name.Local == "t" {
				inT = false
			}
		}
	}
	if p := strings.TrimSpace(line.String()); p != "" {
		b.WriteString(p + "\n")
	}
	return strings.TrimRight(b.String(), "\n"), nil
}

// splitTextPages пакует абзацы в страницы до textPageSize символов;
// очень длинные абзацы режет по границам слов.
func splitTextPages(text string) []string {
	var paragraphs []string
	for _, p := range strings.Split(text, "\n") {
		if p = strings.Join(strings.Fields(p), " "); p != "" {
			paragraphs = append(paragraphs, p)
		}
	}
	var pages []string
	var cur []string
	size := 0
	flush := func() {
		if len(cur) > 0 {
			pages = append(pages, strings.Join(cur, "\n"))
		}
		cur, size = nil, 0
	}
	for _, p := range paragraphs {
		for len([]rune(p)) > textPageSize {
			flush()
			runes := []rune(p)
			cut := textPageSize
			if i := lastSpace(runes[:cut]); i > cut/2 {
				cut = i
			}
			pages = append(pages, strings.TrimRight(string(runes[:cut]), " "))
			p = strings.TrimLeft(string(runes[cut:]), " ")
		}
		if size+len([]rune(p))+1 > textPageSize && len(cur) > 0 {
			flush()
		}
		cur = append(cur, p)
		size += len([]rune(p)) + 1
	}
	flush()
	return pages
}

// lastSpace ищет последний пробел в rune-массиве (индекс — в rune, не в байтах).
func lastSpace(r []rune) int {
	for i := len(r) - 1; i >= 0; i-- {
		if r[i] == ' ' {
			return i
		}
	}
	return -1
}

// pdftotextFile извлекает текст PDF через pdftotext.
func pdftotextFile(ctx context.Context, path string) (string, error) {
	if _, e := exec.LookPath("pdftotext"); e != nil {
		return "", errors.New("pdftotext не установлен")
	}
	cctx, cancel := context.WithTimeout(ctx, 120*time.Second)
	defer cancel()
	cmd := exec.CommandContext(cctx, "pdftotext", path, "-")
	var buf bytes.Buffer
	cmd.Stdout = &buf
	cmd.Stderr = io.Discard
	if e := cmd.Run(); e != nil {
		return "", e
	}
	return buf.String(), nil
}

// digitGarbleRatio — доля цифр среди всех цифр и букв текста.
// Сломанные кодировки PDF (нет ToUnicode у казахских шрифтов) заменяют
// буквы цифрами и прочими символами: у таких страниц цифр заметно больше,
// чем у нормального текста (обычно <1%).
func digitGarbleRatio(s string) float64 {
	letters, digits := 0, 0
	for _, r := range s {
		switch {
		case unicode.IsLetter(r):
			letters++
		case unicode.IsDigit(r):
			digits++
		}
	}
	total := letters + digits
	if total < 100 {
		return 0
	}
	return float64(digits) / float64(total)
}

// bookTextGarbled — вся книга «сломана»: по всему тексту цифр больше 2.5%
// (у нормальных книг даже с номерами глав и датами — меньше 2%). Такой
// текст не храним: ридер покажет сам PDF, а подбору по настроению мусор
// только мешает.
func bookTextGarbled(texts []string) bool {
	letters, digits := 0, 0
	for _, t := range texts {
		for _, r := range t {
			switch {
			case unicode.IsLetter(r):
				letters++
			case unicode.IsDigit(r):
				digits++
			}
		}
	}
	total := letters + digits
	if total < 1000 {
		return false
	}
	return float64(digits) > 0.025*float64(total)
}

// createBook — POST /api/books: карточка книги или книга файлом
// (PDF, EPUB, FB2, TXT, DOCX до 100 МБ).
func (a *app) createBook(w http.ResponseWriter, r *http.Request) {
	u := a.require(w, r)
	if u == nil {
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, bookUploadMax+1<<20)
	if e := r.ParseMultipartForm(4 << 20); e != nil {
		fail(w, 400, "Файл слишком большой. Максимум — 100 МБ")
		return
	}
	defer r.MultipartForm.RemoveAll()
	title := strings.TrimSpace(r.FormValue("title"))
	author := strings.TrimSpace(r.FormValue("author"))
	description := strings.TrimSpace(r.FormValue("description"))
	genre := strings.TrimSpace(r.FormValue("genre"))
	if genre == "" {
		genre = "Классика"
	}
	if len([]rune(genre)) > 60 || len([]rune(title)) > 200 || len([]rune(author)) > 150 || len([]rune(description)) > 3000 {
		fail(w, 400, "Название — до 200, автор — до 150, жанр — до 60, описание — до 3000 символов")
		return
	}
	filePath := ""
	var fileHash any
	var pageNums []int
	var pageTexts []string
	f, _, e := r.FormFile("file")
	if e == nil {
		defer f.Close()
		tmp := filepath.Join(a.uploads, ".up-"+token()+".tmp")
		out, e := os.OpenFile(tmp, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
		if e != nil {
			fail(w, 500, "Не удалось сохранить файл")
			return
		}
		h := sha256.New()
		n, e := io.Copy(io.MultiWriter(out, h), f)
		out.Close()
		if e != nil || n == 0 {
			os.Remove(tmp)
			fail(w, 400, "Не удалось прочитать файл")
			return
		}
		if n > bookUploadMax {
			os.Remove(tmp)
			fail(w, 400, "Файл слишком большой. Максимум — 100 МБ")
			return
		}
		format, e := detectBookFormat(tmp)
		if e != nil || format == "" {
			os.Remove(tmp)
			fail(w, 400, "Не распознан формат файла. Поддерживаются PDF, EPUB, FB2, TXT и DOCX")
			return
		}
		hashHex := hex.EncodeToString(h.Sum(nil))
		fileHash = hashHex
		var dup bool
		if e := a.db.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM books WHERE file_hash=$1)`, hashHex).Scan(&dup); e != nil {
			a.dberr(w, e)
			return
		}
		if dup {
			os.Remove(tmp)
			fail(w, 409, "Эта книга уже есть в библиотеке. Найдите её по названию или автору")
			return
		}
		switch format {
		case "pdf":
			final := filepath.Join(a.uploads, token()+".pdf")
			if e := os.Rename(tmp, final); e != nil {
				os.Remove(tmp)
				fail(w, 500, "Не удалось сохранить файл")
				return
			}
			filePath = "/uploads/" + filepath.Base(final)
			if raw, e := pdftotextFile(r.Context(), final); e == nil {
				pNums, pTexts := []int{}, []string{}
				for i, p := range strings.Split(raw, "\f") {
					if p = strings.TrimSpace(p); p == "" {
						continue
					}
					pNums = append(pNums, i+1)
					pTexts = append(pTexts, p)
				}
				if bookTextGarbled(pTexts) {
					log.Printf("book %s: текст PDF повреждён кодировкой — страницы не сохраняем", filepath.Base(final))
				} else {
					pageNums, pageTexts = pNums, pTexts
				}
			} else {
				log.Printf("book %s: текст PDF: %v", filepath.Base(final), e)
			}
		default:
			meta, text, e := parseBookFile(tmp, format)
			os.Remove(tmp)
			if e != nil {
				fail(w, 400, "Не удалось извлечь текст из файла")
				return
			}
			if title == "" {
				title = meta.Title
			}
			if author == "" {
				author = meta.Author
			}
			if len([]rune(strings.TrimSpace(text))) < minBookText {
				fail(w, 400, "В файле слишком мало текста, чтобы создать книгу")
				return
			}
			for i, p := range splitTextPages(text) {
				pageNums = append(pageNums, i+1)
				pageTexts = append(pageTexts, p)
			}
		}
	} else if e != http.ErrMissingFile {
		fail(w, 400, "Не удалось прочитать файл")
		return
	}
	coverPath := ""
	if cf, _, e := r.FormFile("cover"); e == nil {
		defer cf.Close()
		raw, e := io.ReadAll(io.LimitReader(cf, coverMax+1))
		if e != nil || len(raw) == 0 {
			fail(w, 400, "Не удалось прочитать обложку")
			return
		}
		if len(raw) > coverMax {
			fail(w, 400, "Обложка слишком большая. Максимум — 5 МБ")
			return
		}
		ext := imageExt(raw)
		if ext == "" {
			fail(w, 400, "Обложка должна быть изображением: JPG, PNG или WebP")
			return
		}
		final := filepath.Join(a.uploads, token()+ext)
		if e := os.WriteFile(final, raw, 0600); e != nil {
			os.Remove(final)
			fail(w, 500, "Не удалось сохранить обложку")
			return
		}
		coverPath = "/uploads/" + filepath.Base(final)
	} else if e != http.ErrMissingFile {
		fail(w, 400, "Не удалось прочитать обложку")
		return
	}
	if len([]rune(title)) < 1 || len([]rune(author)) < 2 {
		fail(w, 400, "Укажите название и автора книги")
		return
	}
	tx, e := a.db.Begin(r.Context())
	if e != nil {
		a.dberr(w, e)
		return
	}
	defer tx.Rollback(r.Context())
	var bid int64
	if e := tx.QueryRow(r.Context(), `INSERT INTO books(title,author,description,uploader_id,file_path,file_hash,topic,pages,cover_path) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
		title, author, description, u.ID, filePath, fileHash, genre, len(pageTexts), coverPath).Scan(&bid); e != nil {
		os.Remove(filepath.Join(a.uploads, filepath.Base(filePath)))
		if coverPath != "" {
			os.Remove(filepath.Join(a.uploads, filepath.Base(coverPath)))
		}
		var pe *pgconn.PgError
		if errors.As(e, &pe) && pe.Code == "23505" {
			fail(w, 409, "Эта книга уже есть в библиотеке. Найдите её по названию или автору")
			return
		}
		a.dberr(w, e)
		return
	}
	if len(pageTexts) > 0 {
		if _, e := tx.Exec(r.Context(), `INSERT INTO book_pages(book_id,page,text) SELECT $1,v.n,v.t FROM unnest($2::int[],$3::text[]) AS v(n,t) ON CONFLICT DO NOTHING`, bid, pageNums, pageTexts); e != nil {
			a.dberr(w, e)
			return
		}
	}
	if e := tx.Commit(r.Context()); e != nil {
		a.dberr(w, e)
		return
	}
	respond(w, 201, map[string]int64{"id": bid})
}
