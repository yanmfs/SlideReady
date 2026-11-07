import { issue } from "./util";
import type { Rule } from "./types";

export const hygieneOffSlide: Rule = {
  id: "hygiene-off-slide",
  category: "hygiene",
  run: (deck) =>
    deck.slides.flatMap((slide) =>
      slide.offSlide.length === 0
        ? []
        : [
            issue("hygiene-off-slide", "hygiene", "tip", slide, {
              count: slide.offSlide.length,
              name: slide.offSlide[0]?.name ?? "",
              partial: slide.offSlide.every((s) => s.partial) ? 1 : 0,
            }),
          ],
    ),
};
