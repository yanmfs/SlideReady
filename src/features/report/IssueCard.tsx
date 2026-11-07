import { ChevronDown, CircleX, Lightbulb, TriangleAlert } from "lucide-react";
import { useState } from "react";
import type { Issue, Severity } from "../../core/rules";
import { hasKey, type Key } from "../../i18n";
import { selectLang, useApp, useT } from "../../store";

const STYLE: Record<Severity, { icon: typeof CircleX; text: string; border: string }> = {
  error: { icon: CircleX, text: "text-danger", border: "border-l-danger" },
  warning: { icon: TriangleAlert, text: "text-warning", border: "border-l-warning" },
  tip: { icon: Lightbulb, text: "text-muted", border: "border-l-border" },
};

const PLATFORMS = ["win", "mac", "gs"] as const;

export function IssueCard({ issue }: { issue: Issue }) {
  const t = useT();
  const lang = useApp(selectLang);
  const [open, setOpen] = useState(false);
  const { icon: Icon, text, border } = STYLE[issue.severity];
  const p = issue.params;

  const bodyKey =
    (issue.id === "font-risky" && p.unknown === 1 ? "issue.font-risky.unknown" : null) ??
    (issue.id === "media-heavy" && p.deck === 1 ? "issue.media-heavy.deck" : null) ??
    (issue.id === "media-format" && p.mac !== 1 ? "issue.media-format.old" : null) ??
    `issue.${issue.id}.body`;
  const extras = [
    issue.id === "link-local-file" && p.exposesUser === 1 ? t("issue.link-local-file.user") : null,
    issue.id === "media-linked" && p.missing === 1 ? t("issue.media-linked.missing") : null,
  ].filter(Boolean);

  const fixes = PLATFORMS.filter((k) => hasKey(lang, `fix.${issue.id}.${k}`));

  return (
    <li className={`rounded-panel border border-l-4 border-border bg-surface p-4 ${border}`}>
      <div className="flex items-start gap-3">
        <Icon aria-hidden className={`mt-0.5 size-5 shrink-0 ${text}`} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2">
            <span className={`text-xs font-semibold uppercase tracking-wide ${text}`}>
              {t(`severity.${issue.severity}`)}
            </span>
            <h3 className="text-sm font-semibold">{t(`issue.${issue.id}.title` as Key)}</h3>
          </div>
          <p className="mt-1 text-sm">{t(bodyKey as Key, p)}</p>
          {extras.map((line) => (
            <p key={line} className="mt-1 text-sm text-muted">
              {line}
            </p>
          ))}
          {fixes.length > 0 && (
            <div className="mt-2">
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpen((o) => !o)}
                className="inline-flex items-center gap-1 text-sm font-medium text-accent-text"
              >
                {t("issue.howToFix")}
                <ChevronDown
                  aria-hidden
                  className={`size-4 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
                />
              </button>
              {open && (
                <dl className="mt-2 flex flex-col gap-2 rounded-control bg-surface-2 p-3 text-sm">
                  {fixes.map((k) => (
                    <div key={k}>
                      <dt className="text-xs font-semibold text-muted">{t(`fix.${k}`)}</dt>
                      <dd>{t(`fix.${issue.id}.${k}` as Key)}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
