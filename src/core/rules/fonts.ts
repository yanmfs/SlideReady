import type { Deck } from "../pptx/types";
import { issue } from "./util";
import type { Issue, Rule, RuleContext } from "./types";

const SAFE = new Set([
  "arial",
  "arial black",
  "comic sans ms",
  "courier new",
  "georgia",
  "impact",
  "tahoma",
  "times new roman",
  "trebuchet ms",
  "verdana",
]);
const OFFICE_SAFE = new Set([
  "aptos",
  "calibri",
  "cambria",
  "candara",
  "consolas",
  "constantia",
  "corbel",
  "calibri light",
]);
const SYMBOL = /^(symbol|wingdings\s*\d*|webdings|marlett|segoe ui symbol|segoe ui emoji)$/i;

export type FontStatus = "safe" | "embedded" | "ok" | "risky" | "missing";

export interface FontUse {
  name: string;
  slides: number[];
  embedded: boolean;
  installed: boolean | undefined;
  safe: boolean;
  status: FontStatus;
}

export function fontUsage(deck: Deck, ctx: RuleContext): FontUse[] {
  const slidesByFont = new Map<string, Set<number>>();
  for (const slide of deck.slides) {
    for (const text of slide.texts) {
      for (const paragraph of text.paragraphs) {
        for (const run of paragraph.runs) {
          if (!run.font || run.text.trim() === "" || SYMBOL.test(run.font)) continue;
          const set = slidesByFont.get(run.font) ?? new Set<number>();
          set.add(slide.index);
          slidesByFont.set(run.font, set);
        }
      }
    }
  }
  const embedded = new Set(deck.embeddedFonts.map((f) => f.toLowerCase()));
  return [...slidesByFont.entries()]
    .map(([name, slides]) => {
      const key = name.toLowerCase();
      const isEmbedded = embedded.has(key);
      const safe = SAFE.has(key);
      const installed = ctx.isFontInstalled(name);
      let status: FontStatus;
      if (isEmbedded) status = "embedded";
      else if (safe) status = "safe";
      else if (installed === false) status = "missing";
      else if (installed === true && OFFICE_SAFE.has(key)) status = "ok";
      else status = "risky";
      return {
        name,
        slides: [...slides].sort((a, b) => a - b),
        embedded: isEmbedded,
        installed,
        safe,
        status,
      };
    })
    .sort((a, b) => b.slides.length - a.slides.length || a.name.localeCompare(b.name));
}

function fontIssues(deck: Deck, ctx: RuleContext, id: "font-not-embedded" | "font-risky"): Issue[] {
  const status: FontStatus = id === "font-not-embedded" ? "missing" : "risky";
  return fontUsage(deck, ctx)
    .filter((f) => f.status === status)
    .map((f) => {
      const slide = deck.slides.find((s) => s.index === f.slides[0]);
      return issue(id, "fonts", id === "font-not-embedded" ? "error" : "warning", slide, {
        font: f.name,
        count: f.slides.length,
        unknown: f.installed === undefined ? 1 : 0,
      });
    });
}

export const fontNotEmbedded: Rule = {
  id: "font-not-embedded",
  category: "fonts",
  run: (deck, ctx) => fontIssues(deck, ctx, "font-not-embedded"),
};

export const fontRisky: Rule = {
  id: "font-risky",
  category: "fonts",
  run: (deck, ctx) => fontIssues(deck, ctx, "font-risky"),
};
