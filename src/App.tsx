import { FolderOpen, Info, Presentation, Settings } from "lucide-react";
import { useEffect } from "react";
import { Button } from "./components/Button";
import { Logo } from "./components/Logo";
import { Toaster } from "./components/Toaster";
import { Tooltip, TooltipProvider } from "./components/Tooltip";
import { modKeyLabel } from "./core/os";
import { ReportView } from "./features/report/ReportView";
import { openFromDialog, useReport } from "./features/report/store";
import { AboutDialog } from "./features/settings/AboutDialog";
import { SettingsDialog } from "./features/settings/SettingsDialog";
import { useIntake } from "./features/useIntake";
import { platform } from "./platform";
import { selectLang, useApp, useT } from "./store";

export default function App() {
  const t = useT();
  const lang = useApp(selectLang);
  const theme = useApp((s) => s.settings.theme);
  const ready = useApp((s) => s.ready);
  const setDialog = useApp((s) => s.setDialog);
  const analysis = useReport((s) => s.analysis);
  const busy = useReport((s) => s.busy);
  const { dragging } = useIntake();

  useEffect(() => {
    void useApp.getState().hydrate();
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.dataset.theme = theme;
    root.lang = lang;
  }, [theme, lang]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "o") {
        e.preventDefault();
        void openFromDialog();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!ready) return null;
  const mod = modKeyLabel(platform.os);

  return (
    <TooltipProvider>
      <div className="flex h-full flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface px-4">
          <div className="flex items-center gap-2.5">
            <Logo />
            <span className="font-semibold">SlideReady</span>
          </div>
          <div className="flex items-center gap-1">
            <Tooltip label={t("header.open")} hint={`${mod}+O`}>
              <Button onClick={() => void openFromDialog()}>
                <FolderOpen className="size-4" aria-hidden />
                {t("header.open")}
              </Button>
            </Tooltip>
            <Button
              variant="ghost"
              icon
              aria-label={t("header.about")}
              onClick={() => setDialog("aboutOpen", true)}
            >
              <Info className="size-4" aria-hidden />
            </Button>
            <Button
              variant="ghost"
              icon
              aria-label={t("header.settings")}
              onClick={() => setDialog("settingsOpen", true)}
            >
              <Settings className="size-4" aria-hidden />
            </Button>
          </div>
        </header>

        {analysis ? (
          <ReportView analysis={analysis} />
        ) : (
          <div className="flex flex-1 items-center justify-center p-8">
            <div className="flex max-w-md flex-col items-center gap-4 rounded-panel border-2 border-dashed border-border px-10 py-12 text-center">
              <Presentation aria-hidden className="size-12 text-accent-text" />
              <h2 className="text-xl font-semibold">{t("empty.title")}</h2>
              <p className="text-sm text-muted">{t("empty.hint")}</p>
              <Button variant="primary" disabled={busy} onClick={() => void openFromDialog()}>
                <FolderOpen className="size-4" aria-hidden />
                {t("empty.open")}
              </Button>
            </div>
          </div>
        )}

        {dragging && (
          <div
            role="presentation"
            className="anim-fade pointer-events-none fixed inset-3 z-30 flex items-center justify-center rounded-panel border-2 border-dashed border-accent bg-bg/90 text-lg font-medium"
          >
            {t("drop.title")}
          </div>
        )}
      </div>
      <SettingsDialog />
      <AboutDialog />
      <Toaster />
    </TooltipProvider>
  );
}
