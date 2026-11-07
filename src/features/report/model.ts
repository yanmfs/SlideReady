import type { LinkProbe } from "../../core/online";
import type { Deck } from "../../core/pptx/types";
import { sortIssues, type FontUse, type Issue } from "../../core/rules";

export interface Analysis {
  name: string;
  deck: Deck;
  issues: Issue[];
  fonts: FontUse[];
  fontsKnown: boolean;
  // Set when the file was saved again while open: what the new analysis fixed and what it added.
  changes?: { resolved: number; added: number };
  // Filled only after the person asks for the online link check.
  online?: { probes: LinkProbe[]; issues: Issue[] };
}

export const allIssues = (analysis: Analysis): Issue[] =>
  analysis.online ? sortIssues([...analysis.issues, ...analysis.online.issues]) : analysis.issues;
