import { strFromU8, unzipSync } from "fflate";
import type {
  Deck,
  Link,
  MediaRef,
  OffSlideShape,
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
  // null: a color is set but needs transforms that are not resolved.
  color?: string | null;
}

interface Colors {
  palette: Map<string, string>;
  clrMap: Map<string, string>;
}

interface Inheritance {
  masterStyles: Element | undefined;
  defaultTextStyle: Element | undefined;
  theme: { major?: string; minor?: string };
  colors: Colors;
}

const HEX6 = /^[0-9A-F]{6}$/;
const hasElementChild = (el: Element) => Array.from(el.childNodes).some((n) => n.nodeType === 1);

// Plain colors only: anything with lumMod, tint, alpha and the like is reported as unknown.
function solidColor(solid: Element | undefined, colors: Colors): string | null {
  const c = solid
    ? (Array.from(solid.childNodes).find((n) => n.nodeType === 1) as Element | undefined)
    : undefined;
  if (!c || hasElementChild(c)) return null;
  const val = attr(c, "val");
  switch (c.localName) {
    case "srgbClr": {
      const hex = (val ?? "").toUpperCase();
      return HEX6.test(hex) ? hex : null;
    }
    case "sysClr":
      return attr(c, "lastClr")?.toUpperCase() ?? null;
    case "schemeClr":
      return val ? (colors.palette.get(colors.clrMap.get(val) ?? val) ?? null) : null;
    default:
      return null;
  }
}

// undefined: nothing specified here; null: specified but not a plain solid color.
function fillOf(props: Element | undefined, colors: Colors): string | null | undefined {
  if (!props) return undefined;
  const solid = child(props, NS.a, "solidFill");
  if (solid) return solidColor(solid, colors);
  for (const kind of ["gradFill", "blipFill", "pattFill", "grpFill"]) {
    if (child(props, NS.a, kind)) return null;
  }
  return undefined;
}

