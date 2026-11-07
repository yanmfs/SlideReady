import { detectOs, type Os } from "../core/os";
import type { LoadedDeck, Platform } from "./types";

const KEY = "slideready:settings";

function osFromQuery(): Os | null {
  const value = new URLSearchParams(window.location.search).get("os");
  return value === "windows" || value === "macos" ? value : null;
}

async function fromFile(file: File): Promise<LoadedDeck> {
  return { bytes: new Uint8Array(await file.arrayBuffer()), name: file.name };
}

const isPptx = (file: File) => file.name.toLowerCase().endsWith(".pptx");

// Used by the browser demo, the screenshots and the UI tests: it cannot see fonts or other files.
export const web: Platform = {
  os: osFromQuery() ?? detectOs(navigator.userAgent),
  systemLocale: navigator.language,
  pickDeck: () =>
    new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".pptx";
      input.onchange = () => {
        const file = input.files?.[0];
        resolve(file ? fromFile(file) : null);
      };
      input.oncancel = () => resolve(null);
      input.click();
    }),
  listFonts: () => Promise.resolve(null),
  fileExists: () => Promise.resolve(undefined),
  onFileDrop: ({ hover, deck, failed }) => {
    const over = (e: DragEvent) => {
      e.preventDefault();
      hover(true);
    };
    const leave = () => hover(false);
    const drop = (e: DragEvent) => {
      e.preventDefault();
      hover(false);
      const file = [...(e.dataTransfer?.files ?? [])].find(isPptx);
      if (!file) return failed();
      fromFile(file).then(deck, failed);
    };
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    return Promise.resolve(() => {
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
    });
  },
  loadSettings: () => {
    try {
      return Promise.resolve(JSON.parse(localStorage.getItem(KEY) ?? "null"));
    } catch {
      return Promise.resolve(null);
    }
  },
  saveSettings: (settings) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
    } catch {
      // Private mode or full storage: settings just won't survive a reload.
    }
    return Promise.resolve();
  },
  openUrl: (url) => {
    window.open(url, "_blank", "noopener");
    return Promise.resolve();
  },
};
