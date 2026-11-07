import { issue } from "./util";
import type { Rule } from "./types";

export const hygieneComments: Rule = {
  id: "hygiene-comments",
  category: "hygiene",
  run: (deck) => {
    const withComments = deck.slides.filter((s) => s.commentCount > 0);
    if (withComments.length === 0) return [];
    const total = withComments.reduce((n, s) => n + s.commentCount, 0);
    return [
      issue("hygiene-comments", "hygiene", "tip", undefined, {
        count: total,
        slides: withComments.map((s) => s.index).join(", "),
      }),
    ];
  },
};
