import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  Bookmark,
  Check,
  Feather,
  Heart,
  Home,
  LogIn,
  LogOut,
  Plus,
  Search,
  UserRound,
  X,
} from "lucide-react";
import { api, ApiError } from "./api";
import type { Book, Post, Profile, User } from "./types";
import { Avatar, BookCover, Empty, Mark, Modal } from "./components/UI";
import { Auth } from "./components/Auth";
import { AddBook, Composer } from "./components/Composer";
import { PostCard } from "./components/PostCard";
import { Comments } from "./components/Comments";
import { BookTile } from "./components/BookTile";
import { MoodPicker } from "./components/MoodPicker";
const Reader = lazy(() => import("./components/Reader"));
type View = "feed" | "library" | "saved" | "profile" | "search";
export default function App() {
  const [readingBook, setReadingBook] = useState<Book | null>(null);
  const [readingStart, setReadingStart] = useState<number | undefined>();
  const [readers, setReaders] = useState<User[]>([]);
  const [topic, setTopic] = useState("");
  const [genre, setGenre] = useState("");
  const [genres, setGenres] = useState<string[]>([]);
  const catalogueVersion = useRef(0);
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [auth, setAuth] = useState<"login" | "register" | null>(null);
  const [view, setView] = useState<View>("feed");
  const [tab, setTab] = useState<"all" | "following">("all");
  const [posts, setPosts] = useState<Post[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [compose, setCompose] = useState(false);
  const [composeBook, setComposeBook] = useState<Book>();
  const [addBook, setAddBook] = useState(false);
  const [addBookFile, setAddBookFile] = useState<File | null>(null);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [more, setMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [profileBusy, setProfileBusy] = useState(false);
  const [bookBusy, setBookBusy] = useState(false);
  const [sharedPost, setSharedPost] = useState<number | null>(
    () => Number(new URLSearchParams(location.search).get("post")) || null,
  );
  const [reload, setReload] = useState(0);
  const [library, setLibrary] = useState<Book[]>([]);
  const [savedTab, setSavedTab] = useState<"posts" | "books">("posts");
  const [savingBooks, setSavingBooks] = useState<Set<number>>(new Set());
  const savingBooksRef = useRef(new Set<number>());
  const showBookCollection =
    view === "library" || (view === "saved" && savedTab === "books");
  const returnTo = useRef<{ view: View; scroll: number } | null>(null);
  const restoreScroll = useRef<number | null>(null);
  useEffect(() => {
    function pop() {
      const id =
        Number(new URLSearchParams(location.search).get("post")) || null;
      setSharedPost(id);
      setView(id ? "feed" : returnTo.current?.view || "feed");
      if (!id) restoreScroll.current = returnTo.current?.scroll || 0;
    }
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);
  function openPost(p: Post) {
    if (sharedPost === p.id) return;
    returnTo.current = { view, scroll: window.scrollY };
    history.pushState({ moodPost: true }, "", `/?post=${p.id}`);
    setPosts([p]);
    setSharedPost(p.id);
    setView("feed");
    window.scrollTo({ top: 0 });
  }
  function backFromPost() {
    if (history.state?.moodPost) {
      history.back();
      return;
    }
    navigate("feed");
  }
  function clearPostURL() {
    if (new URLSearchParams(location.search).has("post"))
      history.replaceState(null, "", "/");
  }

  useEffect(() => {
    api<User | null>("/me")
      .then(setUser)
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);
  useEffect(() => {
    api<User[]>("/readers")
      .then(setReaders)
      .catch(() => {});
  }, []);
  useEffect(() => {
    Promise.all([api<Book[]>("/books"), api<string[]>("/books/genres")])
      .then(([catalogue, values]) => {
        setBooks(catalogue);
        setGenres(values);
      })
      .catch((e) => setError(e.message));
  }, [reload, user]);
  const guard = useCallback(
    (action: () => void) => {
      if (!user) {
        setAuth("register");
        return;
      }
      action();
    },
    [user],
  );
  function notify(message: string) {
    setToast(message);
  }
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(t);
  }, [toast]);
  const feedPath = useCallback(
    (before?: number) => {
      const q = new URLSearchParams();
      if (before) q.set("before", String(before));
      if (view === "feed" && topic) q.set("topic", topic);
      if (view === "saved") q.set("feed", "saved");
      else if (view === "feed" && tab === "following")
        q.set("feed", "following");
      if (view === "profile" && profile) q.set("user", String(profile.user.id));
      if (view === "search") q.set("q", search);
      return "/posts?" + q;
    },
    [view, tab, profile, search, topic],
  );
  const libraryPath = useCallback(
    (before?: number) => {
      const params = new URLSearchParams();
      if (view === "saved" && savedTab === "books") params.set("feed", "saved");
      else {
        params.set("q", search);
        if (genre) params.set("genre", genre);
      }
      if (before) params.set("before", String(before));
      return "/books?" + params;
    },
    [search, genre, view, savedTab],
  );
  useEffect(() => {
    if (!ready) return;
    catalogueVersion.current++;
    const ctrl = new AbortController();
    if (!sharedPost || !posts.some((p) => p.id === sharedPost))
      setLoading(true);
    setError("");
    if (view === "profile" && !profile) {
      setLoading(false);
      return;
    }
    const request = showBookCollection
      ? api<Book[]>(libraryPath(), {
          signal: ctrl.signal,
        })
      : sharedPost
        ? api<Post>(`/posts/${sharedPost}`, { signal: ctrl.signal }).then(
            (p) => [p],
          )
        : api<Post[]>(feedPath(), { signal: ctrl.signal });
    request
      .then((result) => {
        if (showBookCollection) {
          setLibrary(result as Book[]);
          setMore(result.length === 30);
        } else {
          setPosts(result as Post[]);
          setMore(!sharedPost && result.length === 20);
        }
      })
      .catch((e) => {
        if (e.name !== "AbortError") {
          setError(e.message);
          if (e instanceof ApiError && e.status === 401) setAuth("login");
        }
      })
      .finally(() => {
        if (!ctrl.signal.aborted) {
          setLoading(false);
          if (!sharedPost && restoreScroll.current !== null) {
            const position = restoreScroll.current;
            restoreScroll.current = null;
            requestAnimationFrame(() => window.scrollTo({ top: position }));
          }
        }
      });
    return () => ctrl.abort();
  }, [ready, feedPath, view, search, reload, sharedPost, libraryPath]);
  function navigate(next: View) {
    if ((next === "saved" || next === "profile") && !user) {
      setAuth("register");
      return;
    }
    clearPostURL();
    if (next === "saved" || next === "profile") {
      guard(() => {
        if (next === "profile" && user) void openProfile(user);
        else {
          if (view !== next || sharedPost) setLoading(true);
          setView(next);
          setSharedPost(null);
        }
      });
      return;
    }
    setView(next);
    setSharedPost(null);
    setSearch("");
    setQuery("");
    if (location.search) history.replaceState(null, "", "/");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function openProfile(u: User) {
    try {
      setProfile(await api<Profile>(`/users/${u.username}`));
      clearPostURL();
      setView("profile");
      setSharedPost(null);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      notify((e as Error).message);
    }
  }
  function update(p: Post) {
    setPosts((prev) => prev.map((old) => (old.id === p.id ? p : old)));
  }
  async function loadMore() {
    setLoadingMore(true);
    try {
      if (showBookCollection) {
        const version = catalogueVersion.current;
        const result = await api<Book[]>(libraryPath(library.at(-1)?.id));
        if (version !== catalogueVersion.current) return;
        setLibrary((prev) => [...prev, ...result]);
        setMore(result.length === 30);
      } else {
        const result = await api<Post[]>(feedPath(posts.at(-1)?.id));
        setPosts((prev) => [...prev, ...result]);
        setMore(result.length === 20);
      }
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setLoadingMore(false);
    }
  }
  async function logout() {
    try {
      await api("/auth/logout", { method: "POST" });
      setUser(null);
      setLibrary([]);
      setView("feed");
      setTab("all");
      setReload((v) => v + 1);
      notify("Вы вышли из аккаунта");
    } catch (e) {
      notify((e as Error).message);
    }
  }
  async function follow() {
    if (!profile || profileBusy) return;
    setProfileBusy(true);
    try {
      await api(`/users/${profile.user.id}/follow`, {
        method: profile.followed ? "DELETE" : "PUT",
      });
      setProfile({
        ...profile,
        followed: !profile.followed,
        followers: profile.followers + (profile.followed ? -1 : 1),
      });
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setProfileBusy(false);
    }
  }
  async function likeBook() {
    if (!selectedBook || bookBusy) return;
    setBookBusy(true);
    try {
      await api(`/books/${selectedBook.id}/like`, {
        method: selectedBook.liked ? "DELETE" : "PUT",
      });
      patchBook(selectedBook.id, {
        liked: !selectedBook.liked,
        likes: selectedBook.likes + (selectedBook.liked ? -1 : 1),
      });
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBookBusy(false);
    }
  }
  function patchBook(id: number, changes: Partial<Book>) {
    setBooks((previous) =>
      previous.map((b) => (b.id === id ? { ...b, ...changes } : b)),
    );
    setLibrary((previous) =>
      previous.map((b) => (b.id === id ? { ...b, ...changes } : b)),
    );
    setSelectedBook((previous) =>
      previous?.id === id ? { ...previous, ...changes } : previous,
    );
  }
  async function saveBook(book: Book) {
    if (savingBooksRef.current.has(book.id)) return;
    savingBooksRef.current.add(book.id);
    setSavingBooks(new Set(savingBooksRef.current));
    try {
      const saved = !book.saved;
      await api(`/books/${book.id}/save`, { method: saved ? "PUT" : "DELETE" });
      patchBook(book.id, { saved });
      if (view === "saved" && savedTab === "books")
        setLibrary((previous) =>
          saved
            ? previous.some((b) => b.id === book.id)
              ? previous
              : [{ ...book, saved }, ...previous].sort((a, b) => b.id - a.id)
            : previous.filter((b) => b.id !== book.id),
        );
      notify(saved ? "Книга сохранена" : "Книга удалена из сохранённого");
    } catch (e) {
      notify((e as Error).message);
    } finally {
      savingBooksRef.current.delete(book.id);
      setSavingBooks(new Set(savingBooksRef.current));
    }
  }
  function startPost(book?: Book) {
    guard(() => {
      setComposeBook(book);
      setCompose(true);
    });
  }
  function doSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(query.trim());
    if (view !== "library") setView("search");
    setSharedPost(null);
  }
  const nav = [
    { id: "feed" as View, label: "Лента", icon: Home },
    { id: "library" as View, label: "Библиотека", icon: BookOpen },
    { id: "saved" as View, label: "Сохранённое", icon: Bookmark },
    { id: "profile" as View, label: "Мой профиль", icon: UserRound },
  ];
  return (
    <>
      <div className="app-layout">
        <aside className="left-sidebar">
          <a
            className="brand"
            href="/"
            onClick={(e) => {
              e.preventDefault();
              navigate("feed");
            }}
          >
            <Mark />
            <span>Mood</span>
          </a>
          <nav className="desktop-nav" aria-label="Главная навигация">
            {nav.map((item) => (
              <button
                key={item.id}
                className={view === item.id ? "nav-item selected" : "nav-item"}
                onClick={() => navigate(item.id)}
              >
                <item.icon
                  size={21}
                  strokeWidth={view === item.id ? 2 : 1.65}
                />
                <span>{item.label}</span>
                {view === item.id && <span className="nav-dot" />}
              </button>
            ))}
          </nav>
          <button
            className="button primary write-button"
            onClick={() => startPost()}
          >
            <Feather size={19} />
            Создать пост
          </button>
          <div className="left-bottom">
            {user ? (
              <>
                <button
                  className="account"
                  onClick={() => void openProfile(user)}
                >
                  <Avatar user={user} size="small" />
                  <span>
                    <strong>
                      {user.full_name.split(" ").reverse().join(" ")}
                    </strong>
                    <small>@{user.username}</small>
                  </span>
                </button>
                <button className="logout" onClick={logout}>
                  <LogOut size={15} />
                  Выйти
                </button>
              </>
            ) : (
              <>
                <button
                  className="button outline full"
                  onClick={() => setAuth("login")}
                >
                  <LogIn size={17} />
                  Войти
                </button>
                <button
                  className="register-link"
                  onClick={() => setAuth("register")}
                >
                  Регистрация
                </button>
              </>
            )}
            <span className="copyright">
              © {new Date().getFullYear()} Mood
            </span>
          </div>
        </aside>
        <main className="main-panel">
          <header className="topbar">
            <span className="page-title">
              {sharedPost
                ? "Публикация"
                : {
                    feed: "Лента",
                    library: "Библиотека",
                    saved: "Сохранённое",
                    profile: "Профиль",
                    search: "Поиск",
                  }[view]}
            </span>
            <a
              className="mobile-brand"
              href="/"
              onClick={(e) => {
                e.preventDefault();
                navigate("feed");
              }}
            >
              <Mark />
              <span>Mood</span>
            </a>
            <form className="search-box" onSubmit={doSearch}>
              <Search size={18} />
              <input
                aria-label="Поиск книг и мыслей"
                placeholder="Поиск"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </form>
            <button
              className="mobile-search icon-button"
              aria-label="Поиск"
              onClick={() => navigate("search")}
            >
              <Search size={22} />
            </button>
          </header>
          {view === "feed" && !sharedPost && (
            <MoodPicker
              onReadBook={(book, page) => {
                setReadingStart(page ?? undefined);
                setReadingBook(book);
              }}
            />
          )}
          {view === "feed" && !sharedPost && (
            <>
              <div className="feed-tabs">
                <button
                  className={tab === "all" ? "selected" : ""}
                  onClick={() => setTab("all")}
                >
                  Для вас
                </button>
                <button
                  className={tab === "following" ? "selected" : ""}
                  onClick={() => guard(() => setTab("following"))}
                >
                  Вы читаете
                </button>
              </div>
              <div className="topic-tabs" aria-label="Темы книг">
                {[
                  "Все",
                  "Классика",
                  "Философия",
                  "Отношения",
                  "Наука",
                  "Стратегия",
                  "Биографии",
                  "Общество",
                ].map((label) => (
                  <button
                    key={label}
                    className={(topic || "Все") === label ? "selected" : ""}
                    onClick={() => setTopic(label === "Все" ? "" : label)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="quick-compose">
                <span className="compose-avatar">
                  {user ? <Avatar user={user} /> : <Feather size={19} />}
                </span>
                <button onClick={() => startPost()}>
                  Поделиться цитатой или книгой…
                </button>
                <button
                  className="compose-plus"
                  onClick={() => startPost()}
                  aria-label="Создать публикацию"
                >
                  <Plus size={21} />
                </button>
              </div>
            </>
          )}
          {sharedPost && (
            <div className="section-header">
              <button className="back-button" onClick={backFromPost}>
                <ArrowLeft size={19} />
                Назад
              </button>
            </div>
          )}
          {view === "saved" && (
            <div
              className="feed-tabs saved-tabs"
              aria-label="Раздел сохранённого"
            >
              <button
                className={savedTab === "posts" ? "selected" : ""}
                aria-pressed={savedTab === "posts"}
                onClick={() => {
                  if (savedTab !== "posts") {
                    setLoading(true);
                    setSavedTab("posts");
                  }
                }}
              >
                Публикации
              </button>
              <button
                className={savedTab === "books" ? "selected" : ""}
                aria-pressed={savedTab === "books"}
                onClick={() => {
                  if (savedTab !== "books") {
                    setLoading(true);
                    setSavedTab("books");
                  }
                }}
              >
                Книги
              </button>
            </div>
          )}
          {view === "library" && (
            <div className="library-toolbar">
              <form className="library-search" onSubmit={doSearch}>
                <Search size={18} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Название или автор"
                  aria-label="Поиск в библиотеке"
                />
                <button
                  className="icon-button"
                  type="submit"
                  aria-label="Найти"
                >
                  <ArrowUpRight size={18} />
                </button>
              </form>
              <label className="library-genre">
                <span>Жанр</span>
                <select
                  aria-label="Жанр книги"
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                >
                  <option value="">Все жанры</option>
                  {genres.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="button primary"
                onClick={() => guard(() => setAddBook(true))}
              >
                <Plus size={17} />
                Добавить книгу
              </button>
            </div>
          )}
          {view === "search" && (
            <section className="section-header search-header">
              <form className="library-search" onSubmit={doSearch}>
                <Search size={19} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Книга, автор или цитата"
                  aria-label="Поисковый запрос"
                />
                <button className="button primary" type="submit">
                  Найти
                </button>
              </form>
              {search && <p>Результаты по запросу «{search}»</p>}
            </section>
          )}
          {view === "profile" && profile && (
            <section className="profile-header">
              <button className="back-button" onClick={() => navigate("feed")}>
                <ArrowLeft size={18} />В ленту
              </button>
              <div className="profile-summary">
                <Avatar user={profile.user} size="large" />
                <div>
                  <h1>
                    {profile.user.full_name.split(" ").reverse().join(" ")}
                  </h1>
                  <span>
                    @{profile.user.username}
                    {profile.user.is_demo && (
                      <span className="demo-badge">демо</span>
                    )}
                  </span>
                </div>
              </div>
              {profile.user.bio && <p>{profile.user.bio}</p>}
              <div className="profile-stats">
                <span>
                  <strong>{profile.posts}</strong> публикаций
                </span>
                <span>
                  <strong>{profile.followers}</strong> читателей
                </span>
                <span>
                  <strong>{profile.following}</strong> читает
                </span>
              </div>
              {profile.user.id !== user?.id && (
                <button
                  className={`button ${profile.followed ? "outline" : "primary"}`}
                  disabled={profileBusy}
                  onClick={() =>
                    guard(() => {
                      void follow();
                    })
                  }
                >
                  {profile.followed ? (
                    <>
                      <Check size={16} />
                      Вы читаете
                    </>
                  ) : (
                    <>
                      <Plus size={16} />
                      Читать
                    </>
                  )}
                </button>
              )}
            </section>
          )}
          {error ? (
            <div className="error-state" role="alert">
              <p>{error}</p>
              <button
                className="button outline"
                onClick={() => setReload((v) => v + 1)}
              >
                Попробовать ещё раз
              </button>
            </div>
          ) : loading ? (
            <div className="loading" aria-label="Загрузка">
              <div className="skeleton" />
              <div className="skeleton" />
              <div className="skeleton" />
            </div>
          ) : showBookCollection ? (
            <div className="library-grid">
              {library.length === 0 ? (
                <Empty
                  title={
                    view === "saved"
                      ? "Нет сохранённых книг"
                      : "Пока ничего не найдено"
                  }
                >
                  {view === "saved"
                    ? "Нажмите на закладку рядом с книгой в библиотеке."
                    : "Измените поиск или жанр."}
                </Empty>
              ) : (
                library.map((b) => (
                  <BookTile
                    key={b.id}
                    book={b}
                    onOpen={setSelectedBook}
                    onSave={(book) =>
                      guard(() => {
                        void saveBook(book);
                      })
                    }
                    busy={savingBooks.has(b.id)}
                  />
                ))
              )}
            </div>
          ) : (
            <div
              className={
                sharedPost ? "feed-posts" : "feed-posts feed-separated"
              }
            >
              {posts.length === 0 ? (
                <Empty
                  title={
                    view === "saved"
                      ? "Нет сохранённых постов"
                      : tab === "following"
                        ? "Пока нет публикаций"
                        : "Публикаций пока нет"
                  }
                >
                  {view === "saved"
                    ? "Нажмите на закладку под публикацией."
                    : tab === "following"
                      ? "Откройте профиль читателя в общей ленте и нажмите «Читать»."
                      : "Поделитесь цитатой или расскажите о любимой книге."}
                </Empty>
              ) : (
                (sharedPost
                  ? posts.filter((p) => p.id === sharedPost)
                  : posts
                ).map((p) => (
                  <div
                    key={p.id}
                    className={sharedPost ? "post-thread" : "feed-item"}
                  >
                    <PostCard
                      post={p}
                      guard={guard}
                      onOpen={sharedPost ? undefined : openPost}
                      onUpdate={update}
                      onProfile={(u) => void openProfile(u)}
                      onBook={(b) => {
                        void api<Book>(`/books/${b.id}`)
                          .then(setSelectedBook)
                          .catch((e) => notify(e.message));
                      }}
                      onError={notify}
                    />
                    {sharedPost && (
                      <Comments
                        postId={p.id}
                        count={p.comments}
                        user={user}
                        onAdded={() =>
                          update({ ...p, comments: p.comments + 1 })
                        }
                        onSignIn={() => setAuth("login")}
                      />
                    )}
                  </div>
                ))
              )}
            </div>
          )}
          {!error && !loading && more && (
            <button
              className="load-more"
              disabled={loadingMore}
              onClick={() => void loadMore()}
            >
              {loadingMore ? "Загружаем…" : "Читать дальше"}
              <ArrowDown size={17} />
            </button>
          )}
          {!loading &&
            posts.length > 0 &&
            view === "feed" &&
            !more &&
            !sharedPost && (
              <div className="feed-end">
                <Check size={16} />
                <span>Вы всё прочитали</span>
              </div>
            )}
        </main>
        <aside className="discovery-sidebar">
          <section>
            <div className="discovery-heading">
              <h2>Книги</h2>
              <button
                onClick={() => navigate("library")}
                aria-label="Вся библиотека"
              >
                <ArrowUpRight size={18} />
              </button>
            </div>
            {["Классика", "Наука", "Философия", "Отношения"]
              .map((topic) => books.find((b) => b.file && b.topic === topic))
              .filter((b): b is Book => !!b)
              .map((b) => (
                <button
                  key={b.id}
                  className="discovery-book"
                  onClick={() => setSelectedBook(b)}
                >
                  <BookCover book={b} small />
                  <span>
                    <strong>{b.title}</strong>
                    <small>{b.author}</small>
                    <small>
                      {b.topic}
                      {b.language === "en" ? " · English" : b.language === "kk" ? " · Қазақша" : ""}
                    </small>
                  </span>
                </button>
              ))}
          </section>
          <section>
            <div className="discovery-heading">
              <h2>Читатели</h2>
              <UserRound size={17} />
            </div>
            {readers.slice(0, 5).map((r) => (
              <button
                key={r.id}
                className="discovery-reader"
                onClick={() =>
                  guard(() => {
                    void openProfile(r);
                  })
                }
              >
                <Avatar user={r} />
                <span>
                  <strong>{r.full_name.split(" ").reverse().join(" ")}</strong>
                  <small>@{r.username}</small>
                </span>
                {r.is_demo && <span className="demo-badge">демо</span>}
              </button>
            ))}
          </section>
        </aside>
      </div>
      <nav className="mobile-nav" aria-label="Мобильная навигация">
        <button
          onClick={() => navigate("feed")}
          aria-label="Лента"
          className={view === "feed" ? "selected" : ""}
        >
          <Home size={22} />
        </button>
        <button
          onClick={() => navigate("library")}
          aria-label="Библиотека"
          className={view === "library" ? "selected" : ""}
        >
          <BookOpen size={22} />
        </button>
        <button
          className="mobile-create"
          onClick={() => startPost()}
          aria-label="Создать пост"
        >
          <Plus size={23} />
        </button>
        <button
          onClick={() => navigate("saved")}
          aria-label="Сохранённое"
          className={view === "saved" ? "selected" : ""}
        >
          <Bookmark size={22} />
        </button>
        <button
          onClick={() => navigate("profile")}
          aria-label="Мой профиль"
          className={view === "profile" ? "selected" : ""}
        >
          {user ? <Avatar user={user} size="small" /> : <UserRound size={22} />}
        </button>
      </nav>
      {auth && (
        <Auth
          mode={auth}
          onMode={setAuth}
          onClose={() => setAuth(null)}
          onSuccess={(u) => {
            setUser(u);
            setAuth(null);
            setReload((v) => v + 1);
            notify("Добро пожаловать в Mood!");
          }}
        />
      )}
      {compose && user && (
        <Composer
          user={user}
          books={books}
          initialBook={composeBook}
          onClose={() => setCompose(false)}
          onAddBook={(file) => {
            setCompose(false);
            setAddBookFile(file ?? null);
            setAddBook(true);
          }}
          onSuccess={() => {
            setCompose(false);
            navigate("feed");
            setTab("all");
            setTopic("");
            setReload((v) => v + 1);
            notify("Ваша мысль опубликована");
          }}
        />
      )}
      {addBook && (
        <AddBook
          initialFile={addBookFile ?? undefined}
          onClose={() => {
            setAddBook(false);
            setAddBookFile(null);
          }}
          onSuccess={() => {
            setAddBook(false);
            setGenre("");
            navigate("library");
            setReload((v) => v + 1);
            notify("Книга добавлена в библиотеку");
          }}
        />
      )}
      {selectedBook && (
        <Modal open onClose={() => setSelectedBook(null)} title="Книга" wide>
          <div className="book-detail">
            <BookCover book={selectedBook} />
            <div>
              <h2>{selectedBook.title}</h2>
              <p className="book-author">{selectedBook.author}</p>
              <p className="book-edition">
                {selectedBook.topic}
                {selectedBook.language === "en"
                  ? " · English"
                  : selectedBook.language === "kk"
                    ? " · Қазақша"
                    : " · Русский"}
                {selectedBook.pages ? ` · ${selectedBook.pages} стр.` : ""}
              </p>
              {selectedBook.description && <p>{selectedBook.description}</p>}
              {selectedBook.uploader && (
                <p className="uploader-credit">
                  Добавил(а): {selectedBook.uploader}
                </p>
              )}
              {(selectedBook.file || selectedBook.pages) && (
                <button
                  className="button primary full read-book-button"
                  onClick={() => {
                    setReadingStart(undefined);
                    setReadingBook(selectedBook);
                    setSelectedBook(null);
                  }}
                >
                  <BookOpen size={17} />
                  Читать книгу
                </button>
              )}
              {selectedBook.cover_source && (
                <a
                  className="cover-credit"
                  href={selectedBook.cover_source}
                  target="_blank"
                  rel="noreferrer"
                >
                  Обложка: {selectedBook.cover_edition || "издание книги"}
                  <ArrowUpRight size={12} />
                </a>
              )}
              {selectedBook.source_url && (
                <a
                  className="book-source"
                  href={selectedBook.source_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Источник текста <ArrowUpRight size={13} />
                </a>
              )}
              <div className="book-detail-actions">
                <button
                  className={`button outline ${selectedBook.saved ? "book-saved" : ""}`}
                  aria-label={
                    selectedBook.saved
                      ? "Убрать книгу из сохранённого"
                      : "Сохранить книгу"
                  }
                  aria-pressed={selectedBook.saved}
                  disabled={savingBooks.has(selectedBook.id)}
                  onClick={() =>
                    guard(() => {
                      void saveBook(selectedBook);
                    })
                  }
                >
                  <Bookmark
                    size={17}
                    fill={selectedBook.saved ? "currentColor" : "none"}
                  />
                  {selectedBook.saved ? "Сохранено" : "Сохранить книгу"}
                </button>

                <button
                  className={`button ${selectedBook.liked ? "liked outline" : "outline"}`}
                  disabled={bookBusy}
                  onClick={() =>
                    guard(() => {
                      void likeBook();
                    })
                  }
                >
                  <Heart
                    size={17}
                    fill={selectedBook.liked ? "currentColor" : "none"}
                  />
                  {selectedBook.likes} · Поблагодарить
                </button>
                {selectedBook.file && (
                  <a
                    className="button outline"
                    href={selectedBook.file}
                    download
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ArrowDown size={17} />
                    Скачать PDF
                  </a>
                )}
              </div>
              <button
                className="button primary full"
                onClick={() =>
                  guard(() => {
                    const b = selectedBook;
                    setSelectedBook(null);
                    startPost(b);
                  })
                }
              >
                <Feather size={17} />
                Написать об этой книге
              </button>
            </div>
          </div>
        </Modal>
      )}
      {readingBook && (
        <Suspense
          fallback={
            <div className="reader-loading-overlay">Открываем книгу…</div>
          }
        >
          <Reader
            book={readingBook}
            startPage={readingStart}
            onClose={() => {
              setReadingBook(null);
              setReadingStart(undefined);
            }}
          />
        </Suspense>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
          <button onClick={() => setToast("")} aria-label="Закрыть уведомление">
            <X size={15} />
          </button>
        </div>
      )}
    </>
  );
}
