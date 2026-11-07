import { countBySeverity, type Issue } from "../../core/rules";
import { hasKey, type Key, type Lang } from "../../i18n";
import { allIssues, type Analysis } from "./model";
import { bodyKey, extraKeys, titleKey } from "./issueText";

type Translate = (key: Key, vars?: Record<string, string | number>) => string;

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};
const esc = (value: string | number) => String(value).replace(/[&<>"']/g, (c) => ESCAPES[c] ?? c);

const COLORS = { error: "#b3261e", warning: "#8a5a00", tip: "#5f6368" } as const;

const CSS = `
:root{color-scheme:light dark;--bg:#fff;--text:#1d1d1f;--muted:#5f6368;--line:#d9dbe0;--panel:#f6f7f9}
@media(prefers-color-scheme:dark){:root{--bg:#16171a;--text:#ececef;--muted:#a1a4ab;--line:#33353b;--panel:#1f2024}}
body{margin:0;background:var(--bg);color:var(--text);font:15px/1.5 system-ui,sans-serif}
main{max-width:760px;margin:0 auto;padding:32px 16px}
h1{font-size:22px;margin:0 0 4px}h2{font-size:14px;color:var(--muted);margin:24px 0 8px}
p{margin:0}.meta{color:var(--muted)}
ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
li{border:1px solid var(--line);border-left-width:4px;border-radius:8px;background:var(--panel);padding:12px 14px}
h3{font-size:15px;margin:0}.sev{font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.04em}
details{margin-top:8px}summary{cursor:pointer;font-weight:600}dt{font-size:12px;font-weight:600;color:var(--muted);margin-top:6px}dd{margin:0}
`;

function card(issue: Issue, t: Translate, lang: Lang): string {
  const color = COLORS[issue.severity];
  const fixes = (["win", "mac", "gs"] as const).filter((k) => hasKey(lang, `fix.${issue.id}.${k}`));
  const extras = extraKeys(issue).map((k) => `<p class="meta">${esc(t(k))}</p>`);
  const steps = fixes.length
    ? `<details><summary>${esc(t("issue.howToFix"))}</summary><dl>${fixes
        .map(
          (k) => `<dt>${esc(t(`fix.${k}`))}</dt><dd>${esc(t(`fix.${issue.id}.${k}` as Key))}</dd>`,
        )
        .join("")}</dl></details>`
    : "";
  return `<li style="border-left-color:${color}"><span class="sev" style="color:${color}">${esc(
    t(`severity.${issue.severity}`),
  )}</span><h3>${esc(t(titleKey(issue)))}</h3><p>${esc(
    t(bodyKey(issue), issue.params),
  )}</p>${extras.join("")}${steps}</li>`;
}

function heading(issue: Issue, t: Translate): string {
  if (!issue.slide) return t("issue.wholeDeck");
  return issue.slideTitle
    ? t("issue.slideNamed", { n: issue.slide, title: issue.slideTitle })
    : t("issue.slide", { n: issue.slide });
}

// One file with inline styles and no scripts, so it opens anywhere and can be sent by e-mail.
export function reportHtml(analysis: Analysis, t: Translate, lang: Lang): string {
  const issues = allIssues(analysis);
  const counts = countBySeverity(issues);
  const groups = new Map<string, Issue[]>();
  for (const issue of issues) {
    const key = heading(issue, t);
    groups.set(key, [...(groups.get(key) ?? []), issue]);
  }
  const body = [...groups.entries()]
    .map(
      ([title, list]) =>
        `<section><h2>${esc(title)}</h2><ul>${list.map((i) => card(i, t, lang)).join("")}</ul></section>`,
    )
    .join("");
  const summary = [
    t("summary.errors", { count: counts.error }),
    t("summary.warnings", { count: counts.warning }),
    t("summary.tips", { count: counts.tip }),
  ].join(" · ");
  return `<!doctype html>
<html lang="${esc(lang)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(
    analysis.name,
  )} · SlideReady</title><style>${CSS}</style></head><body><main><h1>${esc(
    analysis.name,
  )}</h1><p class="meta">${esc(t("summary.slides", { count: analysis.deck.slides.length }))} · ${esc(
    summary,
  )}</p>${issues.length === 0 ? `<p>${esc(t("summary.allGood"))}</p>` : body}</main></body></html>
`;
}
