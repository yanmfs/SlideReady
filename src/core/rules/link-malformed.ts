import { isLocalPath, issue } from "./util";
import type { Rule } from "./types";

function malformed(target: string): boolean {
  if (target.trim() === "") return true;
  if (isLocalPath(target) || !/^(https?|ftp):/i.test(target)) return false;
  if (/\s/.test(target)) return true;
  try {
    return new URL(target).hostname === "";
  } catch {
    return true;
  }
}

export const linkMalformed: Rule = {
  id: "link-malformed",
  category: "links",
  run: (deck) =>
    deck.slides.flatMap((slide) =>
      slide.links
        .filter((l) => l.kind === "external" && malformed(l.target))
        .map((l) => issue("link-malformed", "links", "error", slide, { target: l.target })),
    ),
};
