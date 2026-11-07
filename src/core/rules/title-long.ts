import { issue } from "./util";
import type { Rule } from "./types";

// Past this a title wraps to three lines on most layouts and is hard to take in from the back of a room.
const LIMIT = 90;

export const titleLong: Rule = {
  id: "title-long",
  category: "text",
  run: (deck) =>
    deck.slides.flatMap((slide) =>
      slide.title && slide.title.length > LIMIT
        ? [issue("title-long", "text", "tip", slide, { length: slide.title.length })]
        : [],
    ),
};
