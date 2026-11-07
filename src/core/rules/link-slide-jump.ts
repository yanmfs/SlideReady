import { issue } from "./util";
import type { Rule } from "./types";

export const linkSlideJump: Rule = {
  id: "link-slide-jump",
  category: "links",
  run: (deck) =>
    deck.slides.flatMap((slide) =>
      slide.links
        .filter((l) => l.kind === "slide-jump" && l.missing)
        .map(() => issue("link-slide-jump", "links", "error", slide)),
    ),
};
