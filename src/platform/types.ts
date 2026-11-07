import type { Os } from "../core/os";
import type { LinkProbe } from "../core/online";
import type { Settings } from "../settings";

export type Unlisten = () => void;

export interface LoadedDeck {
  bytes: Uint8Array;
  name: string;
  // Absolute path when the platform knows it (the browser demo does not).
  path?: string;
}

export type LargeMessage = (megabytes: number) => string;

export interface Platform {
  os: Os;
  systemLocale: string;
  // `largeMessage` words the warning shown before a very large file is opened.
  pickDeck(largeMessage: LargeMessage): Promise<LoadedDeck | null>;
  // null when the platform cannot list fonts (the browser demo).
  listFonts(): Promise<Set<string> | null>;
  fileExists(path: string): Promise<boolean | undefined>;
  // Both are missing in the browser demo: it cannot reach the network on the person's behalf or watch files.
  checkLinks?: (urls: string[]) => Promise<LinkProbe[]>;
  watchDeck?: (path: string, onChange: () => void) => Promise<Unlisten>;
  readDeck?: (path: string) => Promise<LoadedDeck>;
  // Returns false when the person cancels the save dialog.
  saveReport(fileName: string, contents: string, mime: string): Promise<boolean>;
  onFileDrop(handlers: {
    hover: (over: boolean) => void;
    deck: (deck: LoadedDeck) => void;
    failed: () => void;
    largeMessage: LargeMessage;
  }): Promise<Unlisten>;
  loadSettings(): Promise<unknown>;
  saveSettings(settings: Settings): Promise<void>;
  openUrl(url: string): Promise<void>;
}
