import type { Slide } from "../pptx/types";
import type { Category, Issue, Severity } from "./types";

export function issue(
  id: string,
  category: Category,
  severity: Severity,
  slide: Slide | undefined,
  params: Issue["params"] = {},
): Issue {
  return { id, category, severity, slide: slide?.index, slideTitle: slide?.title, params };
}

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const FILE_EXT = /\.(xlsx?|docx?|pptx?|pdf|csv|txt|mp4|m4v|mov|avi|wmv|mp3|wav|png|jpe?g|gif)$/i;

export function isLocalPath(target: string): boolean {
  if (/^file:/i.test(target) || /^[A-Za-z]:[\\/]/.test(target) || target.startsWith("\\\\"))
    return true;
  if (/^\/(Users|home|Volumes)\//.test(target)) return true;
  return (
    !SCHEME.test(target) && !target.startsWith("#") && FILE_EXT.test(target.split(/[?#]/)[0] ?? "")
  );
}

export function localFilePath(target: string): string {
  if (!/^file:/i.test(target)) return target;
  const decoded = decodeURIComponent(target.replace(/^file:\/\/\/?/i, ""));
  return /^[A-Za-z]:/.test(decoded) ? decoded : `/${decoded}`;
}

// Paths like C:\Users\ana\... reveal the account name of whoever built the deck.
export const exposesUser = (path: string) =>
  /(?:^|[\\/])Users[\\/][^\\/]+/i.test(path) || /^\/home\/[^/]+/.test(path);

export const extensionOf = (target: string) =>
  target.split(/[?#]/)[0]?.split(".").pop()?.toLowerCase() ?? "";
