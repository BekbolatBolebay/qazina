package main

import (
	"archive/zip"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"golang.org/x/text/encoding/charmap"
)

func writeTempBook(t *testing.T, name, content string) string {
	t.Helper()
	p := filepath.Join(t.TempDir(), name)
	if e := os.WriteFile(p, []byte(content), 0600); e != nil {
		t.Fatal(e)
	}
	return p
}

func makeZipBook(t *testing.T, files map[string]string) string {
	t.Helper()
	p := filepath.Join(t.TempDir(), "book.zip")
	f, e := os.Create(p)
	if e != nil {
		t.Fatal(e)
	}
	zw := zip.NewWriter(f)
	for name, content := range files {
		w, e := zw.Create(name)
		if e != nil {
			t.Fatal(e)
		}
		if _, e := io.Copy(w, strings.NewReader(content)); e != nil {
			t.Fatal(e)
		}
	}
	if e := zw.Close(); e != nil {
		t.Fatal(e)
	}
	f.Close()
	return p
}

func TestDetectBookFormat(t *testing.T) {
	cases := []struct {
		name    string
		content string
		want    string
	}{
		{"pdf", "%PDF-1.4\nobj\nendobj\n%%EOF", "pdf"},
		{"fb2", `<?xml version="1.0" encoding="UTF-8"?><FictionBook><body><p>Текст</p></body></FictionBook>`, "fb2"},
		{"txt", "Одна строка текста.\nВторая строка текста.", "txt"},
		{"binary", "\x00\x01\x02\x89PNG\r\n\x1a\n", ""},
	}
	for _, c := range cases {
		if got, e := detectBookFormat(writeTempBook(t, c.name, c.content)); e != nil || got != c.want {
			t.Fatalf("detectBookFormat(%s) = %q (err %v), want %q", c.name, got, e, c.want)
		}
	}
	epub := makeZipBook(t, map[string]string{
		"mimetype":               "application/epub+zip",
		"META-INF/container.xml": `<?xml version="1.0"?><container><rootfiles><rootfile full-path="OEBPS/content.opf"/></rootfiles></container>`,
		"OEBPS/content.opf":      `<?xml version="1.0"?><package></package>`,
	})
	if got, e := detectBookFormat(epub); e != nil || got != "epub" {
		t.Fatalf("detect epub = %q (err %v), want epub", got, e)
	}
	docx := makeZipBook(t, map[string]string{"word/document.xml": "<w:document/>"})
	if got, e := detectBookFormat(docx); e != nil || got != "docx" {
		t.Fatalf("detect docx = %q (err %v), want docx", got, e)
	}
	plain := makeZipBook(t, map[string]string{"readme.txt": "hello"})
	if got, e := detectBookFormat(plain); e != nil || got != "" {
		t.Fatalf("plain zip = %q (err %v), want unknown", got, e)
	}
}

func TestImageExt(t *testing.T) {
	jpeg := append([]byte{0xFF, 0xD8, 0xFF, 0xE0}, make([]byte, 10)...)
	png := append([]byte{0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A}, make([]byte, 8)...)
	webp := []byte("RIFF" + "\x00\x00\x00\x00" + "WEBP")
	cases := []struct {
		name string
		b    []byte
		want string
	}{
		{"jpeg", jpeg, ".jpg"},
		{"png", png, ".png"},
		{"webp", webp, ".webp"},
		{"empty", []byte{}, ""},
		{"short", []byte{0xFF, 0xD8}, ""},
		{"text", []byte("не картинка вообще"), ""},
		{"pdf", []byte("%PDF-1.4"), ""},
	}
	for _, c := range cases {
		if got := imageExt(c.b); got != c.want {
			t.Fatalf("imageExt(%s) = %q, want %q", c.name, got, c.want)
		}
	}
}

func TestSplitTextPages(t *testing.T) {
	if pages := splitTextPages(""); len(pages) != 0 {
		t.Fatalf("empty text: %d pages", len(pages))
	}
	if pages := splitTextPages("Короткий текст."); len(pages) != 1 || pages[0] != "Короткий текст." {
		t.Fatalf("short text: %v", pages)
	}
	var paragraphs []string
	for i := 0; i < 60; i++ {
		paragraphs = append(paragraphs, strings.Repeat("абзац номер", 20)+" точка.")
	}
	text := strings.Join(paragraphs, "\n")
	pages := splitTextPages(text)
	if len(pages) < 4 {
		t.Fatalf("too few pages: %d", len(pages))
	}
	for i, p := range pages {
		if n := len([]rune(p)); n > textPageSize+10 {
			t.Fatalf("page %d too long: %d runes", i+1, n)
		}
	}
	if joined := strings.Join(pages, "\n"); joined != text {
		t.Fatalf("pages do not preserve the text exactly")
	}
	long := strings.Repeat("слово ", 800)
	lpages := splitTextPages(long)
	if len(lpages) < 3 {
		t.Fatalf("long paragraph: %d pages", len(lpages))
	}
	for _, p := range lpages {
		if n := len([]rune(p)); n > textPageSize {
			t.Fatalf("long page too long: %d runes", n)
		}
	}
}

