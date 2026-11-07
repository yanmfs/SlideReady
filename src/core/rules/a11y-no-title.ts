import { issue } from "./util";
import type { Rule } from "./types";

export const a11yNoTitle: Rule = {
  id: "a11y-no-title",
  category: "accessibility",
  run: (deck) =>
    deck.slides
      .filter((s) => !s.title)
      .map((s) => issue("a11y-no-title", "accessibility", "tip", s)),
};
