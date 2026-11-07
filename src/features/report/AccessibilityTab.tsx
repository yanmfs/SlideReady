import { useT } from "../../store";
import { allIssues, type Analysis } from "./model";
import { IssueCard } from "./IssueCard";

export function AccessibilityTab({ analysis }: { analysis: Analysis }) {
  const t = useT();
  const { slides } = analysis.deck;
  const pictures = slides.flatMap((s) => s.pictures);
  const withoutAlt = pictures.filter((p) => !p.hasAlt && !p.decorative).length;
  const stats = [
    { label: t("a11y.stat.pictures"), value: pictures.length },
    { label: t("a11y.stat.noAlt"), value: withoutAlt },
    { label: t("a11y.stat.noTitle"), value: slides.filter((s) => !s.title).length },
    { label: t("a11y.stat.tables"), value: slides.reduce((n, s) => n + s.tables.length, 0) },
  ];
  const issues = allIssues(analysis).filter((i) => i.category === "accessibility");

  return (
    <div className="flex flex-col gap-5">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-panel border border-border bg-surface p-4">
            <dt className="text-xs text-muted">{stat.label}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums">{stat.value}</dd>
          </div>
        ))}
      </dl>
      {issues.length === 0 ? (
        <p className="rounded-panel border border-dashed border-border p-6 text-center text-sm text-muted">
          {t("a11y.allGood")}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {issues.map((issue, i) => (
            <IssueCard key={`${issue.id}:${issue.slide}:${i}`} issue={issue} />
          ))}
        </ul>
      )}
    </div>
  );
}
