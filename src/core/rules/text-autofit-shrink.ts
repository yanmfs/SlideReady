import { issue } from "./util";
import type { Rule } from "./types";

export const textAutofitShrink: Rule = {
  id: "text-autofit-shrink",
  category: "text",
  run: (deck) =>
    deck.slides.flatMap((slide) => {
      const shrunk = slide.texts.filter((t) => t.fontScale !== undefined && t.fontScale < 0.8);
      if (shrunk.length === 0) return [];
      const lowest = Math.min(...shrunk.map((t) => t.fontScale ?? 1));
      return [
        issue("text-autofit-shrink", "text", "warning", slide, {
          percent: Math.round(lowest * 100),
          count: shrunk.length,
        }),
      ];
    }),
};
