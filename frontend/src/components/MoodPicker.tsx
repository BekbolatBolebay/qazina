import { useEffect, useState } from "react";
import { BookOpen, Loader2, Send } from "lucide-react";
import { api, moodStream, type MoodBookEvent } from "../api";
import type { Book, MoodExcerpt } from "../types";
import { BookCover } from "./UI";
type Phase = "idle" | "thinking" | "done" | "error";
type Pick = {
  book: Book;
  why: string;
  excerpt?: MoodExcerpt;
};
// Pick с позицией из потока — книги появляются в ленте по одной.
type StreamPick = Pick & { position: number };

export function MoodPicker({
  onReadBook,
}: {
  onReadBook: (book: Book, page?: number) => void;
}) {
  const [emotion, setEmotion] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [picks, setPicks] = useState<StreamPick[]>([]);
  const [sentEmotion, setSentEmotion] = useState("");
  const [summary, setSummary] = useState("");
  const [error, setError] = useState("");
  const [available, setAvailable] = useState(true);
  useEffect(() => {
    api<{ available: boolean }>("/mood/status")
      .then((s) => setAvailable(s.available))
      .catch(() => setAvailable(false));
  }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = emotion.trim();
    if (!value || phase === "thinking" || !available) return;
    setPhase("thinking");
    setError("");
    setPicks([]);
    setSummary("");
    const controller = new AbortController();
    try {
      await moodStream(
        value,
        {
          onSummary: (d) => {
            setSentEmotion(d.emotion);
            setSummary(d.summary);
          },
          onBook: (d: MoodBookEvent) => {
            setPicks((prev) => {
              const next = [
                ...prev,
                {
                  position: d.position,
                  book: d.book,
                  why: d.why,
                  excerpt: d.excerpt,
                },
              ];
              next.sort((a, b) => a.position - b.position);
              return next;
            });
          },
          onDone: () => setPhase("done"),
          onError: (message) => {
            setError(message);
            setPhase("error");
            controller.abort();
          },
        },
        controller.signal,
      );
      // Поток закрыт без события done — считаем подбор завершённым.
      setPhase((p) => (p === "error" ? p : "done"));
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(
        err instanceof Error ? err.message : "Не удалось подобрать книги",
      );
      setPhase("error");
    }
  }
  return (
    <section className="mood-card" aria-label="Подбор книг по эмоции">
      <form className="mood-form" onSubmit={submit}>
        <input
          value={emotion}
          onChange={(e) => setEmotion(e.target.value)}
          placeholder="Например: «устал после долгой недели, хочу тишины и понимания»"
          aria-label="Эмоция или состояние"
          maxLength={300}
          disabled={phase === "thinking"}
        />
        <button
          className="mood-send"
          type="submit"
          aria-label="Подобрать 3 книги"
          title="Подобрать 3 книги по эмоции"
          disabled={!emotion.trim() || phase === "thinking" || !available}
        >
          {phase === "thinking" ? (
            <Loader2 size={19} className="mood-spin" />
          ) : (
            <Send size={19} strokeWidth={1.8} />
          )}
        </button>
      </form>
      {!available && phase === "idle" && (
        <p className="mood-hint">Подбор временно недоступен. Попробуйте позже.</p>
      )}
      {phase === "thinking" && picks.length === 0 && (
        <p className="mood-hint" role="status">
          Ищем в библиотеке — несколько секунд…
        </p>
      )}
      {phase === "error" && (
        <p className="mood-error" role="alert">
          {error}
        </p>
      )}
      {picks.length > 0 && (
        <div className="mood-result">
          {summary && (
            <p className="mood-summary">
              «{sentEmotion}» — {summary}
            </p>
          )}
          <ol className="mood-books">
            {picks.map((p) => {
              const readable = Boolean(p.book.file || p.book.pages);
              return (
                <li key={p.book.id}>
                  <div className="mood-book-card">
                    <div className="mood-card-head">
                      <span className="mood-rank">{p.position}</span>
                      <BookCover book={p.book} small />
                      <span className="mood-text">
                        <strong>{p.book.title}</strong>
                        <small>
                          {p.book.author}
                          {p.excerpt ? ` · стр. ${p.excerpt.page}` : ""}
                        </small>
                      </span>
                      {readable && (
                        <button
                          className="button primary mood-read-btn"
                          onClick={() => onReadBook(p.book, p.excerpt?.page)}
                        >
                          <BookOpen size={15} />
                          Читать
                        </button>
                      )}
                    </div>
                    {p.excerpt && (
                      <p className="mood-excerpt">
                        «{p.excerpt.text}»
                        <span>стр. {p.excerpt.page}</span>
                      </p>
                    )}
                    <p className="mood-why">{p.why}</p>
                  </div>
                </li>
              );
            })}
          </ol>
          {phase === "thinking" && picks.length < 3 && (
            <p className="mood-hint mood-progress" role="status">
              <Loader2 size={13} className="mood-spin" />
              Подбираем — {picks.length} из 3, остальные уже ищутся…
            </p>
          )}
        </div>
      )}
    </section>
  );
}
