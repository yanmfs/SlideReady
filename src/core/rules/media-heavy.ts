import { issue } from "./util";
import type { Rule } from "./types";

const MB = 1024 * 1024;

export const mediaHeavy: Rule = {
  id: "media-heavy",
  category: "media",
  run: (deck) => {
    const heavy = deck.slides.flatMap((slide) =>
      slide.media
        .filter((m) => (m.size ?? 0) > 20 * MB)
        .map((m) =>
          issue("media-heavy", "media", "warning", slide, {
            size: Math.round((m.size ?? 0) / MB),
          }),
        ),
    );
    const whole =
      deck.fileSize > 100 * MB
        ? [
            issue("media-heavy", "media", "warning", undefined, {
              size: Math.round(deck.fileSize / MB),
              deck: 1,
            }),
          ]
        : [];
    return [...heavy, ...whole];
  },
};
