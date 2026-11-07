import type { Issue } from "./rules";
import { countBySeverity } from "./rules";

export type Verdict = "ready" | "almost" | "attention";

// One word for the whole deck: nothing in the way, a few things worth a look, or something that
// will go wrong on stage. Tips never change it; they are suggestions.
export function verdictOf(issues: Issue[]): Verdict {
  const counts = countBySeverity(issues);
  if (counts.error > 0) return "attention";
  return counts.warning > 0 ? "almost" : "ready";
}

const keyOf = (issue: Issue) => `${issue.id}|${issue.slide ?? 0}|${JSON.stringify(issue.params)}`;

// What a new analysis changed compared with the one before it.
export function compareIssues(
  before: Issue[],
  after: Issue[],
): { resolved: number; added: number } {
  const was = new Map<string, number>();
  for (const issue of before) was.set(keyOf(issue), (was.get(keyOf(issue)) ?? 0) + 1);
  const now = new Map<string, number>();
  for (const issue of after) now.set(keyOf(issue), (now.get(keyOf(issue)) ?? 0) + 1);
  let resolved = 0;
  let added = 0;
  for (const [key, count] of was) resolved += Math.max(0, count - (now.get(key) ?? 0));
  for (const [key, count] of now) added += Math.max(0, count - (was.get(key) ?? 0));
  return { resolved, added };
}
