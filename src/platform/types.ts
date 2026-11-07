import type { Os } from "../core/os";
import type { Settings } from "../settings";

export type Unlisten = () => void;

export interface LoadedDeck {
  bytes: Uint8Array;
  name: string;
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
