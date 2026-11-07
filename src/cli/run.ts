import { countBySeverity, runRules, type Issue, type Severity } from "../core/rules";
import { parseDeck } from "../core/pptx/parse";
import { resolveLang, translate, type Lang } from "../i18n";
import { bodyKey, titleKey } from "../features/report/issueText";

export interface CliIo {
  readFile(path: string): Uint8Array;
  fileExists(path: string): boolean;
  out(text: string): void;
  err(text: string): void;
}

const USAGE = `Usage: slideready check <file.pptx> [--json] [--lang pt-BR|en] [--fail-on error|warning|never]

Checks a .pptx without changing it. Exit code 0 when nothing reaches --fail-on (default: error),
1 when something does, 2 when the file cannot be read or the arguments are wrong.
Installed fonts cannot be listed from here, so font findings are limited to what the file says.`;

interface Args {
  file: string;
  json: boolean;
  lang: Lang;
  failOn: "error" | "warning" | "never";
}

function parseArgs(argv: string[]): Args | string {
  const [command, ...rest] = argv;
  if (command !== "check") return USAGE;
  let file: string | undefined;
  let json = false;
  let lang: Lang = resolveLang("auto", process.env.LANG ?? "en");
  let failOn: Args["failOn"] = "error";
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i]!;
    if (arg === "--json") json = true;
    else if (arg === "--lang") {
      const value = rest[++i];
      if (value !== "pt-BR" && value !== "en") return USAGE;
      lang = value;
    } else if (arg === "--fail-on") {
      const value = rest[++i];
      if (value !== "error" && value !== "warning" && value !== "never") return USAGE;
      failOn = value;
    } else if (arg.startsWith("-")) return USAGE;
    else if (file === undefined) file = arg;
    else return USAGE;
  }
  return file ? { file, json, lang, failOn } : USAGE;
}

const RANK: Record<Severity, number> = { error: 0, warning: 1, tip: 2 };
const reaches = (issues: Issue[], failOn: Args["failOn"]) =>
  failOn !== "never" && issues.some((i) => RANK[i.severity] <= RANK[failOn]);

// Same core as the app. It cannot list installed fonts, so it only answers about files on disk.
export function runCli(argv: string[], io: CliIo): number {
  const args = parseArgs(argv);
  if (typeof args === "string") {
    io.err(`${args}\n`);
    return 2;
  }
  let issues: Issue[];
  let slides: number;
  try {
    const deck = parseDeck(io.readFile(args.file));
    slides = deck.slides.length;
    issues = runRules(deck, {
      isFontInstalled: () => undefined,
      fileExists: (path) => io.fileExists(path),
    });
  } catch {
    io.err(`Could not read ${args.file} as a .pptx file.\n`);
    return 2;
  }

  const text = (issue: Issue) => ({
    title: translate(args.lang, titleKey(issue)),
    message: translate(args.lang, bodyKey(issue), issue.params),
  });
  const counts = countBySeverity(issues);

  if (args.json) {
    io.out(
      `${JSON.stringify(
        {
          file: args.file,
          slides,
          counts,
          issues: issues.map((issue) => ({
            id: issue.id,
            severity: issue.severity,
            category: issue.category,
            slide: issue.slide ?? null,
            ...text(issue),
          })),
        },
        null,
        2,
      )}\n`,
    );
  } else {
    const lines = issues.map((issue) => {
      const { title, message } = text(issue);
      const where = issue.slide ? `slide ${issue.slide}` : "deck";
      return `${issue.severity.padEnd(7)} ${where.padEnd(9)} ${title}: ${message}`;
    });
    io.out(
      `${[
        `${args.file}: ${slides} slides, ${counts.error} errors, ${counts.warning} warnings, ${counts.tip} tips`,
        ...lines,
      ].join("\n")}\n`,
    );
  }
  return reaches(issues, args.failOn) ? 1 : 0;
}
