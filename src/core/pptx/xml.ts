import { DOMParser } from "@xmldom/xmldom";

export const NS = {
  p: "http://schemas.openxmlformats.org/presentationml/2006/main",
  a: "http://schemas.openxmlformats.org/drawingml/2006/main",
  r: "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
  mc: "http://schemas.openxmlformats.org/markup-compatibility/2006",
  rel: "http://schemas.openxmlformats.org/package/2006/relationships",
} as const;

export function parseXml(text: string): Element {
  const doc = new DOMParser({ onError: () => undefined }).parseFromString(text, "text/xml");
  return doc.documentElement as unknown as Element;
}

export function children(el: Element, ns: string, local: string): Element[] {
  const out: Element[] = [];
  for (let n = el.firstChild; n; n = n.nextSibling) {
    if (
      n.nodeType === 1 &&
      (n as Element).localName === local &&
      (n as Element).namespaceURI === ns
    ) {
      out.push(n as Element);
    }
  }
  return out;
}

export const child = (el: Element | undefined, ns: string, local: string): Element | undefined =>
  el ? children(el, ns, local)[0] : undefined;

export function descendants(el: Element, ns: string, local: string): Element[] {
  return Array.from(el.getElementsByTagNameNS(ns, local)) as Element[];
}

export const attr = (el: Element | undefined, name: string, ns?: string): string | undefined => {
  if (!el) return undefined;
  const value = ns ? el.getAttributeNS(ns, name) : el.getAttribute(name);
  return value === null || value === "" ? undefined : value;
};

// Namespaces whose Choice branch is understood; anything else falls back to mc:Fallback.
const KNOWN_PREFIXES = new Set(["p14", "p15", "a14", "a16", "wps", "wpg", "p159"]);

// Returns the elements that actually render, with mc:AlternateContent resolved.
export function resolveChildren(parent: Element): Element[] {
  const out: Element[] = [];
  for (let n = parent.firstChild; n; n = n.nextSibling) {
    if (n.nodeType !== 1) continue;
    const el = n as Element;
    if (el.localName === "AlternateContent" && el.namespaceURI === NS.mc) {
      const choice = children(el, NS.mc, "Choice").find((c) =>
        (attr(c, "Requires") ?? "").split(/\s+/).every((prefix) => KNOWN_PREFIXES.has(prefix)),
      );
      const picked = choice ?? child(el, NS.mc, "Fallback");
      if (picked) out.push(...resolveChildren(picked));
    } else {
      out.push(el);
    }
  }
  return out;
}
