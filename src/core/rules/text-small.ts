import { issue } from "./util";
import type { Rule } from "./types";

export const textSmall: Rule = {
  id: "text-small",
  category: "text",
  run: (deck) =>
    deck.slides.flatMap((slide) => {
      let smallest: number | undefined;
      let count = 0;
      let isError = false;
      for (const text of slide.texts) {
        if (text.kind === "footer") continue;
        const limit = text.inTable ? 12 : 18;
        for (const p of text.paragraphs) {
          for (const run of p.runs) {
            if (run.size === undefined || run.text.trim().length < 2 || run.size >= limit) continue;
            count++;
            smallest = Math.min(smallest ?? run.size, run.size);
            if (!text.inTable && run.size < 12) isError = true;
          }
        }
      }
      if (smallest === undefined) return [];
      return [
        issue("text-small", "text", isError ? "error" : "warning", slide, {
          size: Math.round(smallest * 10) / 10,
          count,
        }),
      ];
    }),
};
