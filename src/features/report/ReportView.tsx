import * as Tabs from "@radix-ui/react-tabs";
import { Check, ClipboardCopy, FileDown, TriangleAlert, X } from "lucide-react";
import { Button } from "../../components/Button";
import { showToast } from "../../toast";
import { countBySeverity } from "../../core/rules";
import { verdictOf, type Verdict } from "../../core/verdict";
import { selectLang, useApp, useT } from "../../store";
import { platform } from "../../platform";
import { allIssues, type Analysis } from "./model";
import { AccessibilityTab } from "./AccessibilityTab";
import { FontsTab } from "./FontsTab";
import { reportHtml } from "./html";
import { LinksTab } from "./LinksTab";
import { reportMarkdown } from "./markdown";
import { IssuesTab } from "./IssuesTab";

const tab =
  "h-9 border-b-2 border-transparent px-4 text-[13px] font-medium text-muted hover:text-text data-[state=active]:border-accent data-[state=active]:text-text";

const MARK: Record<Verdict, { icon: typeof Check; color: string }> = {
  ready: { icon: Check, color: "bg-success text-white" },
  almost: { icon: TriangleAlert, color: "bg-warning text-white" },
  attention: { icon: X, color: "bg-danger text-white" },
};

function aspect(w: number, h: number): string {
  const r = w / h;
  if (Math.abs(r - 16 / 9) < 0.02) return "16:9";
  if (Math.abs(r - 4 / 3) < 0.02) return "4:3";
  if (Math.abs(r - 16 / 10) < 0.02) return "16:10";
  return r.toFixed(2);
}

export function ReportView({ analysis }: { analysis: Analysis }) {
  const t = useT();
  const lang = useApp(selectLang);
  const counts = countBySeverity(allIssues(analysis));
  const bytes = analysis.deck.fileSize;
  const size =
    bytes < 1024 * 1024
      ? `${Math.max(1, Math.round(bytes / 1024))} KB`
      : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  const verdict = verdictOf(allIssues(analysis));
  const Mark = MARK[verdict].icon;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-border bg-surface px-6 py-5">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <span
            aria-hidden
            className={`flex size-12 shrink-0 items-center justify-center rounded-full ${MARK[verdict].color}`}
          >
            <Mark className="size-6" strokeWidth={2.5} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-muted">
              {analysis.name} · {t("summary.slides", { count: analysis.deck.slides.length })} ·{" "}
              {t("summary.aspect", {
                ratio: aspect(analysis.deck.slideWidth, analysis.deck.slideHeight),
              })}{" "}
              · {size}
            </p>
            <h1 className="font-display text-[26px] font-semibold leading-tight tracking-tight">
              {t(`verdict.${verdict}`)}
            </h1>
            <p role="status" className="text-sm text-muted">
              {verdict === "ready"
                ? t("verdict.ready.sub")
                : verdict === "almost"
                  ? t("verdict.almost.sub", { count: counts.warning })
                  : t("verdict.attention.sub", { count: counts.error })}
            </p>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium tabular-nums">
              <span className={counts.error ? "text-danger" : "text-muted"}>
                {t("summary.errors", { count: counts.error })}
              </span>
              <span className={counts.warning ? "text-warning" : "text-muted"}>
                {t("summary.warnings", { count: counts.warning })}
              </span>
              <span className="text-muted">{t("summary.tips", { count: counts.tip })}</span>
              {analysis.changes && (
                <span className="rounded bg-accent-soft px-1.5 py-0.5 text-accent-text">
                  {analysis.changes.resolved === 0 && analysis.changes.added === 0
                    ? t("changes.none")
                    : [
                        analysis.changes.resolved > 0
                          ? t("changes.resolved", { count: analysis.changes.resolved })
                          : null,
                        analysis.changes.added > 0
                          ? t("changes.added", { count: analysis.changes.added })
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() =>
                platform
                  .saveReport(
                    `${analysis.name.replace(/\.pptx$/i, "")} - SlideReady.html`,
                    reportHtml(analysis, t, lang),
                    "text/html",
                  )
                  .then(
                    (saved) => saved && showToast(t("report.saved")),
                    () => showToast(t("report.saveFailed"), "error"),
                  )
              }
            >
              <FileDown className="size-4" aria-hidden />
              {t("report.saveHtml")}
            </Button>
            <Button
              onClick={() =>
                navigator.clipboard.writeText(reportMarkdown(analysis, t)).then(
                  () => showToast(t("report.copied")),
                  () => showToast(t("report.copyFailed"), "error"),
                )
              }
            >
              <ClipboardCopy className="size-4" aria-hidden />
              {t("report.copyMarkdown")}
            </Button>
          </div>
        </div>
        {!analysis.fontsKnown && <p className="mt-3 text-xs text-muted">{t("web.notice")}</p>}
      </div>

      <Tabs.Root defaultValue="issues" className="flex min-h-0 flex-1 flex-col">
        <Tabs.List
          aria-label="SlideReady"
          className="flex shrink-0 gap-1 border-b border-border bg-surface px-4"
        >
          <Tabs.Trigger value="issues" className={tab}>
            {t("tab.issues")}
          </Tabs.Trigger>
          <Tabs.Trigger value="fonts" className={tab}>
            {t("tab.fonts")}
          </Tabs.Trigger>
          <Tabs.Trigger value="links" className={tab}>
            {t("tab.links")}
          </Tabs.Trigger>
          <Tabs.Trigger value="a11y" className={tab}>
            {t("tab.a11y")}
          </Tabs.Trigger>
        </Tabs.List>
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <Tabs.Content value="issues">
            <IssuesTab analysis={analysis} />
          </Tabs.Content>
          <Tabs.Content value="fonts">
            <FontsTab analysis={analysis} />
          </Tabs.Content>
          <Tabs.Content value="links">
            <LinksTab analysis={analysis} />
          </Tabs.Content>
          <Tabs.Content value="a11y">
            <AccessibilityTab analysis={analysis} />
          </Tabs.Content>
          <p className="mt-6 text-xs text-muted">{t("limits.note")}</p>
        </div>
      </Tabs.Root>
    </div>
  );
}
