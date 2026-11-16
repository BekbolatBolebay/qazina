import { useEffect, useState } from "react";
import { Send } from "lucide-react";
import { api, relativeTime } from "../api";
import type { Comment, User } from "../types";
import { Avatar } from "./UI";
export function Comments({
  postId,
  count,
  user,
  onAdded,
  onSignIn,
}: {
  postId: number;
  count: number;
  user: User | null;
  onAdded: () => void;
  onSignIn: () => void;
}) {
  const [items, setItems] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    api<Comment[]>(`/posts/${postId}/comments`, { signal: controller.signal })
      .then((first) => {
        setItems(first);
        setCursor(first.at(-1)?.id || 0);
        setMore(first.length === 50);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [postId, retry]);
  async function next() {
    if (loadingMore) return;
    setLoadingMore(true);
    setError("");
    try {
      const incoming = await api<Comment[]>(
        `/posts/${postId}/comments?after=${cursor}`,
      );
      setItems((previous) => {
        const merged = new Map(previous.map((c) => [c.id, c]));
        for (const c of incoming) merged.set(c.id, c);
        return [...merged.values()].sort((a, b) => a.id - b.id);
      });
      setCursor(incoming.at(-1)?.id || cursor);
      setMore(incoming.length === 50);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingMore(false);
    }
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) {
      onSignIn();
      return;
    }
    const form = e.currentTarget;
    const body = new FormData(form).get("body");
    setSending(true);
    setError("");
    try {
      const comment = await api<Comment>(`/posts/${postId}/comments`, {
        method: "POST",
        body: JSON.stringify({ body }),
      });
      setItems((previous) => [...previous, comment]);
      onAdded();
      form.reset();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  }
  return (
    <section
      id="post-comments"
      className="thread-comments"
      aria-labelledby="comments-heading"
    >
      <div className="comments-heading">
        <h2 id="comments-heading">Комментарии</h2>
        <span>{count}</span>
      </div>
      {loading ? (
        <p className="muted">Загрузка комментариев…</p>
      ) : (
        <div className="comments-list">
          {!items.length && !error && (
            <p className="muted">Пока нет комментариев.</p>
          )}
          {items.map((c) => (
            <article className="comment" key={c.id}>
              <Avatar user={c.user} size="small" />
              <div>
                <strong>
                  {c.user.full_name.split(" ").reverse().join(" ")}
                </strong>
                {c.user.is_demo && <span className="demo-badge">демо</span>}
                <time dateTime={c.created_at}>
                  {relativeTime(c.created_at)}
                </time>
                <p>{c.body}</p>
              </div>
            </article>
          ))}
          {more && (
            <button
              className="inline-link"
              disabled={loadingMore}
              onClick={() => void next()}
            >
              {loadingMore ? "Загрузка…" : "Ещё комментарии"}
            </button>
          )}
        </div>
      )}
      {error && (
        <div className="comment-error" role="alert">
          <p>{error}</p>
          <button
            className="inline-link"
            onClick={() => setRetry((r) => r + 1)}
          >
            Повторить
          </button>
        </div>
      )}
      {user ? (
        <form className="comment-form" onSubmit={submit}>
          <Avatar user={user} size="small" />
          <input
            name="body"
            aria-label="Ваш комментарий"
            placeholder="Написать комментарий…"
            required
            maxLength={2000}
          />
          <button
            className="button primary"
            aria-label="Отправить комментарий"
            disabled={sending || loading}
          >
            <Send size={18} />
          </button>
        </form>
      ) : (
        <button className="button outline comment-signin" onClick={onSignIn}>
          Войти, чтобы ответить
        </button>
      )}
    </section>
  );
}
