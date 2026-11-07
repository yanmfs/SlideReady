import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { ask, open } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { load, type Store } from "@tauri-apps/plugin-store";
import { detectOs } from "../core/os";
import type { LargeMessage, LoadedDeck, Platform } from "./types";

const LARGE_MB = 300;

let store: Promise<Store> | undefined;
const settingsStore = () => (store ??= load("settings.json", { autoSave: false, defaults: {} }));

const basename = (path: string) => path.split(/[\\/]/).pop() ?? path;

async function readDeck(path: string): Promise<LoadedDeck> {
  const buffer = await invoke<ArrayBuffer>("read_pptx_file", { path });
  return { bytes: new Uint8Array(buffer), name: basename(path) };
}

// Returns null when the person declines to open a very large file.
async function readChecked(path: string, largeMessage: LargeMessage): Promise<LoadedDeck | null> {
  const size = await invoke<number>("pptx_file_size", { path });
  const mb = Math.round(size / (1024 * 1024));
  if (mb >= LARGE_MB && !(await ask(largeMessage(mb), { kind: "warning" }))) return null;
  return readDeck(path);
}

let fonts: Promise<Set<string>> | undefined;

export const tauri: Platform = {
  os: detectOs(navigator.userAgent),
  systemLocale: navigator.language,
  pickDeck: async (largeMessage) => {
    const path = await open({
      multiple: false,
      filters: [{ name: "PowerPoint", extensions: ["pptx"] }],
    });
    return typeof path === "string" ? readChecked(path, largeMessage) : null;
  },
  listFonts: () => (fonts ??= invoke<string[]>("list_system_fonts").then((list) => new Set(list))),
  fileExists: (path) => invoke<boolean>("file_exists", { path }),
  onFileDrop: ({ hover, deck, failed, largeMessage }) =>
    getCurrentWebview().onDragDropEvent((event) => {
      const { type } = event.payload;
      hover(type === "enter" || type === "over");
      if (type !== "drop") return;
      const path = event.payload.paths.find((p) => p.toLowerCase().endsWith(".pptx"));
      if (!path) return failed();
      readChecked(path, largeMessage).then((loaded) => loaded && deck(loaded), failed);
    }),
  loadSettings: async () => (await settingsStore()).get("settings"),
  saveSettings: async (settings) => {
    const s = await settingsStore();
    await s.set("settings", settings);
    await s.save();
  },
  openUrl: (url) => openUrl(url),
};
