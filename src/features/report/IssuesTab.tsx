import { useMemo, useState } from "react";
import { Select } from "../../components/Select";
import type { Category, Issue, Severity } from "../../core/rules";
import { useT } from "../../store";
import { allIssues, type Analysis } from "./model";
import { IssueCard } from "./IssueCard";

const SEVERITIES: Severity[] = ["error", "warning", "tip"];
const CATEGORIES: Category[] = ["links", "media", "fonts", "text", "accessibility", "hygiene"];

export function IssuesTab({ analysis }: { analysis: Analysis }) {
  const t = useT();
  const [severity, setSeverity] = useState<Severity | "all">("all");
  const [category, setCategory] = useState<Category | "all">("all");

  const issues = useMemo(() => allIssues(analysis), [analysis]);
  const counts = useMemo(
    () =>
      Object.fromEntries(SEVERITIES.map((s) => [s, issues.filter((i) => i.severity === s).length])),
    [issues],
  );
  const shown = issues.filter(
    (i) =>
      (severity === "all" || i.severity === severity) &&
      (category === "all" || i.category === category),
  );

  const groups = new Map<number | undefined, Issue[]>();
  for (const issue of shown) groups.set(issue.slide, [...(groups.get(issue.slide) ?? []), issue]);
  const ordered = [...groups.entries()].sort(([a], [b]) => (a ?? 0) - (b ?? 0));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div role="group" aria-label={t("filter.severity")} className="flex gap-2">
          {(["all", ...SEVERITIES] as const).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={severity === s}
              onClick={() => setSeverity(s)}
              className={`h-8 rounded-full border px-3 text-sm ${severity === s ? "border-accent bg-accent text-accent-contrast" : "border-border bg-surface hover:bg-surface-2"}`}
            >
              {s === "all" ? t("filter.all") : `${t(`severity.${s}`)} · ${counts[s]}`}
            </button>
          ))}
        </div>
        <div className="w-48">
          <Select
            label={t("filter.category")}
            value={category}
            onChange={(v) => setCategory(v as Category | "all")}
          >
            <option value="all">{t("filter.all")}</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`category.${c}`)}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {shown.length === 0 && (
        <p className="rounded-panel border border-dashed border-border p-6 text-center text-sm text-muted">
          {issues.length === 0 ? t("summary.allGood") : t("filter.noResults")}
        </p>
      )}

      {ordered.map(([slide, issues]) => {
        const title = issues[0]?.slideTitle;
        return (
          <section
            key={slide ?? "deck"}
            aria-label={slide ? t("issue.slide", { n: slide }) : t("issue.wholeDeck")}
          >
            <h2 className="mb-2 text-sm font-semibold text-muted">
              {slide
                ? title
                  ? t("issue.slideNamed", { n: slide, title })
                  : t("issue.slide", { n: slide })
                : t("issue.wholeDeck")}
            </h2>
            <ul className="flex flex-col gap-2">
              {issues.map((issue, i) => (
                <IssueCard key={`${issue.id}:${i}`} issue={issue} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
