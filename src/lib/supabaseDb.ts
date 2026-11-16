import { Pool } from "pg";

let pool: Pool | null = null;

function getPool(): Pool | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: url,
      max: 4,
      idleTimeoutMillis: 15000,
      connectionTimeoutMillis: 3000,
    });
  }
  return pool;
}

export interface SupabaseStorageStatus {
  connected: boolean;
  studio_url: string;
  minio_bucket: string;
  books_count: number;
  fragments_count: number;
  drive_pdfs_count: number;
}

export async function getSupabaseStorageStatus(): Promise<SupabaseStorageStatus> {
  const studioUrl =
    process.env.SUPABASE_URL ||
    "https://a1-supabase-bekbolat25-mediahub.dedicatedapp.alem.ai";
  const bucket = process.env.MINIO_BUCKET || "supabase_bekbolat25_mediahub";

  const p = getPool();
  if (!p) {
    return {
      connected: false,
      studio_url: studioUrl,
      minio_bucket: bucket,
      books_count: 0,
      fragments_count: 0,
      drive_pdfs_count: 0,
    };
  }

  try {
    const [bRes, fRes, dRes] = await Promise.all([
      p.query("SELECT count(*)::int AS c FROM qazina_books"),
      p.query("SELECT count(*)::int AS c FROM qazina_fragments"),
      p.query(
        "SELECT count(*)::int AS c FROM qazina_books WHERE drive_file_id IS NOT NULL",
      ),
    ]);
    return {
      connected: true,
      studio_url: studioUrl,
      minio_bucket: bucket,
      books_count: bRes.rows[0]?.c || 0,
      fragments_count: fRes.rows[0]?.c || 0,
      drive_pdfs_count: dRes.rows[0]?.c || 0,
    };
  } catch {
    return {
      connected: false,
      studio_url: studioUrl,
      minio_bucket: bucket,
      books_count: 0,
      fragments_count: 0,
      drive_pdfs_count: 0,
    };
  }
}
