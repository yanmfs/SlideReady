import { Globe, Loader2 } from "lucide-react";
import { Button } from "../../components/Button";
import { httpUrls } from "../../core/online";
import type { Issue } from "../../core/rules";
import { platform } from "../../platform";
import { useT } from "../../store";
import { allIssues, type Analysis } from "./model";
import { IssueCard } from "./IssueCard";
import { useReport } from "./store";

interface Row {
  slide: number;
  kind: string;
  target: string;
  detail: string;
}

function rowsOf(analysis: Analysis, t: ReturnType<typeof useT>): Row[] {
  const rows: Row[] = [];
  for (const slide of analysis.deck.slides) {
    for (const link of slide.links) {
      rows.push({
        slide: slide.index,
        kind: t(link.kind === "slide-jump" ? "links.kind.jump" : "links.kind.link"),
        target: link.kind === "slide-jump" ? (link.missing ? "?" : link.target) : link.target,
        detail: link.missing ? t("links.missing") : "",
      });
    }
    for (const media of slide.media) {
      const size =
        media.size === undefined ? "" : `${Math.max(1, Math.round(media.size / 1024))} KB`;
      rows.push({
        slide: slide.index,
        kind: t(`links.media.${media.relType}`),
        target: media.target,
        detail: [
          t(media.external ? "links.linked" : "links.embedded"),
          size,
          media.partExists ? "" : t("links.missing"),
        ]
          .filter(Boolean)
          .join(" · "),
      });
    }
  }
  return rows;
}

export function LinksTab({ analysis }: { analysis: Analysis }) {
  const t = useT();
  const checking = useReport((s) => s.checking);
  const urls = httpUrls(analysis.deck);
  const rows = rowsOf(analysis, t);
  const issues: Issue[] = allIssues(analysis).filter(
    (i) => i.category === "links" || i.category === "media",
  );
  const canCheck = platform.checkLinks !== undefined;

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-panel border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold">{t("online.title")}</h2>
        <p className="mt-1 text-sm text-muted">
          {canCheck ? t("online.hint", { count: urls.length }) : t("online.unavailable")}
        </p>
        {canCheck && (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button
              variant="primary"
              disabled={checking || urls.length === 0}
              onClick={() => void useReport.getState().checkOnline()}
            >
              {checking ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Globe className="size-4" aria-hidden />
              )}
              {checking ? t("online.running") : t("online.button")}
            </Button>
            {analysis.online && !checking && (
              <p role="status" className="text-sm text-muted">
                {t("online.done", {
                  checked: analysis.online.probes.length,
                  problems: analysis.online.issues.length,
                })}
              </p>
            )}
          </div>
        )}
      </section>

      {issues.length > 0 && (
        <ul className="flex flex-col gap-2">
          {issues.map((issue, i) => (
            <IssueCard key={`${issue.id}:${issue.slide}:${i}`} issue={issue} />
          ))}
        </ul>
      )}

      {rows.length === 0 ? (
        <p className="text-sm text-muted">{t("links.empty")}</p>
      ) : (
        <div className="overflow-hidden rounded-panel border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-2 text-xs uppercase tracking-wide text-muted">
              <tr>
                <th scope="col" className="px-4 py-2 font-semibold">
                  {t("links.col.slide")}
                </th>
                <th scope="col" className="px-4 py-2 font-semibold">
                  {t("links.col.kind")}
                </th>
                <th scope="col" className="px-4 py-2 font-semibold">
                  {t("links.col.target")}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={`${row.slide}:${i}`} className="border-t border-border align-top">
                  <td className="px-4 py-3 tabular-nums text-muted">{row.slide}</td>
                  <td className="px-4 py-3">{row.kind}</td>
                  <td className="break-all px-4 py-3">
                    {row.target}
                    {row.detail && <span className="block text-xs text-muted">{row.detail}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
