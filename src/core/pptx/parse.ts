import { strFromU8, unzipSync } from "fflate";
import type {
  Deck,
  Link,
  MediaRef,
  Paragraph,
  Picture,
  Relationship,
  Slide,
  SlideText,
  Table,
  TextRun,
} from "./types";
import { NS, attr, child, children, descendants, parseXml, resolveChildren } from "./xml";

const ADEC = "http://schemas.microsoft.com/office/drawing/2017/decorative";
const VIDEO_EXT = new Set(["mp4", "m4v", "mov", "wmv", "avi", "flv", "mkv", "webm", "mpg", "mpeg"]);
const AUDIO_EXT = new Set(["mp3", "wav", "m4a", "wma", "aac", "ogg"]);
const DEFAULT_SIZE = 18;

interface Zip {
  has(part: string): boolean;
  text(part: string): string | undefined;
  size(part: string): number | undefined;
  names(): string[];
}

function openZip(bytes: Uint8Array): Zip {
  const sizes = new Map<string, number>();
  // Only XML parts are inflated; media is measured from the central directory.
  const files = unzipSync(bytes, {
    filter: (f) => {
      sizes.set(f.name, f.originalSize);
      return /\.(xml|rels)$/i.test(f.name);
    },
  });
  return {
    has: (part) => sizes.has(part),
    text: (part) => (files[part] ? strFromU8(files[part]) : undefined),
    size: (part) => sizes.get(part),
    names: () => [...sizes.keys()],
  };
}

function dirOf(part: string): string {
  return part.includes("/") ? part.slice(0, part.lastIndexOf("/")) : "";
}

export function resolvePart(base: string, target: string): string {
  if (target.startsWith("/")) return target.slice(1);
  const parts = dirOf(base).split("/").filter(Boolean);
  for (const seg of target.split("/")) {
    if (seg === "..") parts.pop();
    else if (seg !== ".") parts.push(seg);
  }
  return parts.join("/");
}

function readRels(zip: Zip, part: string): Map<string, Relationship> {
  const relsPart = `${dirOf(part)}/_rels/${part.slice(part.lastIndexOf("/") + 1)}.rels`.replace(
    /^\//,
    "",
  );
  const text = zip.text(relsPart);
  const out = new Map<string, Relationship>();
  if (!text) return out;
  const root = parseXml(text);
  for (const el of descendants(root, NS.rel, "Relationship")) {
    const id = attr(el, "Id");
    if (!id) continue;
    const external = attr(el, "TargetMode") === "External";
    const target = attr(el, "Target") ?? "";
    out.set(id, {
      id,
      type: attr(el, "Type") ?? "",
      target: external ? target : resolvePart(part, target),
      external,
    });
  }
  return out;
}

const typeTail = (type: string) => type.slice(type.lastIndexOf("/") + 1);

// ---- inheritance ---------------------------------------------------------

interface Style {
  size?: number;
  font?: string;
}

interface Inheritance {
  masterStyles: Element | undefined;
  defaultTextStyle: Element | undefined;
  theme: { major?: string; minor?: string };
}

function levelProps(list: Element | undefined, level: number): Style {
  const props = child(child(list, NS.a, `lvl${level + 1}pPr`), NS.a, "defRPr");
  const sz = attr(props, "sz");
  return {
    size: sz ? Number(sz) / 100 : undefined,
    font: attr(child(props, NS.a, "latin"), "typeface"),
  };
}

const first = <T>(values: (T | undefined)[]): T | undefined => values.find((v) => v !== undefined);

function placeholderOf(shape: Element): { type?: string; idx?: string } | undefined {
  const ph = child(child(child(shape, NS.p, "nvSpPr"), NS.p, "nvPr"), NS.p, "ph");
  return ph ? { type: attr(ph, "type"), idx: attr(ph, "idx") } : undefined;
}

function findPlaceholder(
  tree: Element | undefined,
  ph: { type?: string; idx?: string },
): Element | undefined {
  if (!tree) return undefined;
  const shapes = resolveChildren(tree).filter((e) => e.localName === "sp");
  const matches = (candidate: { type?: string; idx?: string }) =>
    ph.idx !== undefined && candidate.idx !== undefined
      ? candidate.idx === ph.idx
      : (candidate.type ?? "body") === (ph.type ?? "body");
  return shapes.find((s) => {
    const c = placeholderOf(s);
    return c ? matches(c) : false;
  });
}

const kindOf = (ph: { type?: string } | undefined): SlideText["kind"] => {
  if (!ph) return "body";
  if (ph.type === "title" || ph.type === "ctrTitle") return "title";
  if (ph.type === "dt" || ph.type === "ftr" || ph.type === "sldNum") return "footer";
  return "body";
};

