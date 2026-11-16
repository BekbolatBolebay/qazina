import { useEffect, useState } from "react";
import { BookOpen, ImagePlus, Quote, UploadCloud } from "lucide-react";
import { api, uploadBook } from "../api";
import { BOOK_GENRES } from "../catalog";
import type { Book, Post, User } from "../types";
import { Avatar, Modal } from "./UI";
export function Composer({
  user,
  books,
  initialBook,
  onClose,
  onSuccess,
  onAddBook,
}: {
  user: User;
  books: Book[];
  initialBook?: Book;
  onClose: () => void;
  onSuccess: (p: Post) => void;
  onAddBook: (file?: File) => void;
}) {
  const [kind, setKind] = useState<"quote" | "recommendation">("quote");
  const [book, setBook] = useState(initialBook?.id || books[0]?.id || 0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [options, setOptions] = useState(books);
  const [search, setSearch] = useState("");
  const [dragOver, setDragOver] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const t = setTimeout(() => {
      api<Book[]>("/books?q=" + encodeURIComponent(search), {
        signal: controller.signal,
      })
        .then((result) =>
          setOptions(
            initialBook && !result.some((b) => b.id === initialBook.id)
              ? [initialBook, ...result]
              : result,
          ),
        )
        .catch((e) => {
          if (e.name !== "AbortError") setError(e.message);
        });
    }, 250);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [search, initialBook]);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const p = await api<Post>("/posts", {
        method: "POST",
        body: JSON.stringify({
          book_id: book,
          kind,
          quote: data.quote || "",
          opinion: data.opinion,
          page: Number(data.page || 0),
          lines: data.lines || "",
        }),
      });
      onSuccess(p);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open onClose={onClose} title="Новый пост" wide>
      <div className="composer-author">
        <Avatar user={user} />
        <div>
          <strong>{user.full_name}</strong>
        </div>
      </div>
      <div className="segmented">
        <button
          className={kind === "quote" ? "selected" : ""}
          onClick={() => setKind("quote")}
        >
          <Quote size={16} />
          Цитата и мысль
        </button>
        <button
          className={kind === "recommendation" ? "selected" : ""}
          onClick={() => setKind("recommendation")}
        >
          <BookOpen size={16} />
          Рекомендация
        </button>
      </div>
      <form className="form" onSubmit={submit}>
        <label>
          Найти книгу
          <input
            placeholder="Название или автор"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label>
          Книга
          <select
            value={book}
            onChange={(e) => setBook(Number(e.target.value))}
            required
          >
            <option value="">Выберите книгу</option>
            {options.map((b) => (
              <option value={b.id} key={b.id}>
                {b.title} · {b.author}
              </option>
            ))}
          </select>
        </label>
        {kind === "recommendation" && (
          <button
            type="button"
            className={`composer-add-book${dragOver ? " drag-over" : ""}`}
            onClick={() => onAddBook()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) onAddBook(f);
            }}
          >
            <UploadCloud size={20} />
            <span>
              <strong>Добавить книгу файлом</strong>
              <small>
                PDF, EPUB, FB2, TXT или DOCX · до 100 МБ · можно просто
                перетащить файл сюда
              </small>
            </span>
          </button>
        )}
        {kind === "quote" && (
          <>
            <button type="button" className="inline-link" onClick={() => onAddBook()}>
              Добавить книгу
            </button>
            <label>
              Цитата из книги
              <textarea
                className="quote-input"
                name="quote"
                placeholder="Текст цитаты"
                required
                maxLength={3000}
                rows={4}
              />
            </label>
            <div className="form-row">
              <label>
                Страница <span className="optional">необязательно</span>
                <input
                  name="page"
                  type="number"
                  min="0"
                  max="100000"
                  placeholder="Например, 38"
                />
              </label>
              <label>
                Строки <span className="optional">необязательно</span>
                <input
                  name="lines"
                  maxLength={60}
                  placeholder="Например, 4–6"
                />
              </label>
            </div>
            <p className="field-note">
              Укажите страницу своего издания: в разных изданиях нумерация
              отличается.
            </p>
          </>
        )}
        <label>
          {kind === "quote" ? "Ваша мысль" : "Почему стоит прочитать"}
          <textarea
            name="opinion"
            placeholder={
              kind === "quote"
                ? "Ваше мнение"
                : "Почему рекомендуете эту книгу?"
            }
            required
            maxLength={5000}
            rows={4}
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="form-footer">
          <span>Видно всем</span>
          <button className="button primary" disabled={busy || !book}>
            {busy ? "Публикуем…" : "Опубликовать"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function AddBook({
  onClose,
  onSuccess,
  initialFile,
}: {
  onClose: () => void;
  onSuccess: () => void;
  initialFile?: File;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(initialFile ?? null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [coverDrag, setCoverDrag] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  function pickCover(f: File | null) {
    if (f && f.size > 5 << 20) {
      setError("Обложка слишком большая. Максимум — 5 МБ");
      return;
    }
    setError("");
    setCoverFile(f);
    setCoverPreview(f ? URL.createObjectURL(f) : "");
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setProgress(file ? 0 : null);
    const fd = new FormData(e.currentTarget);
    if (file) {
      fd.set("file", file, file.name);
    } else {
      fd.delete("file");
    }
    if (coverFile) {
      fd.set("cover", coverFile, coverFile.name);
    } else {
      fd.delete("cover");
    }
    try {
      await uploadBook(fd, (loaded, total) =>
        setProgress(Math.min(99, Math.round((loaded / total) * 100))),
      );
      onSuccess();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }
  return (
    <Modal open onClose={onClose} title="Добавить книгу">
      <form className="form" onSubmit={submit}>
        <label>
          Название
          <input
            name="title"
            required
            maxLength={200}
            placeholder="Слова назидания"
          />
        </label>
        <label>
          Автор
          <input
            name="author"
            required
            minLength={2}
            maxLength={150}
            placeholder="Абай Кунанбаев"
          />
        </label>
        <label>
          Жанр
          <select name="genre" defaultValue="Классика">
            {BOOK_GENRES.map((genre) => (
              <option key={genre} value={genre}>
                {genre}
              </option>
            ))}
          </select>
        </label>
        <label>
          О книге <span className="optional">необязательно</span>
          <textarea
            name="description"
            maxLength={3000}
            rows={3}
            placeholder="О чём эта книга?"
          />
        </label>
        <label
          className={`file-upload${dragOver ? " drag-over" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) setFile(f);
          }}
        >
          <UploadCloud size={27} />
          <strong>
            {file?.name ||
              "Выберите файл книги: PDF, EPUB, FB2, TXT или DOCX"}
          </strong>
          <span>
            До 100 МБ · перетащите файл сюда или нажмите · можно добавить
            только карточку книги
          </span>
          <input
            name="file"
            type="file"
            accept=".pdf,.epub,.fb2,.txt,.docx"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <div className="cover-row">
          <label
            className={`file-upload cover-upload${coverDrag ? " drag-over" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setCoverDrag(true);
            }}
            onDragLeave={() => setCoverDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setCoverDrag(false);
              const f = e.dataTransfer.files?.[0];
              if (f) pickCover(f);
            }}
          >
            {coverPreview ? (
              <img className="cover-preview" src={coverPreview} alt="" />
            ) : (
              <ImagePlus size={27} />
            )}
            <strong>{coverFile?.name || "Обложка — по желанию"}</strong>
            <span>
              JPG, PNG или WebP · до 5 МБ · перетащите фото обложки сюда или
              нажмите
            </span>
            <input
              name="cover"
              type="file"
              accept=".jpg,.jpeg,.png,.webp"
              onChange={(e) => pickCover(e.target.files?.[0] ?? null)}
            />
          </label>
          {coverFile && (
            <button type="button" className="cover-remove" onClick={() => pickCover(null)}>
              Убрать обложку
            </button>
          )}
        </div>
        {busy && progress !== null && (
          <div
            className="upload-progress"
            role="progressbar"
            aria-label="Загрузка книги"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="upload-progress-bar" style={{ width: `${progress}%` }} />
          </div>
        )}
        <p className="field-note">
          Загружайте только книги, которыми имеете право делиться.
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="button primary full" disabled={busy}>
          {busy
            ? progress !== null
              ? progress < 100
                ? `Загружаем… ${progress}%`
                : "Обрабатываем книгу…"
              : "Добавляем…"
            : "Добавить в библиотеку"}
        </button>
      </form>
    </Modal>
  );
}
