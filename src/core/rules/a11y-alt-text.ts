import { issue } from "./util";
import type { Rule } from "./types";

export const a11yAltText: Rule = {
  id: "a11y-alt-text",
  category: "accessibility",
  run: (deck) =>
    deck.slides.flatMap((slide) => {
      const missing = slide.pictures.filter((p) => !p.hasAlt && !p.decorative && !p.fullBleed);
      return missing.length === 0
        ? []
        : [
            issue("a11y-alt-text", "accessibility", "warning", slide, {
              count: missing.length,
            }),
          ];
    }),
};
