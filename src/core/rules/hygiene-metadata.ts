import { issue } from "./util";
import type { Rule } from "./types";

export const hygieneMetadata: Rule = {
  id: "hygiene-metadata",
  category: "hygiene",
  run: (deck) => {
    const people = [...new Set([deck.author, deck.lastModifiedBy].filter((v): v is string => !!v))];
    return people.length === 0
      ? []
      : [issue("hygiene-metadata", "hygiene", "tip", undefined, { people: people.join(", ") })];
  },
};
