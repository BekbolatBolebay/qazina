import type { Metadata, Viewport } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { QazinaProvider } from "@/components/layout/QazinaProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "QAZINA — Кітапты іздеме. Оқиға сені тапсын.",
  description:
    "Көңіл күйге негізделген интеллектуалды әдеби платформа және «Жатақхана құпиясы» интерактивті storytelling-квесті.",
  icons: {
    icon: "/favicon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="kk" suppressHydrationWarning>
      <body className="min-h-screen bg-[#F8F5EF] text-[#242424] antialiased dark:bg-[#141917] dark:text-[#F3EFE7]">
        <QazinaProvider>
          <Navbar />
          <main className="mx-auto min-h-[calc(100vh-5rem)] max-w-6xl px-3.5 pb-28 pt-4 sm:px-4 sm:pt-6 lg:pb-12">
            {children}
          </main>
        </QazinaProvider>
      </body>
    </html>
  );
}
