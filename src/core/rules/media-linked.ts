import { exposesUser, isLocalPath, issue, localFilePath } from "./util";
import type { Rule } from "./types";

export const mediaLinked: Rule = {
  id: "media-linked",
  category: "media",
  run: (deck, ctx) =>
    deck.slides.flatMap((slide) =>
      slide.media
        .filter((m) => m.external && m.relType !== "other")
        .map((m) => {
          const local = isLocalPath(m.target);
          const path = local ? localFilePath(m.target) : m.target;
          const missing = local && ctx.fileExists(path) === false;
          return issue("media-linked", "media", missing ? "error" : "warning", slide, {
            target: path,
            missing: missing ? 1 : 0,
            exposesUser: exposesUser(path) ? 1 : 0,
          });
        }),
    ),
};
