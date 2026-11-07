import * as Tabs from "@radix-ui/react-tabs";
import { FileText } from "lucide-react";
import { countBySeverity } from "../../core/rules";
import { useT } from "../../store";
import type { Analysis } from "./analysis";
import { FontsTab } from "./FontsTab";
import { IssuesTab } from "./IssuesTab";

const tab =
  "h-9 border-b-2 border-transparent px-4 text-sm data-[state=active]:border-accent data-[state=active]:font-semibold";

function aspect(w: number, h: number): string {
  const r = w / h;
  if (Math.abs(r - 16 / 9) < 0.02) return "16:9";
  if (Math.abs(r - 4 / 3) < 0.02) return "4:3";
  if (Math.abs(r - 16 / 10) < 0.02) return "16:10";
  return r.toFixed(2);
}

export function ReportView({ analysis }: { analysis: Analysis }) {
  const t = useT();
  const counts = countBySeverity(analysis.issues);
  const bytes = analysis.deck.fileSize;
  const size =
    bytes < 1024 * 1024
      ? `${Math.max(1, Math.round(bytes / 1024))} KB`
      : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  const clean = counts.error === 0 && counts.warning === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-border bg-surface px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <FileText aria-hidden className="size-8 shrink-0 text-muted" />
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold">{analysis.name}</h1>
              <p className="text-sm text-muted">
                {t("summary.slides", { count: analysis.deck.slides.length })} ·{" "}
                {t("summary.aspect", {
                  ratio: aspect(analysis.deck.slideWidth, analysis.deck.slideHeight),
                })}{" "}
                · {size}
              </p>
            </div>
          </div>
          <p role="status" className="text-sm font-medium">
            {clean && counts.tip === 0
              ? t("summary.allGood")
              : [
                  t("summary.errors", { count: counts.error }),
                  t("summary.warnings", { count: counts.warning }),
                  t("summary.tips", { count: counts.tip }),
                ].join(" · ")}
          </p>
        </div>
        {!analysis.fontsKnown && <p className="mt-2 text-xs text-muted">{t("web.notice")}</p>}
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
        </Tabs.List>
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <Tabs.Content value="issues">
            <IssuesTab analysis={analysis} />
          </Tabs.Content>
          <Tabs.Content value="fonts">
            <FontsTab analysis={analysis} />
          </Tabs.Content>
          <p className="mt-6 text-xs text-muted">{t("limits.note")}</p>
        </div>
      </Tabs.Root>
    </div>
  );
}