func TestParseFB2(t *testing.T) {
	raw := `<?xml version="1.0" encoding="UTF-8"?>
<FictionBook>
 <description-section>
  <title-info>
   <book-title>Тестовый роман</book-title>
   <author><first-name>Иван</first-name><last-name>Петров</last-name></author>
  </title-info>
 </description-section>
 <body>
  <section>
   <title><p>Глава 1</p></title>
   <p>Первый абзац с текстом.</p>
   <p>Второй абзац.</p>
  </section>
  <section>
   <p>Третий абзац во второй главе.</p>
  </section>
 </body>
</FictionBook>`
	meta, text, e := parseFB2([]byte(raw))
	if e != nil {
		t.Fatal(e)
	}
	if meta.Title != "Тестовый роман" || meta.Author != "Петров Иван" {
		t.Fatalf("meta: %+v", meta)
	}
	for _, want := range []string{"Глава 1", "Первый абзац с текстом.", "Второй абзац.", "Третий абзац во второй главе."} {
		if !strings.Contains(text, want) {
			t.Fatalf("text missing %q:\n%s", want, text)
		}
	}
}

func TestParseEpub(t *testing.T) {
	files := map[string]string{
		"mimetype":               "application/epub+zip",
		"META-INF/container.xml": `<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`,
		"OEBPS/content.opf":      `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" xmlns:dc="http://purl.org/dc/elements/1.1/" version="2.0"><metadata><dc:title>Книга для Epub</dc:title><dc:creator>Автор Эпуб</dc:creator></metadata><manifest><item id="ch1" href="ch1.xhtml" media-type="application/xhtml+xml"/><item id="ch2" href="ch2.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="ch2"/><itemref idref="ch1"/></spine></package>`,
		"OEBPS/ch1.xhtml":        `<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Глава 1</title></head><body><p>Первая глава начинается здесь.</p><div>Абзац в диве.</div></body></html>`,
		"OEBPS/ch2.xhtml":        `<html xmlns="http://www.w3.org/1999/xhtml"><body><script>var x=1;</script><p>Вторая глава раньше в спайне.</p></body></html>`,
	}
	meta, text, e := parseEpub(makeZipBook(t, files))
	if e != nil {
		t.Fatal(e)
	}
	if meta.Title != "Книга для Epub" || meta.Author != "Автор Эпуб" {
		t.Fatalf("meta: %+v", meta)
	}
	i1 := strings.Index(text, "Вторая глава раньше в спайне.")
	i2 := strings.Index(text, "Первая глава начинается здесь.")
	if i1 < 0 || i2 < 0 || i1 > i2 {
		t.Fatalf("spine order broken:\n%s", text)
	}
	if strings.Contains(text, "var x") {
		t.Fatalf("script leaked into text")
	}
	if !strings.Contains(text, "Абзац в диве.") {
		t.Fatalf("div text missing:\n%s", text)
	}
}

func TestParseDocx(t *testing.T) {
	doc := `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>
<w:p><w:r><w:t>Первый абзац документа.</w:t></w:r></w:p>
<w:p><w:r><w:t>Второй </w:t></w:r><w:r><w:t>абзац из двух прогов.</w:t></w:r></w:p>
</w:body>
</w:document>`
	text, e := parseDocx(makeZipBook(t, map[string]string{"word/document.xml": doc}))
	if e != nil {
		t.Fatal(e)
	}
	if !strings.Contains(text, "Первый абзац документа.") || !strings.Contains(text, "Второй абзац из двух прогов.") {
		t.Fatalf("docx text: %q", text)
	}
}

func TestParseTxt(t *testing.T) {
	p := writeTempBook(t, "utf8.txt", "\ufeffПервая строка.\r\nВторая строка.")
	text, e := parseTxt(p)
	if e != nil {
		t.Fatal(e)
	}
	if text != "Первая строка.\nВторая строка." {
		t.Fatalf("utf8 txt: %q", text)
	}
	cyr, e := charmap.Windows1251.NewEncoder().Bytes([]byte("Привет из кодовки."))
	if e != nil {
		t.Fatal(e)
	}
	p1251 := writeTempBook(t, "win1251.txt", string(cyr))
	text, e = parseTxt(p1251)
	if e != nil {
		t.Fatal(e)
	}
	if text != "Привет из кодовки." {
		t.Fatalf("win1251 txt: %q", text)
	}
}
