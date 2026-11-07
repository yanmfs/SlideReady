import { issue } from "./util";
import type { Rule } from "./types";

export const a11yTableHeader: Rule = {
  id: "a11y-table-header",
  category: "accessibility",
  run: (deck) =>
    deck.slides.flatMap((slide) =>
      slide.tables.some((t) => !t.hasHeader)
        ? [issue("a11y-table-header", "accessibility", "tip", slide)]
        : [],
    ),
};
