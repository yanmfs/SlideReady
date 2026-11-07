import type { Deck } from "../pptx/types";
import { a11yAltText } from "./a11y-alt-text";
import { a11yDuplicateTitle } from "./a11y-duplicate-title";
import { a11yNoTitle } from "./a11y-no-title";
import { a11yTableHeader } from "./a11y-table-header";
import { contrast } from "./contrast";
import { deckAspect } from "./deck-aspect";
import { fontNotEmbedded, fontRisky } from "./fonts";
import { hygieneComments } from "./hygiene-comments";
import { hygieneHidden } from "./hygiene-hidden";
import { hygieneMetadata } from "./hygiene-metadata";
import { hygieneOffSlide } from "./hygiene-off-slide";
import { linkLocalFile } from "./link-local-file";
import { linkMalformed } from "./link-malformed";
import { linkSlideJump } from "./link-slide-jump";
import { mediaFormat } from "./media-format";
import { mediaHeavy } from "./media-heavy";
import { mediaLinked } from "./media-linked";
import { mediaMissingPart } from "./media-missing-part";
import { textAutofitShrink } from "./text-autofit-shrink";
import { textDense } from "./text-dense";
import { textPlaceholder } from "./text-placeholder";
import { textSmall } from "./text-small";
import type { Issue, Rule, RuleContext, Severity } from "./types";

export type { Category, Issue, Rule, RuleContext, Severity } from "./types";
export { contrastRatio } from "./contrast";
export { fontUsage, type FontStatus, type FontUse } from "./fonts";

export const rules: Rule[] = [
  linkLocalFile,
  linkMalformed,
  linkSlideJump,
  mediaLinked,
  mediaMissingPart,
  mediaFormat,
  mediaHeavy,
  fontNotEmbedded,
  fontRisky,
  textPlaceholder,
  textSmall,
  textAutofitShrink,
  textDense,
  contrast,
  a11yAltText,
  a11yNoTitle,
  a11yDuplicateTitle,
  a11yTableHeader,
  hygieneHidden,
  hygieneComments,
  hygieneMetadata,
  hygieneOffSlide,
  deckAspect,
];

const WEIGHT: Record<Severity, number> = { error: 0, warning: 1, tip: 2 };

export const sortIssues = (issues: Issue[]): Issue[] =>
  [...issues].sort(
    (a, b) => (a.slide ?? 0) - (b.slide ?? 0) || WEIGHT[a.severity] - WEIGHT[b.severity],
  );

export function runRules(deck: Deck, ctx: RuleContext): Issue[] {
  return sortIssues(rules.flatMap((rule) => rule.run(deck, ctx)));
}

export function countBySeverity(issues: Issue[]): Record<Severity, number> {
  const out: Record<Severity, number> = { error: 0, warning: 0, tip: 0 };
  for (const i of issues) out[i.severity]++;
  return out;
}
