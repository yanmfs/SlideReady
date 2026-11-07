import type { Issue } from "../../core/rules";
import type { Key } from "../../i18n";

// The same issue can read differently depending on what was found; these keys pick the wording.
export function titleKey(issue: Issue): Key {
  if (issue.id === "link-broken-online") {
    return (
      issue.params.kind === "gone" || issue.params.kind === "dns"
        ? "issue.link-broken-online.title"
        : "issue.link-broken-online.title.unconfirmed"
    ) as Key;
  }
  return `issue.${issue.id}.title` as Key;
}

export function bodyKey(issue: Issue): Key {
  const p = issue.params;
  if (issue.id === "font-risky" && p.unknown === 1) return "issue.font-risky.unknown";
  if (issue.id === "media-heavy" && p.deck === 1) return "issue.media-heavy.deck";
  if (issue.id === "media-format" && p.mac !== 1) return "issue.media-format.old";
  if (issue.id === "link-broken-online") return `issue.link-broken-online.${String(p.kind)}` as Key;
  return `issue.${issue.id}.body` as Key;
}

export function extraKeys(issue: Issue): Key[] {
  const p = issue.params;
  const out: Key[] = [];
  if (issue.id === "link-local-file" && p.exposesUser === 1) out.push("issue.link-local-file.user");
  if (issue.id === "media-linked" && p.missing === 1) out.push("issue.media-linked.missing");
  return out;
}
