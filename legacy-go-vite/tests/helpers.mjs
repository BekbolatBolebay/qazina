import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, unlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
export const artifacts = fileURLToPath(
  new URL("./artifacts/", import.meta.url),
);
mkdirSync(artifacts, { recursive: true });
export const chromiumPath =
  process.env.CHROMIUM_PATH ||
  (existsSync(
    "/home/yernur/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome",
  )
    ? "/home/yernur/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome"
    : undefined);
export function cleanup(username) {
  if (!process.env.DATABASE_URL)
    throw new Error("DATABASE_URL is required for test cleanup");
  if (!/^reader_[a-z0-9]+$/.test(username))
    throw new Error("Invalid test username");
  const url = new URL(process.env.DATABASE_URL);
  const env = {
    ...process.env,
    PGHOST: url.hostname,
    PGPORT: url.port || "5432",
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: url.pathname.slice(1),
  };
  const sql = (q) =>
    execFileSync("psql", ["-qAt", "-v", "ON_ERROR_STOP=1"], {
      input: q,
      env,
      encoding: "utf8",
    });
  const u = `SELECT id FROM users WHERE username='${username}' AND full_name='Тестов Читатель'`;
  const books = `SELECT id FROM books WHERE uploader_id IN (${u})`;
  const posts = `SELECT id FROM posts WHERE user_id IN (${u}) OR book_id IN (${books})`;
  const files = sql(
    `SELECT avatar FROM users WHERE id IN (${u}) UNION SELECT file_path FROM books WHERE id IN (${books});`,
  );
  sql(`BEGIN;
 DELETE FROM post_likes WHERE user_id IN (${u}) OR post_id IN (${posts});
 DELETE FROM bookmarks WHERE user_id IN (${u}) OR post_id IN (${posts});
 DELETE FROM comments WHERE user_id IN (${u}) OR post_id IN (${posts});
 DELETE FROM book_likes WHERE user_id IN (${u}) OR book_id IN (${books});
 DELETE FROM posts WHERE id IN (${posts});
 DELETE FROM follows WHERE user_id IN (${u}) OR target_id IN (${u});
 DELETE FROM books WHERE id IN (${books});
 DELETE FROM users WHERE id IN (${u});
 COMMIT;`);
  const uploadDir =
    process.env.UPLOAD_DIR ||
    fileURLToPath(new URL("../.data/uploads/", import.meta.url));
  for (const f of files.trim().split("\n")) {
    if (!f.startsWith("/uploads/")) continue;
    const target = path.join(uploadDir, path.basename(f));
    if (existsSync(target)) unlinkSync(target);
  }
}
