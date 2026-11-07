import { findPlaceholder } from "./text-placeholder";
import { issue } from "./util";
import type { Rule } from "./types";

// Speaker notes travel with the file and show up when the deck is printed with notes.
export const notesPlaceholder: Rule = {
  id: "notes-placeholder",
  category: "hygiene",
  run: (deck) =>
    deck.slides.flatMap((slide) => {
      const found = findPlaceholder(slide.notes);
      return found
        ? [issue("notes-placeholder", "hygiene", "warning", slide, { sample: found })]
        : [];
    }),
};
