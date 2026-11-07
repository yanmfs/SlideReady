import { issue } from "./util";
import type { Rule } from "./types";

const channel = (v: number) => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

const luminance = (hex: string) => {
  const n = Number.parseInt(hex, 16);
  return (
    0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
  );
};

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

export const contrast: Rule = {
  id: "contrast",
  category: "contrast",
  run: (deck) =>
    deck.slides.flatMap((slide) => {
      let worst: { ratio: number; sample: string } | undefined;
      let count = 0;
      for (const text of slide.texts) {
        if (!text.background) continue;
        for (const p of text.paragraphs) {
          for (const run of p.runs) {
            if (!run.color || run.text.trim().length < 2) continue;
            const ratio = contrastRatio(run.color, text.background);
            if (ratio >= 4.5) continue;
            count++;
            if (!worst || ratio < worst.ratio)
              worst = { ratio, sample: run.text.trim().slice(0, 40) };
          }
        }
      }
      if (!worst) return [];
      return [
        issue("contrast", "contrast", worst.ratio < 3 ? "error" : "warning", slide, {
          ratio: Math.round(worst.ratio * 10) / 10,
          count,
          sample: worst.sample,
        }),
      ];
    }),
};
