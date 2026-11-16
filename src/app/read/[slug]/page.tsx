import Link from "next/link";
import { notFound } from "next/navigation";
import { BookReader } from "@/components/reader/BookReader";
import { getBookBySlug } from "@/lib/books";
import { getFragmentById } from "@/lib/fragments";

export default async function ReadBookPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ anchor?: string; chapter?: string }>;
}) {
  const { slug } = await params;
  const { anchor, chapter } = await searchParams;
  const book = getBookBySlug(slug);

  if (!book) {
    notFound();
  }

  const anchorFragment = anchor ? getFragmentById(anchor) : undefined;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs text-neutral-500">
        <span>QAZINA Reader · {book.rights_note}</span>
        <Link href="/books" className="font-semibold text-[#173F35] hover:underline dark:text-[#D4B382]">
          Кітапхана каталогы →
        </Link>
      </div>
      <BookReader
        book={book}
        anchorFragment={
          anchorFragment?.book_id === book.id ? anchorFragment : undefined
        }
        initialChapterId={chapter}
      />
    </div>
  );
}
