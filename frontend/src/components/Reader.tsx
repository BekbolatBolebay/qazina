import { useCallback, useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Document, Page, pdfjs } from "react-pdf";
import {
  ArrowDown,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  RotateCcw,
} from "lucide-react";
import { api } from "../api";
import type { Book } from "../types";
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();
const options = { isEvalSupported: false, useWasm: false };
function savedPage(id: number) {
  try {
    return Math.max(
      1,
      Number(localStorage.getItem(`mood.reader.v1.${id}`)) || 1,
    );
  } catch {
    return 1;
  }
}
export default function Reader({
  book,
  onClose,
  startPage,
}: {
  book: Book;
  onClose: () => void;
  startPage?: number;
}) {
  const [page, setPage] = useState(() =>
    startPage && startPage > 0 ? startPage : savedPage(book.id),
  );
  const [pages, setPages] = useState(0);
  const [width, setWidth] = useState(() =>
    Math.min(820, Math.max(240, window.innerWidth - 48)),
  );
  const [zoom, setZoom] = useState(1);
  const [draft, setDraft] = useState(String(page));
  const [error, setError] = useState("");
  const isPdf = Boolean(book.file);
  const [text, setText] = useState<{ page: number; text: string } | null>(null);
  const [textBusy, setTextBusy] = useState(false);
  useEffect(() => {
    if (isPdf) return;
    const controller = new AbortController();
    setTextBusy(true);
    setText(null);
    api<{ pages: number; items: { page: number; text: string }[] }>(
      `/books/${book.id}/pages?from=${page}&to=${page}`,
      { signal: controller.signal },
    )
      .then((data) => {
        setPages(data.pages);
        if (page > data.pages) {
          setPage(Math.max(1, data.pages));
          return;
        }
        const item = data.items.find((i) => i.page === page) || data.items[0];
        if (item) setText(item);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => setTextBusy(false));
    return () => controller.abort();
  }, [page, book.id, isPdf]);
  const body = useRef<HTMLDivElement | null>(null);
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const attachBody = useCallback((node: HTMLDivElement | null) => {
    body.current = node;
    setContainer(node);
  }, []);
  useEffect(() => {
    const el = container;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(240, Math.min(820, entry.contentRect.width - 32))),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [container]);
  useEffect(() => {
    setDraft(String(page));
    try {
      localStorage.setItem(`mood.reader.v1.${book.id}`, String(page));
    } catch {}
    body.current?.scrollTo({ top: 0, left: 0 });
  }, [page, book.id]);
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if ((e.target as HTMLElement).matches("input,textarea,select")) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setPage((p) => Math.min(p + 1, pages || p));
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setPage((p) => Math.max(1, p - 1));
      }
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [pages]);
  function jump() {
    const value = Number(draft);
    if (Number.isFinite(value) && pages)
      setPage(Math.max(1, Math.min(pages, Math.trunc(value))));
    else setDraft(String(page));
  }
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="reader-overlay" />
        <Dialog.Content className="reader-shell" aria-describedby={undefined}>
          <header className="reader-header">
            <Dialog.Close
              className="icon-button reader-back"
              aria-label="Закрыть книгу"
            >
              <ArrowLeft size={21} />
            </Dialog.Close>
            <div>
              <Dialog.Title>{book.title}</Dialog.Title>
              <p>{book.author}</p>
            </div>
            {book.file && (
              <a
                className="button outline reader-download"
                href={book.file}
                download
              >
                <ArrowDown size={16} />
                <span>PDF</span>
              </a>
            )}
          </header>
          <div className="reader-body" ref={attachBody}>
            {isPdf ? (
              <Document
              file={`/api/books/${book.id}/read`}
              options={options}
              onLoadSuccess={({ numPages }) => {
                setPages(numPages);
                setPage((p) => Math.min(p, numPages));
                setError("");
              }}
              onLoadError={() =>
                setError("Не удалось открыть PDF. Попробуйте скачать файл.")
              }
              loading={<div className="reader-loading">Открываем книгу…</div>}
              error={
                <div className="reader-loading">
                  {error || "Не удалось открыть PDF"}
                </div>
              }
            >
                <Page
                pageNumber={page}
                width={Math.round(width * zoom)}
                devicePixelRatio={Math.min(window.devicePixelRatio || 1, 2)}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                loading={
                  <div className="reader-loading">Загрузка страницы…</div>
                }
                onRenderError={() => setError("Не удалось показать страницу")}
              />
              </Document>
            ) : (
              <div
                className="text-page"
                style={{ fontSize: `${Math.round(16 * zoom)}px` }}
              >
                {textBusy ? (
                  <div className="reader-loading">Загружаем страницу…</div>
                ) : text ? (
                  text.text
                    .split("\n")
                    .map((line, i) =>
                      line.trim() === "" ? (
                        <div key={i} className="text-gap" />
                      ) : (
                        <p key={i}>{line}</p>
                      ),
                    )
                ) : (
                  <div className="reader-loading">
                    {error || "На этой странице пока нет текста"}
                  </div>
                )}
              </div>
            )}
          </div>
          <footer className="reader-controls">
            <div className="reader-pagination">
              <button
                className="icon-button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || !pages}
                aria-label="Предыдущая страница"
              >
                <ChevronLeft size={21} />
              </button>
              <label>
                <span className="sr-only">Страница книги</span>
                <input
                  aria-label="Страница книги"
                  inputMode="numeric"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={jump}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") jump();
                  }}
                />
                <span>/ {pages || "…"}</span>
              </label>
              <button
                className="icon-button"
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                disabled={!pages || page >= pages}
                aria-label="Следующая страница"
              >
                <ChevronRight size={21} />
              </button>
            </div>
            <div className="reader-zoom">
              <button
                className="icon-button"
                aria-label="Уменьшить"
                onClick={() => setZoom((z) => Math.max(0.6, z - 0.1))}
                disabled={zoom <= 0.6}
              >
                <Minus size={18} />
              </button>
              <button
                className="zoom-reset"
                aria-label="Сбросить масштаб"
                onClick={() => setZoom(1)}
              >
                <RotateCcw size={13} />
                {Math.round(zoom * 100)}%
              </button>
              <button
                className="icon-button"
                aria-label="Увеличить"
                onClick={() => setZoom((z) => Math.min(1.8, z + 0.1))}
                disabled={zoom >= 1.8}
              >
                <Plus size={18} />
              </button>
            </div>
            {book.source_url && (
              <a
                className="reader-source"
                href={book.source_url}
                target="_blank"
                rel="noreferrer"
              >
                Источник
              </a>
            )}
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
