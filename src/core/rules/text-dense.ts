import { issue } from "./util";
import type { Rule } from "./types";

export const textDense: Rule = {
  id: "text-dense",
  category: "text",
  run: (deck) =>
    deck.slides.flatMap((slide) => {
      const paragraphs = slide.texts
        .filter((t) => t.kind !== "footer")
        .flatMap((t) => t.paragraphs);
      const words = paragraphs.reduce(
        (n, p) =>
          n +
          p.runs
            .map((r) => r.text)
            .join("")
            .split(/\s+/)
            .filter(Boolean).length,
        0,
      );
      const bullets = paragraphs.filter((p) => p.bullet).length;
      if (words <= 60 && bullets <= 7) return [];
      return [issue("text-dense", "text", "tip", slide, { words, bullets })];
    }),
};
