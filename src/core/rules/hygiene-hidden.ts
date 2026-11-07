import { issue } from "./util";
import type { Rule } from "./types";

export const hygieneHidden: Rule = {
  id: "hygiene-hidden",
  category: "hygiene",
  run: (deck) =>
    deck.slides.filter((s) => s.hidden).map((s) => issue("hygiene-hidden", "hygiene", "tip", s)),
};