function masterStyleFor(
  inh: Inheritance,
  kind: SlideText["kind"],
  isPlaceholder: boolean,
): Element | undefined {
  if (!inh.masterStyles) return undefined;
  const name =
    kind === "title" ? "titleStyle" : isPlaceholder && kind === "body" ? "bodyStyle" : "otherStyle";
  return child(inh.masterStyles, NS.p, name);
}

// ---- slide parsing -------------------------------------------------------

interface SlideContext {
  zip: Zip;
  part: string;
  rels: Map<string, Relationship>;
  layoutTree: Element | undefined;
  masterTree: Element | undefined;
  inh: Inheritance;
  slideParts: Set<string>;
}

function fontName(raw: string | undefined, theme: Inheritance["theme"]): string | undefined {
  if (!raw) return undefined;
  if (raw === "+mj-lt") return theme.major;
  if (raw === "+mn-lt") return theme.minor;
  return raw.startsWith("+") ? undefined : raw;
}

function textFromParagraph(p: Element): string {
  let out = "";
  for (const el of Array.from(p.getElementsByTagNameNS(NS.a, "t"))) out += el.textContent ?? "";
  return out;
}

function readTextBody(
  ctx: SlideContext,
  body: Element,
  shape: Element | undefined,
  ph: { type?: string; idx?: string } | undefined,
  inTable: boolean,
): SlideText {
  const kind = kindOf(ph);
  const layoutShape = ph ? findPlaceholder(ctx.layoutTree, ph) : undefined;
  const masterShape = ph
    ? findPlaceholder(ctx.masterTree, {
        type: ph.type === "ctrTitle" ? "title" : ph.type === "subTitle" ? "body" : ph.type,
      })
    : undefined;
  const lists = [
    child(body, NS.a, "lstStyle"),
    child(child(layoutShape, NS.p, "txBody"), NS.a, "lstStyle"),
    child(child(masterShape, NS.p, "txBody"), NS.a, "lstStyle"),
    masterStyleFor(ctx.inh, kind, ph !== undefined),
    ctx.inh.defaultTextStyle,
  ];

  const bodyPr = child(body, NS.a, "bodyPr");
  const fontScaleRaw = attr(child(bodyPr, NS.a, "normAutofit"), "fontScale");
  const fontScale = fontScaleRaw ? Number(fontScaleRaw) / 100000 : undefined;
  const inheritedTable = inTable;

  const paragraphs: Paragraph[] = [];
  for (const p of children(body, NS.a, "p")) {
    const pPr = child(p, NS.a, "pPr");
    const level = Number(attr(pPr, "lvl") ?? 0);
    const inherited = lists.map((l) => levelProps(l, level));
    const inheritedSize = first(inherited.map((i) => i.size));
    const inheritedFont = first(inherited.map((i) => i.font));
    const defaultFont = kind === "title" ? ctx.inh.theme.major : ctx.inh.theme.minor;

    const runs: TextRun[] = [];
    for (const r of children(p, NS.a, "r").concat(children(p, NS.a, "fld"))) {
      const text = textFromParagraph(r);
      if (text === "") continue;
      const rPr = child(r, NS.a, "rPr");
      const sz = attr(rPr, "sz");
      let size = sz ? Number(sz) / 100 : inheritedSize;
      // Without an explicit size, table cells depend on the table style, which is not resolved.
      if (size === undefined && !inheritedTable) size = DEFAULT_SIZE;
      if (size !== undefined && fontScale !== undefined) size *= fontScale;
      const font =
        fontName(attr(child(rPr, NS.a, "latin"), "typeface"), ctx.inh.theme) ??
        fontName(inheritedFont, ctx.inh.theme) ??
        defaultFont;
      runs.push({ text, size, font });
    }
    const hasText = runs.some((r) => r.text.trim() !== "");
    const noBullet = child(pPr, NS.a, "buNone") !== undefined;
    const explicitBullet =
      child(pPr, NS.a, "buChar") !== undefined || child(pPr, NS.a, "buAutoNum") !== undefined;
    const bullet =
      hasText && !noBullet && (explicitBullet || (ph !== undefined && kind === "body" && !inTable));
    paragraphs.push({ runs, bullet });
  }
  void shape;
  return { paragraphs, kind, inTable, fontScale };
}

function readLinks(ctx: SlideContext, root: Element): Link[] {
  const links: Link[] = [];
  for (const el of descendants(root, NS.a, "hlinkClick")) {
    const id = attr(el, "id", NS.r);
    const action = attr(el, "action") ?? "";
    if (!id) continue;
    const rel = ctx.rels.get(id);
    if (!rel) continue;
    if (action.includes("hlinksldjump") || (!rel.external && typeTail(rel.type) === "slide")) {
      const missing = rel.external || !ctx.slideParts.has(rel.target);
      links.push({
        target: rel.target,
        kind: "slide-jump",
        slideTarget: missing ? undefined : rel.target,
        missing,
      });
    } else if (rel.external) {
      links.push({ target: rel.target, kind: "external" });
    }
  }
  return links;
}

