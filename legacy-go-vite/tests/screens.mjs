import { chromium } from "../frontend/node_modules/playwright-core/index.mjs";
import { artifacts, chromiumPath } from "./helpers.mjs";
const browser = await chromium.launch({
  headless: true,
  executablePath: chromiumPath,
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto(process.env.MOOD_URL || "http://localhost:8088");
await page.locator(".post-card").first().waitFor();
await page
  .locator(".mobile-nav")
  .getByRole("button", { name: "Библиотека" })
  .click();
await page.locator(".library-book").first().waitFor();
await page.screenshot({
  path: artifacts + "library-mobile.png",
  fullPage: true,
  animations: "disabled",
});
await page
  .locator(".mobile-nav")
  .getByRole("button", { name: "Создать пост" })
  .click();
await page.getByRole("dialog").waitFor();
await page.screenshot({
  path: artifacts + "registration-mobile.png",
  animations: "disabled",
});
await page.getByRole("button", { name: "Закрыть", exact: true }).click();
await page.setViewportSize({ width: 1440, height: 1000 });
await page
  .locator(".desktop-nav")
  .getByRole("button", { name: "Лента", exact: true })
  .click();
await page.locator(".post-card").first().waitFor();
console.log(
  "Search buttons on desktop:",
  await page.locator(".mobile-search:visible").count(),
);
console.log(
  "Desktop document overflow:",
  await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
);
await browser.close();
