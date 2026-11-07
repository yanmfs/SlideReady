import { countBySeverity, type Issue } from "../../core/rules";
import type { Key } from "../../i18n";
import type { Analysis } from "./analysis";

type Translate = (key: Key, vars?: Record<string, string | number>) => string;

function bodyKey(issue: Issue): string {
  const p = issue.params;
  if (issue.id === "font-risky" && p.unknown === 1) return "issue.font-risky.unknown";
  if (issue.id === "media-heavy" && p.deck === 1) return "issue.media-heavy.deck";
  if (issue.id === "media-format" && p.mac !== 1) return "issue.media-format.old";
  return `issue.${issue.id}.body`;
}

export function reportMarkdown(analysis: Analysis, t: Translate): string {
  const counts = countBySeverity(analysis.issues);
  const lines = [
    `# ${analysis.name}`,
    "",
    [
      t("summary.errors", { count: counts.error }),
      t("summary.warnings", { count: counts.warning }),
      t("summary.tips", { count: counts.tip }),
    ].join(" · "),
    "",
  ];
  for (const issue of analysis.issues) {
    const where = issue.slide
      ? issue.slideTitle
        ? t("issue.slideNamed", { n: issue.slide, title: issue.slideTitle })
        : t("issue.slide", { n: issue.slide })
      : t("issue.wholeDeck");
    lines.push(
      `- **${t(`severity.${issue.severity}`)}** · ${where}: ${t(`issue.${issue.id}.title` as Key)}`,
      `  ${t(bodyKey(issue) as Key, issue.params)}`,
    );
  }
  return `${lines.join("\n")}\n`;
}
