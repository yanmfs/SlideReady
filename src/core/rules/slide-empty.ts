import { issue } from "./util";
import type { Rule } from "./types";

export const slideEmpty: Rule = {
  id: "slide-empty",
  category: "text",
  run: (deck) =>
    deck.slides.flatMap((slide) =>
      slide.contentCount === 0 && !slide.hidden
        ? [issue("slide-empty", "text", "warning", slide)]
        : [],
    ),
};
