import { chromium } from "../frontend/node_modules/playwright-core/index.mjs";
import assert from "node:assert/strict";
import { artifacts, chromiumPath, cleanup } from "./helpers.mjs";
const base = process.env.MOOD_URL || "http://localhost:8088";
const browser = await chromium.launch({
  headless: true,
  executablePath: chromiumPath,
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const stamp = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const username = "reader_" + stamp;
const txtTitle = "Текстовая книга " + stamp;
const fb2Title = "Электронная книга " + stamp;
const paragraph =
  `Строка текста для проверки загрузки книги (прогон ${stamp}). `;
const txtBody = Array.from({ length: 30 }, (_, i) => `${i + 1}. ${paragraph}`)
  .join("\n");
const fb2Paragraphs = Array.from(
  { length: 12 },
  (_, i) => `<p>Абзац ${i + 1} из файла FB2: ${paragraph}</p>`,
).join("");
const fb2Body = `<?xml version="1.0" encoding="UTF-8"?>
<FictionBook>
 <description-section>
  <title-info>
   <book-title>${fb2Title}</book-title>
   <author><first-name>Федор</first-name><last-name>Тестов</last-name></author>
  </title-info>
 </description-section>
 <body>
  <section>
   <title><p>Часть первая</p></title>
   ${fb2Paragraphs}
  </section>
 </body>
</FictionBook>`;
async function register() {
  await page.goto(base);
  await page.locator(".post-card").first().waitFor();
  await page.locator(".profile-link").first().click();
  await page
    .getByRole("heading", { name: "Присоединиться к Mood" })
    .waitFor();
  await page.getByLabel("Фамилия и имя").fill("Тестов Читатель");
  await page.locator("input[name=username]").fill(username);
  await page.getByLabel("Gmail", { exact: true }).fill(username + "@gmail.com");
  await page.locator("input[name=password]").fill("Mood-test-password-123");
  await page.locator(".avatar-upload input").setInputFiles({
    name: "avatar.png",
    mimeType: "image/png",
    buffer: await page.screenshot({ clip: { x: 0, y: 0, width: 4, height: 4 } }),
  });
  await page
    .getByRole("button", { name: "Создать аккаунт", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Присоединиться к Mood" })
    .waitFor({ state: "hidden" });
  await page.reload();
  await page.locator(".account").waitFor();
}
async function openLibrary() {
  await page
    .locator(".desktop-nav")
    .getByRole("button", { name: "Библиотека", exact: true })
    .click();
  await page.locator(".library-book").first().waitFor();
}
async function uploadBookViaUI(fileTitle, fileName, buffer) {
  await page
    .getByRole("button", { name: "Добавить книгу", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Добавить книгу", exact: true })
    .waitFor();
  await page.getByLabel("Название", { exact: true }).fill(fileTitle);
  await page.getByLabel("Автор", { exact: true }).fill("Тестов Автор");
  await page.locator('input[name=file]').setInputFiles({
    name: fileName,
    mimeType: "application/octet-stream",
    buffer,
  });
  await page
    .getByRole("button", { name: "Добавить в библиотеку", exact: true })
    .click();
  await page.getByText("Книга добавлена в библиотеку").waitFor();
  await page
    .getByRole("heading", { name: "Добавить книгу", exact: true })
    .waitFor({ state: "hidden" });
}
try {
  await register();
  await openLibrary();
  await uploadBookViaUI(txtTitle, "book-" + stamp + ".txt", Buffer.from(txtBody, "utf8"));
  // Новая книга видна в библиотеке.
  await page.locator(".library-book").filter({ hasText: txtTitle }).waitFor();
  // Гостю (без сессии) книга и её страницы доступны.
  const books = await (
    await fetch(base + "/api/books?q=" + encodeURIComponent(txtTitle))
  ).json();
  assert.equal(books.length, 1, "guest sees exactly the uploaded book");
  const book = books[0];
  assert.equal(book.file, "", "text book has no pdf file");
  assert.ok(book.pages >= 2, "text book is split into pages: " + book.pages);
  const pages = await (
    await fetch(base + `/api/books/${book.id}/pages?from=1&to=2`)
  ).json();
  assert.equal(pages.pages, book.pages);
  assert.ok(pages.items.length >= 1);
  assert.ok(pages.items[0].text.includes("Строка текста для проверки"));  // Чтение в ридере: текстовый режим вместо PDF.
  await page.locator(".library-book").filter({ hasText: txtTitle }).click();
  await page.getByRole("button", { name: "Читать книгу", exact: true }).click();
  await page.locator(".text-page").waitFor();
  assert.equal(await page.locator(".reader-body canvas").count(), 0);
  assert.equal(await page.locator(".reader-download").count(), 0);
  assert.ok(
    (await page.locator(".text-page").textContent()).includes(
      "Строка текста для проверки",
    ),
  );
  const firstText = await page.locator(".text-page").textContent();
  await page.getByRole("button", { name: "Следующая страница" }).click();
  await page.waitForFunction(() => {
    const input = [...document.querySelectorAll("input")].find((i) =>
      i.closest("label")?.textContent.includes("Страница книги"),
    );
    return input?.value === "2";
  });
  await page.waitForFunction(
    (first) =>
      document.querySelector(".text-page")?.textContent !== first &&
      document.querySelector(".text-page")?.textContent.includes(
        "Строка текста",
      ),
    firstText,
  );
  await page.screenshot({
    path: artifacts + "text-reader-desktop.png",
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => {
    const t = document.querySelector(".text-page");
    const b = document.querySelector(".reader-body");
    return t && b && t.getBoundingClientRect().width <= b.getBoundingClientRect().width;
  });
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    false,
  );
  await page.screenshot({
    path: artifacts + "text-reader-mobile.png",
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Закрыть книгу" }).click();
  // FB2: второй формат, метаданные из файла не обязательны — карточка своя.
  await page.setViewportSize({ width: 1440, height: 1000 });
  await uploadBookViaUI(fb2Title, "book-" + stamp + ".fb2", Buffer.from(fb2Body, "utf8"));
  await page.locator(".library-book").filter({ hasText: fb2Title }).waitFor();
  const fb2 = (
    await (await fetch(base + "/api/books?q=" + encodeURIComponent(fb2Title))).json()
  )[0];
  const fb2Pages = await (
    await fetch(base + `/api/books/${fb2.id}/pages?from=1`)
  ).json();
  assert.ok(fb2Pages.items[0].text.includes("Абзац 1 из файла FB2"));
  assert.ok(fb2Pages.items[0].text.includes("Часть первая"));
  // PDF-книга по-прежнему открывается как PDF.
  await page.locator(".library-book").filter({ hasText: "Чем люди живы" }).click();
  await page.getByRole("button", { name: "Читать книгу", exact: true }).click();
  await page.locator(".reader-body canvas").waitFor({ timeout: 30000 });
  await page.getByRole("button", { name: "Закрыть книгу" }).click();
  // Обложка: карточка книги с загруженной обложкой.
  const coverTitle = "Книга с обложкой " + stamp;
  const png1x1 = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
    "base64",
  );
  await page
    .getByRole("button", { name: "Добавить книгу", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Добавить книгу", exact: true })
    .waitFor();
  await page.getByLabel("Название", { exact: true }).fill(coverTitle);
  await page.getByLabel("Автор", { exact: true }).fill("Тестов Автор");
  // Некорректная обложка (не изображение) отклоняется.
  await page.locator(".cover-upload input").setInputFiles({
    name: "cover.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not an image"),
  });
  await page
    .getByRole("button", { name: "Добавить в библиотеку", exact: true })
    .click();
  await page.getByText("Обложка должна быть изображением").waitFor();
  // Правильная обложка: PNG.
  await page.locator(".cover-upload input").setInputFiles({
    name: "cover.png",
    mimeType: "image/png",
    buffer: png1x1,
  });
  await page
    .getByRole("button", { name: "Добавить в библиотеку", exact: true })
    .click();
  // Ждём по факту (книга появилась в библиотеке), а не по тосту: тост
  // «Книга добавлена» мог остаться видимым от предыдущей успешной загрузки.
  await page
    .locator(".library-book")
    .filter({ hasText: coverTitle })
    .waitFor({ timeout: 15000 });
  const coverBook = (
    await (
      await fetch(base + "/api/books?q=" + encodeURIComponent(coverTitle))
    ).json()
  )[0];
  assert.ok(
    coverBook.cover.startsWith("/uploads/"),
    "cover path stored: " + coverBook.cover,
  );
  const coverResp = await fetch(base + coverBook.cover);
  assert.equal(coverResp.status, 200, "uploaded cover is served");
  assert.match(
    coverResp.headers.get("content-type"),
    /^image\/(png|jpeg|webp)/,
    "cover content-type: " + coverResp.headers.get("content-type"),
  );
  assert.equal(
    (await coverResp.arrayBuffer()).byteLength,
    png1x1.length,
    "served cover matches the uploaded bytes",
  );
  // В библиотеке рендерится изображение обложки.
  await page
    .locator(".library-book")
    .filter({ hasText: coverTitle })
    .locator("img")
    .first()
    .waitFor();
  await page.screenshot({
    path: artifacts + "cover-book-library.png",
    animations: "disabled",
  });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: TXT and FB2 upload, guest reading of text pages, mobile text reader, PDF still works.",
  );
} catch (e) {
  await page.screenshot({
    path: artifacts + "upload-failure.png",
    animations: "disabled",
  });
  console.log("PAGE ERRORS", errors);
  throw e;
} finally {
  cleanup(username);
  await browser.close();
}
