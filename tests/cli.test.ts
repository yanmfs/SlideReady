import { beforeAll, describe, expect, it } from "vitest";
import { buildDecks } from "../scripts/make-decks.mjs";
import { runCli, type CliIo } from "../src/cli/run";

let decks: Record<string, Uint8Array>;
beforeAll(async () => {
  decks = await buildDecks();
}, 60_000);

function run(argv: string[], files: Record<string, Uint8Array> = {}, existing: string[] = []) {
  let out = "";
  let err = "";
  const io: CliIo = {
    readFile: (path) => {
      const bytes = files[path];
      if (!bytes) throw new Error("ENOENT");
      return bytes;
    },
    fileExists: (path) => existing.includes(path),
    out: (t) => (out += t),
    err: (t) => (err += t),
  };
  return { code: runCli(argv, io), out, err };
}

describe("slideready check", () => {
  it("exits 0 and lists nothing serious for a clean deck", () => {
    const r = run(["check", "clean.pptx", "--lang", "en"], { "clean.pptx": decks.clean! });
    expect(r.code).toBe(0);
    expect(r.out).toContain("clean.pptx: 2 slides, 0 errors");
  });

  it("exits 1 and names the problem for a deck with errors", () => {
    const r = run(["check", "d.pptx", "--lang", "pt-BR"], { "d.pptx": decks["text-placeholder"]! });
    expect(r.code).toBe(1);
    expect(r.out).toContain("Texto provisório esquecido");
    expect(r.out).toContain("slide 1");
  });

  it("prints JSON with counts and one entry per issue", () => {
    const r = run(["check", "d.pptx", "--json", "--lang", "en"], {
      "d.pptx": decks["text-placeholder"]!,
    });
    const data = JSON.parse(r.out) as {
      counts: { error: number };
      issues: { id: string; slide: number | null; title: string }[];
    };
    expect(data.counts.error).toBeGreaterThan(0);
    expect(data.issues.find((i) => i.id === "text-placeholder")).toMatchObject({
      slide: 1,
      title: "Forgotten placeholder text",
    });
  });

  it("can be told to accept errors, or to fail on warnings", () => {
    const files = { "d.pptx": decks["text-placeholder"]! };
    expect(run(["check", "d.pptx", "--fail-on", "never"], files).code).toBe(0);
    expect(
      run(["check", "d.pptx", "--fail-on", "warning"], { "d.pptx": decks["font-risky"]! }).code,
    ).toBe(1);
  });

  it("asks the disk whether linked media exists", () => {
    const files = { "m.pptx": decks["media-linked"]! };
    const missing = run(["check", "m.pptx", "--json"], files);
    expect(
      JSON.parse(missing.out).issues.find((i: { id: string }) => i.id === "media-linked").severity,
    ).toBe("error");
  });

  it("exits 2 on a file that is not a presentation and on bad arguments", () => {
    expect(run(["check", "nope.pptx"]).code).toBe(2);
    expect(run(["check", "x.pptx"], { "x.pptx": new Uint8Array([1, 2, 3]) }).code).toBe(2);
    expect(run([]).code).toBe(2);
    expect(run(["check"]).code).toBe(2);
    expect(run(["check", "a.pptx", "--lang", "fr"]).code).toBe(2);
  });
});
