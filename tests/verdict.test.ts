import { describe, expect, it } from "vitest";
import type { Issue } from "../src/core/rules";
import { compareIssues, verdictOf } from "../src/core/verdict";

const make = (id: string, severity: Issue["severity"], slide = 1, params = {}): Issue => ({
  id,
  category: "text",
  severity,
  slide,
  params,
});

describe("verdictOf", () => {
  it("is ready when nothing needs fixing, even with tips", () => {
    expect(verdictOf([])).toBe("ready");
    expect(verdictOf([make("a", "tip")])).toBe("ready");
  });

  it("is almost there with warnings and not ready with errors", () => {
    expect(verdictOf([make("a", "warning"), make("b", "tip")])).toBe("almost");
    expect(verdictOf([make("a", "warning"), make("b", "error")])).toBe("attention");
  });
});

describe("compareIssues", () => {
  it("counts what was fixed and what is new", () => {
    const before = [make("a", "error", 1), make("b", "warning", 2), make("c", "tip", 3)];
    const after = [make("b", "warning", 2), make("d", "error", 4)];
    expect(compareIssues(before, after)).toEqual({ resolved: 2, added: 1 });
  });

  it("tells apart the same problem on different slides or with different details", () => {
    const before = [make("a", "error", 1, { size: 10 })];
    expect(compareIssues(before, [make("a", "error", 2, { size: 10 })])).toEqual({
      resolved: 1,
      added: 1,
    });
    expect(compareIssues(before, [make("a", "error", 1, { size: 12 })])).toEqual({
      resolved: 1,
      added: 1,
    });
  });

  it("sees nothing when the analysis is the same", () => {
    const same = [make("a", "error"), make("a", "error")];
    expect(compareIssues(same, same)).toEqual({ resolved: 0, added: 0 });
  });
});
