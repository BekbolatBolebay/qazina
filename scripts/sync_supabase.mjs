import fs from "fs";
import pg from "pg";

const { Client } = pg;

function loadEnvLocal() {
  if (!fs.existsSync(".env.local")) return;
  const lines = fs.readFileSync(".env.local", "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const k = trimmed.slice(0, eq).trim();
    const v = trimmed.slice(eq + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}

loadEnvLocal();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("Missing DATABASE_URL in environment/.env.local");
  process.exit(1);
}

async function main() {
  const coreBooks = JSON.parse(fs.readFileSync("src/data/books.json", "utf8"));
  const extraBooks = JSON.parse(fs.readFileSync("src/data/catalog-extra.json", "utf8"));
  const quest = JSON.parse(fs.readFileSync("src/data/quest-dorm-secret.json", "utf8"));
  const frags = JSON.parse(fs.readFileSync("src/data/fragments.json", "utf8"));

  const questBook = {
    id: "book_quest_dorm",
    slug: quest.slug,
    title: quest.title,
    author: quest.author,
    language: "kk",
    genre: "Мистикалық триллер / Интерактивті квест",
    year: 2026,
    age_min: 12,
    rights_status: "original_quest",
    rights_note: "QAZINA Original Storytelling Quest",
    source_url: "/quest",
    cover_color: "#173F35",
    description:
      "Студенттік жатақханада есік астынан табылған көк конверт, 404-бөлменің құпиясы және ашық финалмен аяқталатын 16 бөлімдік интерактивті оқиға.",
    chapters: quest.chapters.map((ch) => ({
      id: ch.id,
      book_id: "book_quest_dorm",
      title: ch.title,
      order: ch.number,
      content: ch.text,
    })),
  };

  const allBooks = [questBook, ...coreBooks, ...extraBooks];

  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  await client.query(`
    CREATE TABLE IF NOT EXISTS qazina_books (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      language TEXT NOT NULL,
      genre TEXT NOT NULL,
      age_min INT NOT NULL DEFAULT 12,
      rights_status TEXT NOT NULL,
      drive_file_id TEXT,
      pdf_url TEXT,
      total_chapters INT NOT NULL DEFAULT 0,
      data JSONB NOT NULL
    );
    CREATE TABLE IF NOT EXISTS qazina_fragments (
      id TEXT PRIMARY KEY,
      book_id TEXT NOT NULL REFERENCES qazina_books(id) ON DELETE CASCADE,
      chapter_id TEXT NOT NULL,
      type TEXT NOT NULL,
      language TEXT NOT NULL,
      moods TEXT[] NOT NULL DEFAULT '{}',
      text TEXT NOT NULL,
      hook_score DOUBLE PRECISION NOT NULL DEFAULT 0.9,
      dialogue_score DOUBLE PRECISION NOT NULL DEFAULT 0.9,
      data JSONB NOT NULL
    );
  `);

  for (const b of allBooks) {
    await client.query(
      `INSERT INTO qazina_books
        (id, slug, title, author, language, genre, age_min, rights_status, drive_file_id, pdf_url, total_chapters, data)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)
       ON CONFLICT (id) DO UPDATE SET
        slug=EXCLUDED.slug,
        title=EXCLUDED.title,
        author=EXCLUDED.author,
        language=EXCLUDED.language,
        genre=EXCLUDED.genre,
        age_min=EXCLUDED.age_min,
        rights_status=EXCLUDED.rights_status,
        drive_file_id=EXCLUDED.drive_file_id,
        pdf_url=EXCLUDED.pdf_url,
        total_chapters=EXCLUDED.total_chapters,
        data=EXCLUDED.data`,
      [
        b.id,
        b.slug,
        b.title,
        b.author,
        b.language,
        b.genre,
        b.age_min || 12,
        b.rights_status,
        b.drive_file_id || null,
        b.pdf_url || null,
        (b.chapters || []).length,
        JSON.stringify(b),
      ],
    );
  }

  for (const f of frags) {
    await client.query(
      `INSERT INTO qazina_fragments
        (id, book_id, chapter_id, type, language, moods, text, hook_score, dialogue_score, data)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)
       ON CONFLICT (id) DO UPDATE SET
        book_id=EXCLUDED.book_id,
        chapter_id=EXCLUDED.chapter_id,
        type=EXCLUDED.type,
        language=EXCLUDED.language,
        moods=EXCLUDED.moods,
        text=EXCLUDED.text,
        hook_score=EXCLUDED.hook_score,
        dialogue_score=EXCLUDED.dialogue_score,
        data=EXCLUDED.data`,
      [
        f.id,
        f.book_id,
        f.chapter_id,
        f.type,
        f.language,
        f.moods || [],
        f.text,
        f.hook_score || 0.88,
        f.dialogue_score || 0.8,
        JSON.stringify(f),
      ],
    );
  }

  const bRes = await client.query("SELECT count(*)::int AS cnt FROM qazina_books");
  const fRes = await client.query("SELECT count(*)::int AS cnt FROM qazina_fragments");
  await client.end();

  console.log({
    syncedBooks: bRes.rows[0].cnt,
    syncedFragments: fRes.rows[0].cnt,
    database: "supabase_bekbolat25_mediahub (a1-postgres1.alem.ai:30100)",
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
