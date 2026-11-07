import { issue } from "./util";
import type { Rule } from "./types";

const PLACEHOLDER = new RegExp(
  [
    "lorem ipsum",
    "\\bTODO\\b",
    "\\bTBD\\b",
    "X{3,}",
    "\\?{3,}",
    "\\[\\s*inserir[^\\]]*\\]",
    "\\[\\s*(?:nome|data)\\s*\\]",
    "clique para adicionar",
    "click to add",
    "texto aqui",
    "seu texto",
    "t[ií]tulo aqui",
  ].join("|"),
  "i",
);
// TODO, TBD and XXX only count in capitals; "todo" is an ordinary Portuguese word.
const CAPS_ONLY = /^(todo|tbd|x{3,})$/i;

// The first leftover-placeholder phrase in a line, or null. "todo" in lowercase is just a word.
export function findPlaceholder(line: string): string | null {
  const match = PLACEHOLDER.exec(line);
  if (!match) return null;
  if (CAPS_ONLY.test(match[0]) && match[0] !== match[0].toUpperCase()) return null;
  return match[0];
}

export const textPlaceholder: Rule = {
  id: "text-placeholder",
  category: "text",
  run: (deck) =>
    deck.slides.flatMap((slide) => {
      for (const text of slide.texts) {
        for (const paragraph of text.paragraphs) {
          const line = paragraph.runs.map((r) => r.text).join("");
          const found = findPlaceholder(line);
          if (found) return [issue("text-placeholder", "text", "error", slide, { sample: found })];
        }
      }
      return [];
    }),
};
