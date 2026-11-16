import { artifacts, chromiumPath } from "./helpers.mjs";
import { chromium } from "../frontend/node_modules/playwright-core/index.mjs";
const browser = await chromium.launch({
  headless: true,
  executablePath: chromiumPath,
  args: ["--no-sandbox"],
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 1100 },
  deviceScaleFactor: 1,
});
page.on("pageerror", (e) => console.log("ERROR", e.message));
page.on("response", (r) => {
  if (r.status() >= 400) console.log(r.status(), r.url());
});
await page.goto(process.env.MOOD_URL || "http://localhost:8088");
await page.locator(".post-card").first().waitFor();
await page.screenshot({
  path: artifacts + "desktop.png",
  fullPage: true,
  animations: "disabled",
});
console.log(
  "overflow",
  await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
);
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({
  path: artifacts + "mobile.png",
  fullPage: true,
  animations: "disabled",
});
console.log(
  "mobile overflow",
  await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
);
await browser.close();
