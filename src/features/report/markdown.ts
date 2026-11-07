import { countBySeverity } from "../../core/rules";
import type { Key } from "../../i18n";
import { allIssues, type Analysis } from "./model";
import { bodyKey, titleKey } from "./issueText";

type Translate = (key: Key, vars?: Record<string, string | number>) => string;

export function reportMarkdown(analysis: Analysis, t: Translate): string {
  const counts = countBySeverity(allIssues(analysis));
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
  for (const issue of allIssues(analysis)) {
    const where = issue.slide
      ? issue.slideTitle
        ? t("issue.slideNamed", { n: issue.slide, title: issue.slideTitle })
        : t("issue.slide", { n: issue.slide })
      : t("issue.wholeDeck");
    lines.push(
      `- **${t(`severity.${issue.severity}`)}** · ${where}: ${t(titleKey(issue))}`,
      `  ${t(bodyKey(issue), issue.params)}`,
    );
  }
  return `${lines.join("\n")}\n`;
}
