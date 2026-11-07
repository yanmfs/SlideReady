import { exposesUser, isLocalPath, issue, localFilePath } from "./util";
import type { Rule } from "./types";

export const linkLocalFile: Rule = {
  id: "link-local-file",
  category: "links",
  run: (deck) =>
    deck.slides.flatMap((slide) =>
      slide.links
        .filter((l) => l.kind === "external" && isLocalPath(l.target))
        .map((l) =>
          issue("link-local-file", "links", "error", slide, {
            target: localFilePath(l.target),
            exposesUser: exposesUser(localFilePath(l.target)) ? 1 : 0,
          }),
        ),
    ),
};
