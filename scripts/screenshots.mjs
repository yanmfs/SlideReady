// Usage: node scripts/screenshots.mjs [baseUrl]  (serve the built app first, e.g. `vite preview`)
import { chromium } from "playwright";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildDecks } from "./make-decks.mjs";

const base = process.argv[2] ?? "http://localhost:4173";
const out = "docs/shots";
mkdirSync(out, { recursive: true });
const dir = mkdtempSync(join(tmpdir(), "slideready-"));
const demo = join(dir, "Resultados do trimestre.pptx");
writeFileSync(demo, (await buildDecks()).demo);

const browser = await chromium.launch({ channel: "chromium" });
for (const os of ["macos", "windows"]) {
  for (const scheme of ["light", "dark"]) {
    const page = await browser.newPage({
      viewport: { width: 1100, height: 760 },
      colorScheme: scheme,
      deviceScaleFactor: 2,
      locale: "pt-BR",
    });
    await page.goto(`${base}/?os=${os}`);
    await page.getByRole("button", { name: "Abrir apresentação" }).waitFor();
    await page.screenshot({ path: `${out}/${os}-${scheme}-empty.png` });
    const [chooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      page.getByRole("button", { name: "Abrir apresentação" }).click(),
    ]);
    await chooser.setFiles(demo);
    await page.getByRole("heading", { name: "Resultados do trimestre.pptx" }).waitFor();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${out}/${os}-${scheme}-main.png` });
    await page.close();
  }
}
await browser.close();
