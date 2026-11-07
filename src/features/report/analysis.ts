import { parseDeck } from "../../core/pptx/parse";
import type { Deck } from "../../core/pptx/types";
import { fontUsage, runRules, type FontUse, type Issue, type RuleContext } from "../../core/rules";
import { isLocalPath, localFilePath } from "../../core/rules/util";
import { platform } from "../../platform";

export interface Analysis {
  name: string;
  deck: Deck;
  issues: Issue[];
  fonts: FontUse[];
  fontsKnown: boolean;
}

// Rules are synchronous, so everything they may ask about the machine is looked up first.
async function buildContext(deck: Deck): Promise<{ ctx: RuleContext; fontsKnown: boolean }> {
  const installed = await platform.listFonts().catch(() => null);
  const paths = new Set(
    deck.slides.flatMap((s) =>
      s.media
        .filter((m) => m.external && isLocalPath(m.target))
        .map((m) => localFilePath(m.target)),
    ),
  );
  const existence = new Map<string, boolean | undefined>();
  await Promise.all(
    [...paths].map(async (path) =>
      existence.set(path, await platform.fileExists(path).catch(() => undefined)),
    ),
  );
  return {
    fontsKnown: installed !== null,
    ctx: {
      isFontInstalled: (name) => (installed ? installed.has(name.toLowerCase()) : undefined),
      fileExists: (path) => existence.get(path),
    },
  };
}

export async function analyze(name: string, bytes: Uint8Array): Promise<Analysis> {
  const deck = parseDeck(bytes);
  const { ctx, fontsKnown } = await buildContext(deck);
  return { name, deck, issues: runRules(deck, ctx), fonts: fontUsage(deck, ctx), fontsKnown };
}
