import { fontUsage } from "./fonts";
import { issue } from "./util";
import type { Rule } from "./types";

const LIMIT = 3;

export const fontsMany: Rule = {
  id: "fonts-many",
  category: "fonts",
  run: (deck, ctx) => {
    const names = fontUsage(deck, ctx).map((f) => f.name);
    return names.length > LIMIT
      ? [
          issue("fonts-many", "fonts", "tip", undefined, {
            count: names.length,
            names: names.slice(0, 6).join(", "),
          }),
        ]
      : [];
  },
};
