import { beforeAll, describe, expect, it } from "vitest";
import { buildDecks } from "../scripts/make-decks.mjs";
import { parseDeck } from "../src/core/pptx/parse";
import {
  countBySeverity,
  fontUsage,
  runRules,
  type Issue,
  type RuleContext,
} from "../src/core/rules";

let decks: Record<string, Uint8Array>;
beforeAll(async () => {
  decks = await buildDecks();
}, 60_000);

const known: RuleContext = {
  isFontInstalled: (name) => ["arial", "helvetica neue", "calibri"].includes(name.toLowerCase()),
  fileExists: () => false,
};
const unknown: RuleContext = { isFontInstalled: () => undefined, fileExists: () => undefined };

const run = (name: string, ctx: RuleContext = known): Issue[] =>
  runRules(parseDeck(decks[name]!), ctx);
const ids = (issues: Issue[]) => issues.map((i) => i.id);

describe("the clean deck", () => {
  it("raises no errors or warnings", () => {
    const issues = run("clean");
    expect(issues.filter((i) => i.severity !== "tip")).toEqual([]);
  });

  it("keeps links and slide jumps that are fine", () => {
    expect(run("link-ok").filter((i) => i.severity !== "tip")).toEqual([]);
  });
});

describe("links", () => {
  it("flags links to local files and says when the path exposes a user name", () => {
    const issues = run("link-local-file").filter((i) => i.id === "link-local-file");
    expect(issues).toHaveLength(2);
    expect(issues[0]?.severity).toBe("error");
    expect(issues.map((i) => i.params.exposesUser)).toEqual([1, 0]);
    expect(issues[0]?.params.target).toBe("C:/Users/ana/Documents/planilha.xlsx");
  });

  it("flags malformed URLs", () => {
    expect(ids(run("link-malformed"))).toContain("link-malformed");
  });

  it("flags a jump to a slide that does not exist", () => {
    expect(ids(run("link-slide-jump"))).toContain("link-slide-jump");
  });
});

describe("media", () => {
  it("flags linked media and escalates when the file is missing here", () => {
    const missing = run("media-linked").find((i) => i.id === "media-linked");
    expect(missing?.severity).toBe("error");
    const present = runRules(parseDeck(decks["media-linked"]!), {
      ...known,
      fileExists: () => true,
    }).find((i) => i.id === "media-linked");
    expect(present?.severity).toBe("warning");
    const unsure = runRules(parseDeck(decks["media-linked"]!), unknown).find(
      (i) => i.id === "media-linked",
    );
    expect(unsure?.severity).toBe("warning");
  });

  it("flags a picture whose part is missing from the file", () => {
    expect(ids(run("media-missing-part"))).toContain("media-missing-part");
  });

  it("flags video formats that fail on a Mac", () => {
    const issue = run("media-format").find((i) => i.id === "media-format");
    expect(issue?.params).toEqual({ format: "wmv", mac: 1 });
  });

  it("flags heavy media without decompressing it", () => {
    const issue = run("media-heavy").find((i) => i.id === "media-heavy");
    expect(issue?.params.size).toBe(21);
  });
});

describe("fonts", () => {
  it("flags a font that is neither embedded nor installed as an error", () => {
    const issue = run("font-missing").find((i) => i.id === "font-not-embedded");
    expect(issue?.severity).toBe("error");
    expect(issue?.params.font).toBe("Zorblax Display");
  });

  it("flags an installed but unsafe font as a warning", () => {
    const issue = run("font-risky").find((i) => i.id === "font-risky");
    expect(issue?.severity).toBe("warning");
    expect(issue?.params.font).toBe("Helvetica Neue");
  });

  it("does not flag an embedded font", () => {
    expect(ids(run("font-embedded"))).not.toContain("font-not-embedded");
  });

  it("downgrades to a warning when the installed fonts are unknown", () => {
    const found = ids(run("font-missing", unknown));
    expect(found).toContain("font-risky");
    expect(found).not.toContain("font-not-embedded");
  });

  it("lists what is used, with status", () => {
    const usage = fontUsage(parseDeck(decks["font-missing"]!), known);
    expect(usage.find((f) => f.name === "Arial")?.status).toBe("safe");
    expect(usage.find((f) => f.name === "Zorblax Display")?.status).toBe("missing");
  });
});

describe("text", () => {
  it("flags placeholder text", () => {
    expect(run("text-placeholder").find((i) => i.id === "text-placeholder")?.params.sample).toBe(
      "Lorem ipsum",
    );
  });

  it("flags small text as a warning and tiny text as an error", () => {
    expect(run("text-small").find((i) => i.id === "text-small")?.severity).toBe("warning");
    expect(run("text-tiny").find((i) => i.id === "text-small")?.severity).toBe("error");
  });

  it("resolves sizes inherited from the shape's list style", () => {
    const issue = run("text-inherited").find((i) => i.id === "text-small");
    expect(issue?.params.size).toBe(10);
  });

  it("flags text shrunk by autofit and scales the effective size", () => {
    const found = run("text-autofit");
    expect(found.find((i) => i.id === "text-autofit-shrink")?.params.percent).toBe(63);
    expect(found.find((i) => i.id === "text-small")?.params.size).toBe(15);
  });

  it("flags slides with too many words", () => {
    expect(run("text-dense").find((i) => i.id === "text-dense")?.severity).toBe("tip");
  });
});

