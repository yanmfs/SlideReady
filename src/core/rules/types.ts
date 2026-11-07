import type { Deck } from "../pptx/types";

export type Severity = "error" | "warning" | "tip";
export type Category =
  "links" | "media" | "fonts" | "text" | "contrast" | "accessibility" | "hygiene";

export interface Issue {
  id: string;
  category: Category;
  severity: Severity;
  slide?: number;
  slideTitle?: string;
  params: Record<string, string | number>;
}

// Answers are `undefined` when the platform cannot tell (the browser demo cannot see fonts or files).
export interface RuleContext {
  isFontInstalled(name: string): boolean | undefined;
  fileExists(path: string): boolean | undefined;
}

export interface Rule {
  id: string;
  category: Category;
  run(deck: Deck, ctx: RuleContext): Issue[];
}
