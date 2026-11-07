import { issue } from "./util";
import type { Rule } from "./types";

const normalize = (title: string) => title.toLowerCase().replace(/\s+/g, " ").trim();

export const a11yDuplicateTitle: Rule = {
  id: "a11y-duplicate-title",
  category: "accessibility",
  run: (deck) => {
    const seen = new Map<string, number>();
    return deck.slides.flatMap((slide) => {
      if (!slide.title) return [];
      const key = normalize(slide.title);
      const firstSlide = seen.get(key);
      if (firstSlide === undefined) {
        seen.set(key, slide.index);
        return [];
      }
      return [issue("a11y-duplicate-title", "accessibility", "tip", slide, { first: firstSlide })];
    });
  },
};
