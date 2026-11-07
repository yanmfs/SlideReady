import { issue } from "./util";
import type { Rule } from "./types";

export const deckAspect: Rule = {
  id: "deck-aspect",
  category: "hygiene",
  run: (deck) => {
    if (deck.slideHeight === 0) return [];
    const ratio = deck.slideWidth / deck.slideHeight;
    return Math.abs(ratio - 4 / 3) < 0.02
      ? [issue("deck-aspect", "hygiene", "tip", undefined)]
      : [];
  },
};
