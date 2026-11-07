import { extensionOf, issue } from "./util";
import type { Rule } from "./types";

const MAC_PROBLEMS = new Set(["wmv", "avi", "flv"]);
const OLD_WINDOWS_PROBLEMS = new Set(["mov"]);

export const mediaFormat: Rule = {
  id: "media-format",
  category: "media",
  run: (deck) =>
    deck.slides.flatMap((slide) =>
      slide.media
        .filter((m) => m.relType === "video")
        .flatMap((m) => {
          const ext = extensionOf(m.target);
          if (!MAC_PROBLEMS.has(ext) && !OLD_WINDOWS_PROBLEMS.has(ext)) return [];
          return [
            issue("media-format", "media", "warning", slide, {
              format: ext,
              mac: MAC_PROBLEMS.has(ext) ? 1 : 0,
            }),
          ];
        }),
    ),
};
