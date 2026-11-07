import { create } from "zustand";
import { httpUrls, onlineIssues } from "../../core/online";
import { platform, type LoadedDeck } from "../../platform";
import { tNow } from "../../store";
import { showToast } from "../../toast";
import { analyze, type Analysis } from "./analysis";

interface ReportState {
  analysis: Analysis | null;
  busy: boolean;
  checking: boolean;
  load: (deck: LoadedDeck) => Promise<void>;
  checkOnline: () => Promise<void>;
  reset: () => void;
}

const RELOAD_DELAY_MS = 700;

let unwatch: (() => void) | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;

function stopFollowing() {
  clearTimeout(timer);
  unwatch?.();
  unwatch = undefined;
}

export const useReport = create<ReportState>((set, get) => {
  // Saving from PowerPoint fires several events; the file is read once they settle.
  async function reanalyze(path: string) {
    const deck = await platform.readDeck?.(path).catch(() => null);
    if (!deck) return;
    try {
      const analysis = await analyze(deck.name, deck.bytes);
      set({ analysis });
      showToast(tNow("watch.reanalyzed"));
    } catch {
      // The file may still be half written; the next change event retries.
    }
  }

  async function follow(path: string) {
    stopFollowing();
    if (!platform.watchDeck) return;
    try {
      unwatch = await platform.watchDeck(path, () => {
        clearTimeout(timer);
        timer = setTimeout(() => void reanalyze(path), RELOAD_DELAY_MS);
      });
    } catch {
      // Without a watcher the report simply does not refresh by itself.
    }
  }

  return {
    analysis: null,
    busy: false,
    checking: false,
    load: async (deck) => {
      set({ busy: true });
      try {
        set({ analysis: await analyze(deck.name, deck.bytes) });
        if (deck.path) void follow(deck.path);
        else stopFollowing();
      } catch {
        showToast(tNow("drop.error"), "error");
      } finally {
        set({ busy: false });
      }
    },
    checkOnline: async () => {
      const current = get().analysis;
      if (!current || !platform.checkLinks) return;
      set({ checking: true });
      try {
        const probes = await platform.checkLinks(httpUrls(current.deck));
        const issues = onlineIssues(current.deck, probes);
        set((state) =>
          state.analysis?.deck === current.deck
            ? { analysis: { ...state.analysis, online: { probes, issues } } }
            : {},
        );
      } catch {
        showToast(tNow("online.failed"), "error");
      } finally {
        set({ checking: false });
      }
    },
    reset: () => {
      stopFollowing();
      set({ analysis: null });
    },
  };
});

export async function openFromDialog(): Promise<void> {
  const deck = await platform
    .pickDeck((size) => tNow("drop.large", { size }))
    .catch(() => {
      showToast(tNow("drop.error"), "error");
      return null;
    });
  if (deck) await useReport.getState().load(deck);
}
