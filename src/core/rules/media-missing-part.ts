import { issue } from "./util";
import type { Rule } from "./types";

export const mediaMissingPart: Rule = {
  id: "media-missing-part",
  category: "media",
  run: (deck) =>
    deck.slides.flatMap((slide) =>
      slide.media
        .filter((m) => !m.external && !m.partExists)
        .map((m) => issue("media-missing-part", "media", "error", slide, { target: m.target })),
    ),
};