describe("accessibility and hygiene", () => {
  it("flags pictures without alternative text, unless decorative", () => {
    expect(ids(run("a11y-alt-missing"))).toContain("a11y-alt-text");
    expect(ids(run("a11y-decorative"))).not.toContain("a11y-alt-text");
  });

  it("flags slides without a title and repeated titles", () => {
    expect(run("a11y-no-title").find((i) => i.id === "a11y-no-title")?.slide).toBe(1);
    const dup = run("a11y-duplicate-title").find((i) => i.id === "a11y-duplicate-title");
    expect(dup?.slide).toBe(3);
    expect(dup?.params.first).toBe(1);
  });

  it("flags tables without a header row", () => {
    expect(ids(run("a11y-table-header"))).toContain("a11y-table-header");
    expect(ids(run("a11y-table-ok"))).not.toContain("a11y-table-header");
  });

  it("flags hidden slides, comments and 4:3 decks", () => {
    expect(run("hygiene-hidden").find((i) => i.id === "hygiene-hidden")?.slide).toBe(2);
    expect(run("hygiene-comments").find((i) => i.id === "hygiene-comments")?.params.count).toBe(1);
    expect(ids(run("deck-aspect"))).toContain("deck-aspect");
  });
});

describe("slide content", () => {
  it("flags a slide with nothing on it, but not one with content", () => {
    const empty = run("slide-empty").filter((i) => i.id === "slide-empty");
    expect(empty.map((i) => i.slide)).toEqual([2]);
    expect(ids(run("clean"))).not.toContain("slide-empty");
  });

  it("does not call a slide with only shapes empty", () => {
    const deck = parseDeck(decks["off-slide"]!);
    expect(deck.slides.every((s) => s.contentCount > 0)).toBe(true);
  });

  it("tips when a title is too long to take in", () => {
    const issue = run("title-long").find((i) => i.id === "title-long");
    expect(issue?.severity).toBe("tip");
    expect(Number(issue?.params.length)).toBeGreaterThan(90);
    expect(ids(run("clean"))).not.toContain("title-long");
  });

  it("flags placeholder text left in the speaker notes", () => {
    const issue = run("notes-placeholder").find((i) => i.id === "notes-placeholder");
    expect(issue?.params.sample).toBe("TODO");
    expect(parseDeck(decks["notes-placeholder"]!).slides[0]?.notes).toContain("orçamento");
    expect(ids(run("clean"))).not.toContain("notes-placeholder");
  });

  it("tips when more than three fonts are in use", () => {
    const issue = run("fonts-many").find((i) => i.id === "fonts-many");
    expect(issue?.params.count).toBe(5);
    expect(ids(run("clean"))).not.toContain("fonts-many");
  });
});

describe("contrast and file hygiene", () => {
  it("warns below 4.5:1 and fails below 3:1", () => {
    const warn = run("contrast-warning").find((i) => i.id === "contrast");
    expect(warn?.severity).toBe("warning");
    expect(warn?.params.ratio).toBe(3.5);
    expect(run("contrast-error").find((i) => i.id === "contrast")?.severity).toBe("error");
  });

  it("uses the fill of the shape drawn behind the text", () => {
    expect(ids(run("contrast-dark-panel"))).not.toContain("contrast");
  });

  it("finds shapes outside the slide", () => {
    const issue = run("off-slide").find((i) => i.id === "hygiene-off-slide");
    expect(issue?.slide).toBe(1);
    expect(issue?.params.count).toBe(1);
  });

  it("reports author metadata as a tip", () => {
    const issue = run("metadata").find((i) => i.id === "hygiene-metadata");
    expect(issue?.severity).toBe("tip");
    expect(issue?.params.people).toBe("Maria Fictícia");
  });
});

describe("parser", () => {
  it("follows the slide list instead of the file names", () => {
    const deck = parseDeck(decks.shuffled!);
    expect(deck.slides.map((s) => s.title)).toEqual([
      "C terceiro no arquivo",
      "A primeiro no arquivo",
      "B segundo no arquivo",
    ]);
    expect(deck.slides.map((s) => s.index)).toEqual([1, 2, 3]);
  });

  it("uses the Choice branch of alternate content when its namespace is known", () => {
    expect(ids(run("alternate-content"))).not.toContain("a11y-alt-text");
  });

  it("reads deck facts", () => {
    const deck = parseDeck(decks.clean!);
    expect(deck.slides).toHaveLength(2);
    expect(deck.slideWidth / deck.slideHeight).toBeCloseTo(16 / 9, 1);
    expect(deck.fileSize).toBe(decks.clean!.length);
  });

  it("counts issues by severity", () => {
    const counts = countBySeverity(run("text-tiny"));
    expect(counts.error).toBeGreaterThanOrEqual(1);
  });
});
