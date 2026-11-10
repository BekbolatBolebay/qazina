CREATE TABLE IF NOT EXISTS users (
 id BIGSERIAL PRIMARY KEY, username TEXT NOT NULL, full_name TEXT NOT NULL,
 email TEXT NOT NULL, password_hash TEXT NOT NULL, avatar TEXT NOT NULL DEFAULT '',
 bio TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_username ON users(lower(username));
CREATE UNIQUE INDEX IF NOT EXISTS users_email ON users(lower(email));
CREATE TABLE IF NOT EXISTS sessions (
 token_hash TEXT PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS books (
 id BIGSERIAL PRIMARY KEY, title TEXT NOT NULL, author TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
 color TEXT NOT NULL DEFAULT '#31574b', uploader_id BIGINT REFERENCES users(id),
 file_path TEXT NOT NULL DEFAULT '', file_hash TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(file_hash)
);
CREATE TABLE IF NOT EXISTS book_pages (
 book_id BIGINT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
 page INT NOT NULL,
 text TEXT NOT NULL,
 PRIMARY KEY(book_id, page)
);
CREATE UNIQUE INDEX IF NOT EXISTS books_identity ON books(lower(regexp_replace(trim(title),'\s+',' ','g')),lower(regexp_replace(trim(author),'\s+',' ','g')));
CREATE TABLE IF NOT EXISTS posts (
 id BIGSERIAL PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES users(id), book_id BIGINT NOT NULL REFERENCES books(id),
 kind TEXT NOT NULL CHECK(kind IN ('quote','recommendation')), quote TEXT NOT NULL DEFAULT '',
 opinion TEXT NOT NULL CHECK(length(opinion) BETWEEN 1 AND 5000), page INT NOT NULL DEFAULT 0 CHECK(page>=0),
 lines TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 CHECK(kind <> 'quote' OR length(quote) BETWEEN 1 AND 3000)
);
CREATE INDEX IF NOT EXISTS posts_feed ON posts(id DESC);
CREATE INDEX IF NOT EXISTS posts_user ON posts(user_id,id DESC);
CREATE INDEX IF NOT EXISTS posts_book ON posts(book_id,id DESC);
CREATE TABLE IF NOT EXISTS post_likes (user_id BIGINT REFERENCES users(id),post_id BIGINT REFERENCES posts(id) ON DELETE CASCADE,PRIMARY KEY(user_id,post_id));
CREATE INDEX IF NOT EXISTS post_likes_post ON post_likes(post_id);
CREATE TABLE IF NOT EXISTS book_likes (user_id BIGINT REFERENCES users(id),book_id BIGINT REFERENCES books(id) ON DELETE CASCADE,PRIMARY KEY(user_id,book_id));
CREATE INDEX IF NOT EXISTS book_likes_book ON book_likes(book_id);
CREATE TABLE IF NOT EXISTS bookmarks (user_id BIGINT REFERENCES users(id),post_id BIGINT REFERENCES posts(id) ON DELETE CASCADE,PRIMARY KEY(user_id,post_id));
CREATE TABLE IF NOT EXISTS follows (user_id BIGINT REFERENCES users(id),target_id BIGINT REFERENCES users(id),PRIMARY KEY(user_id,target_id),CHECK(user_id<>target_id));
CREATE INDEX IF NOT EXISTS follows_target ON follows(target_id);
CREATE TABLE IF NOT EXISTS comments (id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL REFERENCES users(id),post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 2000),created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS comments_post ON comments(post_id,id);

-- Additive migrations keep existing accounts and publications intact.
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE books ADD COLUMN IF NOT EXISTS topic TEXT NOT NULL DEFAULT 'Классика';
ALTER TABLE books ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'ru';
ALTER TABLE books ADD COLUMN IF NOT EXISTS source_url TEXT NOT NULL DEFAULT '';
ALTER TABLE books ADD COLUMN IF NOT EXISTS license TEXT NOT NULL DEFAULT '';
ALTER TABLE books ADD COLUMN IF NOT EXISTS pages INT NOT NULL DEFAULT 0;
ALTER TABLE books ADD COLUMN IF NOT EXISTS catalog_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS books_catalog_key ON books(catalog_key) WHERE catalog_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS books_topic ON books(topic,id DESC);
ALTER TABLE posts ADD COLUMN IF NOT EXISTS demo_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS posts_demo_key ON posts(demo_key) WHERE demo_key IS NOT NULL;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS demo_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS comments_demo_key ON comments(demo_key) WHERE demo_key IS NOT NULL;
ALTER TABLE books ADD COLUMN IF NOT EXISTS cover_path TEXT NOT NULL DEFAULT '';
ALTER TABLE books ADD COLUMN IF NOT EXISTS cover_source TEXT NOT NULL DEFAULT '';
ALTER TABLE books ADD COLUMN IF NOT EXISTS cover_edition TEXT NOT NULL DEFAULT '';
CREATE TABLE IF NOT EXISTS book_saves (
 user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 book_id BIGINT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,book_id)
);
CREATE INDEX IF NOT EXISTS book_saves_book ON book_saves(book_id);
