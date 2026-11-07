import { create } from "zustand";
import { platform, type LoadedDeck } from "../../platform";
import { tNow } from "../../store";
import { showToast } from "../../toast";
import { analyze, type Analysis } from "./analysis";

interface ReportState {
  analysis: Analysis | null;
  busy: boolean;
  load: (deck: LoadedDeck) => Promise<void>;
  reset: () => void;
}

export const useReport = create<ReportState>((set) => ({
  analysis: null,
  busy: false,
  load: async (deck) => {
    set({ busy: true });
    try {
      set({ analysis: await analyze(deck.name, deck.bytes) });
    } catch {
      showToast(tNow("drop.error"), "error");
    } finally {
      set({ busy: false });
    }
  },
  reset: () => set({ analysis: null }),
}));

export async function openFromDialog(): Promise<void> {
  const deck = await platform
    .pickDeck((size) => tNow("drop.large", { size }))
    .catch(() => {
      showToast(tNow("drop.error"), "error");
      return null;
    });
  if (deck) await useReport.getState().load(deck);
}
