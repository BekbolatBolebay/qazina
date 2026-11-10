import { Bookmark, Heart } from "lucide-react";
import type { Book } from "../types";
import { BookCover } from "./UI";
export function BookTile({
  book,
  onOpen,
  onSave,
  busy,
}: {
  book: Book;
  onOpen: (book: Book) => void;
  onSave: (book: Book) => void;
  busy: boolean;
}) {
  return (
    <article className="library-book">
      <button className="library-book-open" onClick={() => onOpen(book)}>
        <BookCover book={book} />
        <strong>{book.title}</strong>
        <span>{book.author}</span>
        <span className="book-meta">
          {book.topic}
          {book.language === "en" ? " · English" : book.language === "kk" ? " · Қазақша" : ""}
          {book.pages ? ` · ${book.pages} стр.` : ""}
          {book.file ? "" : " · без файла"}
        </span>
      </button>
      <div className="library-book-footer">
        <span>
          <Heart size={13} />
          {book.likes}
        </span>
        <button
          className={`book-save-button ${book.saved ? "active" : ""}`}
          aria-label={
            book.saved ? "Убрать книгу из сохранённого" : "Сохранить книгу"
          }
          aria-pressed={book.saved}
          title={
            book.saved ? "Убрать книгу из сохранённого" : "Сохранить книгу"
          }
          disabled={busy}
          onClick={() => onSave(book)}
        >
          <Bookmark size={18} fill={book.saved ? "currentColor" : "none"} />
        </button>
      </div>
    </article>
  );
}
