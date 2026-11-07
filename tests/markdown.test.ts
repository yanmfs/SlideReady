import { describe, expect, it } from "vitest";
import { parseDeck } from "../src/core/pptx/parse";
import { runRules } from "../src/core/rules";
import { buildDecks } from "../scripts/make-decks.mjs";
import type { Analysis } from "../src/features/report/analysis";
import { reportMarkdown } from "../src/features/report/markdown";
import { translate } from "../src/i18n";

describe("reportMarkdown", () => {
  it("lists every issue with its slide and message", async () => {
    const deck = parseDeck((await buildDecks())["text-placeholder"]!);
    const issues = runRules(deck, { isFontInstalled: () => true, fileExists: () => true });
    const analysis: Analysis = { name: "demo.pptx", deck, issues, fonts: [], fontsKnown: true };
    const md = reportMarkdown(analysis, (key, vars) => translate("pt-BR", key, vars));
    expect(md).toContain("# demo.pptx");
    expect(md).toContain("1 erro");
    expect(md).toContain("- **Erro** · Slide 1 · Visão geral: Texto provisório esquecido");
    expect(md).toContain('O slide ainda tem "Lorem ipsum".');
  });
});
