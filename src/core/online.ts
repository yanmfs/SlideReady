import type { Deck } from "./pptx/types";
import type { Issue } from "./rules";

export type ProbeFailure = "dns" | "timeout" | "other";

export interface LinkProbe {
  url: string;
  status: number | null;
  failure: ProbeFailure | null;
}

export type OnlineKind = "gone" | "dns" | "unconfirmed" | "timeout";

const isHttp = (target: string) => /^https?:\/\//i.test(target);

// Unique http(s) addresses in the order the slides use them.
export function httpUrls(deck: Deck): string[] {
  const seen = new Set<string>();
  for (const slide of deck.slides) {
    for (const link of slide.links) {
      if (link.kind === "external" && isHttp(link.target)) seen.add(link.target);
    }
  }
  return [...seen];
}

// 404/410 and unknown domains are broken; anything else that is not a success is only unconfirmed,
// because many sites answer bots with 403 or 429 while working fine for people.
export function classify(probe: LinkProbe): OnlineKind | null {
  if (probe.failure === "dns") return "dns";
  if (probe.failure === "timeout") return "timeout";
  if (probe.failure !== null || probe.status === null) return "unconfirmed";
  if (probe.status === 404 || probe.status === 410) return "gone";
  return probe.status >= 400 ? "unconfirmed" : null;
}

export function onlineIssues(deck: Deck, probes: LinkProbe[]): Issue[] {
  const byUrl = new Map(probes.map((p) => [p.url, p]));
  const issues: Issue[] = [];
  for (const slide of deck.slides) {
    const done = new Set<string>();
    for (const link of slide.links) {
      const probe = byUrl.get(link.target);
      if (!probe || done.has(link.target)) continue;
      done.add(link.target);
      const kind = classify(probe);
      if (!kind) continue;
      issues.push({
        id: "link-broken-online",
        category: "links",
        severity: kind === "gone" || kind === "dns" ? "error" : "warning",
        slide: slide.index,
        slideTitle: slide.title,
        params: { url: link.target, status: probe.status ?? 0, kind },
      });
    }
  }
  return issues;
}
