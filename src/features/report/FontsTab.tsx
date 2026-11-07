import { CircleCheck, CircleX, HelpCircle, TriangleAlert } from "lucide-react";
import type { FontStatus } from "../../core/rules";
import { useT } from "../../store";
import type { Analysis } from "./analysis";

const STATUS: Record<FontStatus, { icon: typeof CircleX; color: string }> = {
  safe: { icon: CircleCheck, color: "text-success" },
  embedded: { icon: CircleCheck, color: "text-success" },
  ok: { icon: CircleCheck, color: "text-success" },
  risky: { icon: TriangleAlert, color: "text-warning" },
  missing: { icon: CircleX, color: "text-danger" },
};

export function FontsTab({ analysis }: { analysis: Analysis }) {
  const t = useT();
  if (analysis.fonts.length === 0) return <p className="text-sm text-muted">{t("fonts.empty")}</p>;
  return (
    <div className="overflow-hidden rounded-panel border border-border bg-surface">
      <table className="w-full text-left text-sm">
        <thead className="bg-surface-2 text-xs uppercase tracking-wide text-muted">
          <tr>
            <th scope="col" className="px-4 py-2 font-semibold">
              {t("fonts.name")}
            </th>
            <th scope="col" className="px-4 py-2 font-semibold">
              {t("fonts.slides")}
            </th>
            <th scope="col" className="px-4 py-2 font-semibold">
              {t("fonts.status")}
            </th>
          </tr>
        </thead>
        <tbody>
          {analysis.fonts.map((font) => {
            const { icon: Icon, color } = STATUS[font.status];
            const unknown = font.installed === undefined && font.status === "risky";
            return (
              <tr key={font.name} className="border-t border-border">
                <th scope="row" className="px-4 py-3 font-medium">
                  {font.name}
                </th>
                <td className="px-4 py-3 tabular-nums text-muted">{font.slides.length}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-2 ${color}`}>
                    {unknown ? (
                      <HelpCircle aria-hidden className="size-4" />
                    ) : (
                      <Icon aria-hidden className="size-4" />
                    )}
                    <span className="text-text">
                      {unknown ? t("fonts.unknown") : t(`fonts.status.${font.status}`)}
                    </span>
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
