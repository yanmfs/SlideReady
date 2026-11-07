import { beforeAll, describe, expect, it } from "vitest";
import { buildDecks } from "../scripts/make-decks.mjs";
import { classify, httpUrls, onlineIssues, type LinkProbe } from "../src/core/online";
import { parseDeck } from "../src/core/pptx/parse";
import type { Deck } from "../src/core/pptx/types";

let deck: Deck;
beforeAll(async () => {
  deck = parseDeck((await buildDecks())["link-ok"]!);
}, 60_000);

const probe = (status: number | null, failure: LinkProbe["failure"] = null): LinkProbe => ({
  url: "x",
  status,
  failure,
});

describe("classify", () => {
  it("calls 404, 410 and unknown domains broken", () => {
    expect(classify(probe(404))).toBe("gone");
    expect(classify(probe(410))).toBe("gone");
    expect(classify(probe(null, "dns"))).toBe("dns");
  });

  it("only leaves the rest unconfirmed because sites refuse bots", () => {
    for (const status of [401, 403, 405, 429, 500, 503]) {
      expect(classify(probe(status))).toBe("unconfirmed");
    }
    expect(classify(probe(null, "other"))).toBe("unconfirmed");
    expect(classify(probe(null, "timeout"))).toBe("timeout");
  });

  it("accepts successes and redirects", () => {
    expect(classify(probe(200))).toBeNull();
    expect(classify(probe(301))).toBeNull();
  });
});

describe("online issues", () => {
  it("lists each web address once", () => {
    const urls = httpUrls(deck);
    expect(urls.length).toBeGreaterThan(0);
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls.every((u) => /^https?:/.test(u))).toBe(true);
  });

  it("raises errors for broken links and warnings for unconfirmed ones", () => {
    const [first, second] = httpUrls(deck);
    const probes: LinkProbe[] = [
      { url: first!, status: 404, failure: null },
      ...(second ? [{ url: second, status: 403, failure: null }] : []),
    ];
    const issues = onlineIssues(deck, probes);
    expect(issues[0]).toMatchObject({ id: "link-broken-online", severity: "error" });
    if (second) expect(issues.some((i) => i.severity === "warning")).toBe(true);
  });

  it("reports nothing when every link answers", () => {
    const probes = httpUrls(deck).map((url) => ({ url, status: 200, failure: null }));
    expect(onlineIssues(deck, probes)).toEqual([]);
  });
});