// The first source that sets a background wins, even when it is not resolvable.
function backgroundOf(root: Element | undefined, colors: Colors): string | null | undefined {
  const bg = child(child(root, NS.p, "cSld"), NS.p, "bg");
  if (!bg) return undefined;
  const props = child(bg, NS.p, "bgPr");
  if (props) return fillOf(props, colors) ?? null;
  const ref = child(bg, NS.p, "bgRef");
  if (ref) return attr(ref, "idx") === "1001" ? solidColor(ref, colors) : null;
  return undefined;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

function boxOf(xfrm: Element | undefined): Box | undefined {
  const off = child(xfrm, NS.a, "off");
  const ext = child(xfrm, NS.a, "ext");
  if (!off || !ext) return undefined;
  const box = {
    x: Number(attr(off, "x")),
    y: Number(attr(off, "y")),
    w: Number(attr(ext, "cx")),
    h: Number(attr(ext, "cy")),
  };
  return Object.values(box).every(Number.isFinite) ? box : undefined;
}

function xfrmOf(el: Element): Element | undefined {
  if (el.localName === "graphicFrame") return child(el, NS.p, "xfrm");
  if (el.localName === "grpSp") return child(child(el, NS.p, "grpSpPr"), NS.a, "xfrm");
  return child(child(el, NS.p, "spPr"), NS.a, "xfrm");
}

interface Rect {
  box: Box;
  color: string | null;
}

const SOLID_BOX = new Set([
  "rect",
  "roundRect",
  "round1Rect",
  "round2SameRect",
  "round2DiagRect",
  "snip1Rect",
  "snip2SameRect",
  "snip2DiagRect",
  "snipRoundRect",
  "ellipse",
]);

// A shape that paints something behind text drawn after it.
function paintOf(el: Element, colors: Colors): Rect | undefined {
  const box = boxOf(xfrmOf(el));
  if (!box) return undefined;
  if (el.localName === "pic") return { box, color: null };
  if (el.localName === "grpSp") {
    const paints =
      descendants(el, NS.p, "pic").length > 0 ||
      descendants(el, NS.p, "sp").some((sp) => {
        const spPr = child(sp, NS.p, "spPr");
        return (
          spPr !== undefined && !child(spPr, NS.a, "noFill") && fillOf(spPr, colors) !== undefined
        );
      });
    return paints ? { box, color: null } : undefined;
  }
  if (el.localName !== "sp") return undefined;
  const spPr = child(el, NS.p, "spPr");
  if (child(spPr, NS.a, "noFill")) return undefined;
  const fill = fillOf(spPr, colors);
  // A custom outline, or a line or arrow, paints only part of its box: the text over it is unknown.
  const preset = attr(child(spPr, NS.a, "prstGeom"), "prst");
  const fillsItsBox =
    !child(spPr, NS.a, "custGeom") && (preset === undefined || SOLID_BOX.has(preset));
  if (fill !== undefined) return { box, color: fillsItsBox ? fill : null };
  const fillRef = child(child(el, NS.p, "style"), NS.a, "fillRef");
  return fillRef && attr(fillRef, "idx") !== "0" ? { box, color: null } : undefined;
}

function levelProps(list: Element | undefined, level: number, colorsFor: Colors): Style {
  const props = child(child(list, NS.a, `lvl${level + 1}pPr`), NS.a, "defRPr");
  const sz = attr(props, "sz");
  return {
    size: sz ? Number(sz) / 100 : undefined,
    font: attr(child(props, NS.a, "latin"), "typeface"),
    color: fillOf(props, colorsFor),
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
  slideW: number;
  slideH: number;
  slideBg: string | null | undefined;
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
  background?: string,
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
    const inherited = lists.map((l) => levelProps(l, level, ctx.inh.colors));
    const inheritedColor = first(inherited.map((i) => i.color));
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
      const own = fillOf(rPr, ctx.inh.colors);
      const color = own !== undefined ? own : inheritedColor;
      runs.push({ text, size, font, color: color ?? undefined });
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
  return { paragraphs, kind, inTable, fontScale, background };
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
  // PowerPoint links a video through two relationships (video and media) to the same file.
  const seen = new Set<string>();
  for (const rel of ctx.rels.values()) {
    const relType = mediaKind(rel);
    if (!relType || seen.has(rel.target)) continue;
    seen.add(rel.target);
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

function pictureFrom(nv: Element | undefined, kind: Picture["kind"], fullBleed = false): Picture {
  const props = child(nv, NS.p, "cNvPr");
  const decorative = descendants(props ?? (nv as Element), ADEC, "decorative").some(
    (d) => attr(d, "val") === "1",
  );
  return {
    name: attr(props, "name") ?? "",
    hasAlt: (attr(props, "descr") ?? "").trim() !== "",
    decorative,
    fullBleed,
    kind,
  };
}

// A picture that fills the slide is a background, not content someone has to be told about.
function coversSlide(ctx: SlideContext, el: Element): boolean {
  const box = boxOf(xfrmOf(el));
  return box !== undefined && box.w * box.h >= 0.85 * ctx.slideW * ctx.slideH;
}

interface Collected {
  texts: SlideText[];
  pictures: Picture[];
  tables: Table[];
  offSlide: OffSlideShape[];
  content: number;
  // Painted areas in drawing order: layout and master first, then the slide.
  paints: Rect[];
  title?: string;
}

const TOLERANCE = 0.02;

function checkOffSlide(ctx: SlideContext, el: Element, out: Collected) {
  const xfrm = xfrmOf(el);
  const box = boxOf(xfrm);
  if (!box || attr(xfrm, "rot") || (box.w === 0 && box.h === 0)) return;
  const tx = ctx.slideW * TOLERANCE;
  const ty = ctx.slideH * TOLERANCE;
  const outside =
    box.x + box.w <= 0 || box.y + box.h <= 0 || box.x >= ctx.slideW || box.y >= ctx.slideH;
  const partial =
    box.x < -tx ||
    box.y < -ty ||
    box.x + box.w > ctx.slideW + tx ||
    box.y + box.h > ctx.slideH + ty;
  if (!outside && !partial) return;
  out.offSlide.push({
    name: attr(descendants(el, NS.p, "cNvPr")[0], "name") ?? "",
    partial: !outside,
  });
}

function backgroundFor(
  ctx: SlideContext,
  out: Collected,
  box: Box | undefined,
  own: Rect | undefined,
  grouped: boolean,
): string | undefined {
  if (own) return own.color ?? undefined;
  if (grouped) return undefined;
  if (out.paints.length > 0) {
    if (!box) return undefined;
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    for (let i = out.paints.length - 1; i >= 0; i--) {
      const r = out.paints[i]!.box;
      if (cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h) {
        return out.paints[i]!.color ?? undefined;
      }
    }
  }
  return ctx.slideBg ?? undefined;
}

function boxOfPlaceholder(ctx: SlideContext, el: Element, ph: { type?: string; idx?: string }) {
  return (
    boxOf(xfrmOf(el)) ??
    boxOf(child(child(findPlaceholder(ctx.layoutTree, ph), NS.p, "spPr"), NS.a, "xfrm")) ??
    boxOf(
      child(
        child(
          findPlaceholder(ctx.masterTree, { type: ph.type === "ctrTitle" ? "title" : ph.type }),
          NS.p,
          "spPr",
        ),
        NS.a,
        "xfrm",
      ),
    )
  );
}

function collect(ctx: SlideContext, tree: Element, out: Collected, grouped = false) {
  for (const el of resolveChildren(tree)) {
    if (!grouped && el.localName !== "AlternateContent") checkOffSlide(ctx, el, out);
    const paint = grouped ? undefined : paintOf(el, ctx.inh.colors);
    switch (el.localName) {
      case "sp": {
        const ph = placeholderOf(el);
        const body = child(el, NS.p, "txBody");
        if (body) {
          const box = ph ? boxOfPlaceholder(ctx, el, ph) : boxOf(xfrmOf(el));
          const text = readTextBody(
            ctx,
            body,
            el,
            ph,
            false,
            backgroundFor(ctx, out, box, paint, grouped),
          );
          out.texts.push(text);
          const written = text.paragraphs.some((p) => p.runs.some((r) => r.text.trim() !== ""));
          // An empty placeholder shows nothing in the show; a plain shape does, even without text.
          if (!ph || written) out.content++;
          if (text.kind === "title" && out.title === undefined) {
            const title = text.paragraphs
              .map((p) => p.runs.map((r) => r.text).join(""))
              .join(" ")
              .trim();
            if (title) out.title = title;
          }
        }
        if (!body && !ph) out.content++;
        if (child(child(el, NS.p, "spPr"), NS.a, "blipFill")) {
          out.pictures.push(
            pictureFrom(child(el, NS.p, "nvSpPr"), "picture", coversSlide(ctx, el)),
          );
          out.content++;
        }
        break;
      }
      case "pic": {
        const nvPr = child(child(el, NS.p, "nvPicPr"), NS.p, "nvPr");
        const isMedia = child(nvPr, NS.a, "videoFile") || child(nvPr, NS.a, "audioFile");
        if (!isMedia) {
          out.pictures.push(
            pictureFrom(child(el, NS.p, "nvPicPr"), "picture", coversSlide(ctx, el)),
          );
        }
        out.content++;
        break;
      }
      case "grpSp":
        collect(ctx, el, out, true);
        break;
      case "cxnSp":
        out.content++;
        break;
      case "graphicFrame": {
        out.content++;
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
    if (paint) out.paints.push(paint);
  }
}

const SCHEME_SLOTS = [
  "dk1",
  "lt1",
  "dk2",
  "lt2",
  "accent1",
  "accent2",
  "accent3",
  "accent4",
  "accent5",
  "accent6",
  "hlink",
  "folHlink",
];

function readTheme(zip: Zip, rels: Map<string, Relationship>, masterRoot: Element | undefined) {
  const themeRel = [...rels.values()].find((r) => typeTail(r.type) === "theme");
  const text = themeRel ? zip.text(themeRel.target) : undefined;
  const palette = new Map<string, string>();
  const clrMap = new Map<string, string>();
  const map = child(masterRoot, NS.p, "clrMap");
  for (const slot of ["bg1", "tx1", "bg2", "tx2"]) {
    const to = attr(map, slot);
    if (to) clrMap.set(slot, to);
  }
  if (!text) return { fonts: {}, colors: { palette, clrMap } };
  const theme = parseXml(text);
  const scheme = descendants(theme, NS.a, "fontScheme")[0];
  const clr = descendants(theme, NS.a, "clrScheme")[0];
  for (const slot of SCHEME_SLOTS) {
    const holder = child(clr, NS.a, slot);
    const c = child(holder, NS.a, "srgbClr") ?? child(holder, NS.a, "sysClr");
    const hex = (
      attr(c, "val") && c?.localName === "srgbClr" ? attr(c, "val") : attr(c, "lastClr")
    )?.toUpperCase();
    if (hex && HEX6.test(hex)) palette.set(slot, hex);
  }
  return {
    fonts: {
      major: attr(child(child(scheme, NS.a, "majorFont"), NS.a, "latin"), "typeface"),
      minor: attr(child(child(scheme, NS.a, "minorFont"), NS.a, "latin"), "typeface"),
    },
    colors: { palette, clrMap },
  };
}

// Text of the speaker notes: the body placeholder only, not the slide thumbnail or the number.
function readNotes(zip: Zip, rels: Map<string, Relationship>): string {
  const rel = [...rels.values()].find((r) => typeTail(r.type) === "notesSlide");
  const xml = rel ? zip.text(rel.target) : undefined;
  const tree = xml ? child(child(parseXml(xml), NS.p, "cSld"), NS.p, "spTree") : undefined;
  if (!tree) return "";
  return children(tree, NS.p, "sp")
    .filter((sp) => placeholderOf(sp)?.type === "body")
    .map((sp) =>
      children(child(sp, NS.p, "txBody") ?? sp, NS.a, "p")
        .map((p) => textFromParagraph(p))
        .join("\n"),
    )
    .join("\n")
    .trim();
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
    const rootOf = (p: string | undefined) => {
      const text = p ? zip.text(p) : undefined;
      return text ? parseXml(text) : undefined;
    };
    const treeOf = (root: Element | undefined) => child(child(root, NS.p, "cSld"), NS.p, "spTree");
    const masterRoot = rootOf(masterPart);
    const layoutRoot = rootOf(layoutPart);
    const { fonts: theme, colors } = readTheme(zip, masterRels, masterRoot);
    themeFonts.major ??= theme.major;
    themeFonts.minor ??= theme.minor;
    const slideRoot = rootOf(part);

    const ctx: SlideContext = {
      zip,
      part,
      rels,
      layoutTree: treeOf(layoutRoot),
      masterTree: masterRoot ? child(child(masterRoot, NS.p, "cSld"), NS.p, "spTree") : undefined,
      inh: {
        masterStyles: masterRoot ? child(masterRoot, NS.p, "txStyles") : undefined,
        defaultTextStyle,
        theme,
        colors,
      },
      slideParts: known,
      slideW: Number(attr(size, "cx") ?? 0),
      slideH: Number(attr(size, "cy") ?? 0),
      slideBg:
        backgroundOf(slideRoot, colors) ??
        backgroundOf(layoutRoot, colors) ??
        backgroundOf(masterRoot, colors) ??
        // No layer sets a background: PowerPoint paints white.
        "FFFFFF",
    };

    const root = slideRoot;
    const collected: Collected = {
      texts: [],
      pictures: [],
      tables: [],
      offSlide: [],
      content: 0,
      paints: [],
    };
    // Decoration drawn by the layout and master sits behind everything on the slide.
    for (const tree of [ctx.masterTree, ctx.layoutTree]) {
      for (const el of tree ? resolveChildren(tree) : []) {
        if (el.localName === "sp" && placeholderOf(el)) continue;
        const paint = paintOf(el, colors);
        if (paint) collected.paints.push(paint);
      }
    }
    const tree = treeOf(root);
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
      offSlide: collected.offSlide,
      contentCount: collected.content,
      notes: readNotes(zip, rels),
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
