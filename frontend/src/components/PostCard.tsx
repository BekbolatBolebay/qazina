import { useState } from "react";
import {
  Bookmark,
  Heart,
  MessageCircle,
  Send,
  BookOpen,
  ArrowUpRight,
  Check,
} from "lucide-react";
import { api, relativeTime } from "../api";
import type { Book, Post, User } from "../types";
import { Avatar, BookCover } from "./UI";
export function PostCard({
  post: p,
  guard,
  onUpdate,
  onProfile,
  onBook,
  onError,
  onOpen,
}: {
  post: Post;
  guard: (action: () => void) => void;
  onUpdate: (p: Post) => void;
  onProfile: (u: User) => void;
  onBook: (b: Book) => void;
  onError: (s: string) => void;
  onOpen?: (p: Post) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  async function toggle(which: "like" | "save") {
    if (busy) return;
    setBusy(true);
    try {
      const active = which === "like" ? p.liked : p.saved;
      await api(`/posts/${p.id}/${which}`, {
        method: active ? "DELETE" : "PUT",
      });
      onUpdate({
        ...p,
        ...(which === "like"
          ? { liked: !p.liked, likes: p.likes + (p.liked ? -1 : 1) }
          : { saved: !p.saved }),
      });
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function share() {
    try {
      const link = `${location.origin}/?post=${p.id}`;
      if (navigator.share) {
        await navigator.share({ title: `${p.book.title} — Mood`, url: link });
      } else {
        await navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError")
        onError("Не удалось поделиться ссылкой");
    }
  }
  return (
    <article
      className={`post-card ${onOpen ? "post-card-linked" : ""}`}
      onClick={(e) => {
        if (
          onOpen &&
          !(e.target as HTMLElement).closest("button,a,input,textarea,select")
        )
          onOpen(p);
      }}
    >
      <div className="post-top">
        <button
          className="profile-link"
          onClick={() => guard(() => onProfile(p.user))}
        >
          <Avatar user={p.user} />
          <span>
            <strong>{p.user.full_name.split(" ").reverse().join(" ")}</strong>
            <small>
              @{p.user.username}
              {p.user.is_demo && <span className="demo-badge">демо</span>}
            </small>
          </span>
        </button>
        <a
          className="post-permalink"
          href={`/?post=${p.id}`}
          aria-label="Открыть публикацию"
          onClick={(e) => {
            if (e.ctrlKey || e.metaKey || e.shiftKey) return;
            e.preventDefault();
            onOpen?.(p);
          }}
        >
          <time dateTime={p.created_at}>{relativeTime(p.created_at)}</time>
        </a>
      </div>
      {p.kind === "quote" ? (
        <div className="quote-card">
          <button className="quote-book" onClick={() => onBook(p.book)}>
            <BookOpen size={15} />
            {p.book.title}
            <ArrowUpRight size={14} />
          </button>
          <blockquote>{p.quote}</blockquote>
          <span className="quote-source">
            {p.book.author}
            {p.page > 0 && (
              <>
                {" "}
                <i /> стр. {p.page}
              </>
            )}
            {p.lines && (
              <>
                {" "}
                <i /> строки {p.lines}
              </>
            )}
          </span>
        </div>
      ) : (
        <button className="recommendation" onClick={() => onBook(p.book)}>
          <BookCover book={p.book} small />
          <span className="recommendation-copy">
            <span className="eyebrow">Рекомендация</span>
            <strong>{p.book.title}</strong>
            <span>{p.book.author}</span>
          </span>
          <ArrowUpRight className="recommendation-arrow" size={16} />
        </button>
      )}
      <p className="opinion">{p.opinion}</p>
      <div className="post-actions">
        <button
          className={p.liked ? "active like" : "like"}
          disabled={busy}
          onClick={() => guard(() => toggle("like"))}
          aria-label={p.liked ? "Убрать лайк" : "Нравится"}
        >
          <Heart size={20} fill={p.liked ? "currentColor" : "none"} />
          <span>{p.likes || ""}</span>
        </button>
        <button
          onClick={() => {
            if (onOpen) onOpen(p);
            else
              document
                .getElementById("post-comments")
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
          aria-label="Комментарии"
        >
          <MessageCircle size={20} />
          <span>{p.comments || ""}</span>
        </button>
        <button
          onClick={() =>
            guard(() => {
              void share();
            })
          }
          aria-label="Поделиться"
        >
          {copied ? <Check size={20} /> : <Send size={19} />}
        </button>
        <button
          className={`save ${p.saved ? "active" : ""}`}
          disabled={busy}
          onClick={() => guard(() => toggle("save"))}
          aria-label={p.saved ? "Убрать из сохранённого" : "Сохранить"}
        >
          <Bookmark size={19} fill={p.saved ? "currentColor" : "none"} />
        </button>
      </div>
    </article>
  );
}