function mediaKind(rel: Relationship): MediaRef["relType"] | null {
  const tail = typeTail(rel.type);
  const ext = rel.target.split(/[?#]/)[0]?.split(".").pop()?.toLowerCase() ?? "";
  if (tail === "image") return "image";
  if (tail === "video") return "video";
  if (tail === "audio") return "audio";
  if (tail === "media")
    return VIDEO_EXT.has(ext) ? "video" : AUDIO_EXT.has(ext) ? "audio" : "other";
  if (tail === "oleObject" || tail === "package") return "ole";
  return null;
}

function readMedia(ctx: SlideContext): MediaRef[] {
  const out: MediaRef[] = [];
  for (const rel of ctx.rels.values()) {
    const relType = mediaKind(rel);
    if (!relType) continue;
    out.push({
      relType,
      target: rel.target,
      external: rel.external,
      partExists: rel.external || ctx.zip.has(rel.target),
      size: rel.external ? undefined : ctx.zip.size(rel.target),
    });
  }
  // Pictures that point at a relationship the slide does not have.
  const root = ctx.zip.text(ctx.part);
  if (root) {
    for (const blip of descendants(parseXml(root), NS.a, "blip")) {
      const id = attr(blip, "embed", NS.r);
      if (id && !ctx.rels.has(id))
        out.push({ relType: "image", target: `(${id})`, external: false, partExists: false });
    }
  }
  return out;
}

function pictureFrom(nv: Element | undefined, kind: Picture["kind"]): Picture {
  const props = child(nv, NS.p, "cNvPr");
  const decorative = descendants(props ?? (nv as Element), ADEC, "decorative").some(
    (d) => attr(d, "val") === "1",
  );
  return {
    name: attr(props, "name") ?? "",
    hasAlt: (attr(props, "descr") ?? "").trim() !== "",
    decorative,
    kind,
  };
}

interface Collected {
  texts: SlideText[];
  pictures: Picture[];
  tables: Table[];
  title?: string;
}

function collect(ctx: SlideContext, tree: Element, out: Collected) {
  for (const el of resolveChildren(tree)) {
    switch (el.localName) {
      case "sp": {
        const ph = placeholderOf(el);
        const body = child(el, NS.p, "txBody");
        if (body) {
          const text = readTextBody(ctx, body, el, ph, false);
          out.texts.push(text);
          if (text.kind === "title" && out.title === undefined) {
            const title = text.paragraphs
              .map((p) => p.runs.map((r) => r.text).join(""))
              .join(" ")
              .trim();
            if (title) out.title = title;
          }
        }
        if (child(child(el, NS.p, "spPr"), NS.a, "blipFill")) {
          out.pictures.push(pictureFrom(child(el, NS.p, "nvSpPr"), "picture"));
        }
        break;
      }
      case "pic": {
        const nvPr = child(child(el, NS.p, "nvPicPr"), NS.p, "nvPr");
        const isMedia = child(nvPr, NS.a, "videoFile") || child(nvPr, NS.a, "audioFile");
        if (!isMedia) out.pictures.push(pictureFrom(child(el, NS.p, "nvPicPr"), "picture"));
        break;
      }
      case "grpSp":
        collect(ctx, el, out);
        break;
      case "graphicFrame": {
        const data = child(child(el, NS.a, "graphic"), NS.a, "graphicData");
        const uri = attr(data, "uri") ?? "";
        const nv = child(el, NS.p, "nvGraphicFramePr");
        if (uri.endsWith("/chart")) out.pictures.push(pictureFrom(nv, "chart"));
        const table = child(data, NS.a, "tbl");
        if (table) {
          const firstRow = attr(child(table, NS.a, "tblPr"), "firstRow");
          out.tables.push({
            name: attr(child(nv, NS.p, "cNvPr"), "name") ?? "",
            hasHeader: firstRow === "1" || firstRow === "true",
          });
          for (const cell of descendants(table, NS.a, "tc")) {
            const body = child(cell, NS.a, "txBody");
            if (body) out.texts.push(readTextBody(ctx, body, undefined, undefined, true));
          }
        }
        break;
      }
      default:
    }
  }
}

function readTheme(
  zip: Zip,
  masterPart: string | undefined,
  rels: Map<string, Relationship>,
): Inheritance["theme"] {
  const themeRel = [...rels.values()].find((r) => typeTail(r.type) === "theme");
  void masterPart;
  const text = themeRel ? zip.text(themeRel.target) : undefined;
  if (!text) return {};
  const scheme = descendants(parseXml(text), NS.a, "fontScheme")[0];
  return {
    major: attr(child(child(scheme, NS.a, "majorFont"), NS.a, "latin"), "typeface"),
    minor: attr(child(child(scheme, NS.a, "minorFont"), NS.a, "latin"), "typeface"),
  };
}

export function parseDeck(bytes: Uint8Array): Deck {
  const zip = openZip(bytes);
  const presPart = "ppt/presentation.xml";
  const presText = zip.text(presPart);
  if (!presText) throw new Error("not a presentation");
  const pres = parseXml(presText);
  const presRels = readRels(zip, presPart);

  const size = child(pres, NS.p, "sldSz");
  const slideParts = (
    child(pres, NS.p, "sldIdLst") ? children(child(pres, NS.p, "sldIdLst")!, NS.p, "sldId") : []
  )
    .map((id) => presRels.get(attr(id, "id", NS.r) ?? "")?.target)
    .filter((t): t is string => t !== undefined);
  const known = new Set(slideParts);

  const embeddedFonts = descendants(pres, NS.p, "embeddedFont")
    .map((f) => attr(child(f, NS.p, "font"), "typeface"))
    .filter((f): f is string => f !== undefined);

  const defaultTextStyle = child(pres, NS.p, "defaultTextStyle");
  const mediaFiles = zip
    .names()
    .filter((n) => n.startsWith("ppt/media/") || n.startsWith("ppt/embeddings/"))
    .map((part) => ({ part, size: zip.size(part) ?? 0 }));

  const themeFonts: Deck["themeFonts"] = {};
  const slides: Slide[] = slideParts.map((part, i) => {
    const rels = readRels(zip, part);
    const layoutPart = [...rels.values()].find((r) => typeTail(r.type) === "slideLayout")?.target;
    const layoutRels = layoutPart ? readRels(zip, layoutPart) : new Map<string, Relationship>();
    const masterPart = [...layoutRels.values()].find(
      (r) => typeTail(r.type) === "slideMaster",
    )?.target;
    const masterRels = masterPart ? readRels(zip, masterPart) : new Map<string, Relationship>();
    const theme = readTheme(zip, masterPart, masterRels);
    themeFonts.major ??= theme.major;
    themeFonts.minor ??= theme.minor;

    const treeOf = (p: string | undefined) => {
      const text = p ? zip.text(p) : undefined;
      return text ? child(child(parseXml(text), NS.p, "cSld"), NS.p, "spTree") : undefined;
    };
    const masterText = masterPart ? zip.text(masterPart) : undefined;
    const masterRoot = masterText ? parseXml(masterText) : undefined;

    const ctx: SlideContext = {
      zip,
      part,
      rels,
      layoutTree: treeOf(layoutPart),
      masterTree: masterRoot ? child(child(masterRoot, NS.p, "cSld"), NS.p, "spTree") : undefined,
      inh: {
        masterStyles: masterRoot ? child(masterRoot, NS.p, "txStyles") : undefined,
        defaultTextStyle,
        theme,
      },
      slideParts: known,
    };

    const slideText = zip.text(part);
    const root = slideText ? parseXml(slideText) : undefined;
    const collected: Collected = { texts: [], pictures: [], tables: [] };
    const tree = child(child(root, NS.p, "cSld"), NS.p, "spTree");
    if (tree) collect(ctx, tree, collected);

    const commentCount = [...rels.values()]
      .filter((r) => /comments/i.test(typeTail(r.type)))
      .reduce((sum, r) => {
        const t = zip.text(r.target);
        return sum + (t ? (t.match(/<(?:\w+:)?cm[\s>]/g) ?? []).length : 0);
      }, 0);

    return {
      index: i + 1,
      part,
      hidden: attr(root, "show") === "0",
      title: collected.title,
      texts: collected.texts,
      links: root ? readLinks(ctx, root) : [],
      media: readMedia(ctx),
      pictures: collected.pictures,
      tables: collected.tables,
      commentCount,
    };
  });

  const core = zip.text("docProps/core.xml");
  const coreField = (name: string) => {
    const m = core ? new RegExp(`<[\\w:]*${name}[^>]*>([^<]*)<`).exec(core) : null;
    return m?.[1]?.trim() || undefined;
  };

  return {
    fileSize: bytes.length,
    slideWidth: Number(attr(size, "cx") ?? 0),
    slideHeight: Number(attr(size, "cy") ?? 0),
    slides,
    embeddedFonts,
    themeFonts,
    mediaFiles,
    author: coreField("creator"),
    lastModifiedBy: coreField("lastModifiedBy"),
  };
}
