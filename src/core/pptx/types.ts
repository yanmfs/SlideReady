export interface Relationship {
  id: string;
  type: string;
  target: string;
  external: boolean;
}

export interface TextRun {
  text: string;
  // Points after inheritance and autofit scaling; undefined when it cannot be resolved safely.
  size?: number;
  font?: string;
}

export interface Paragraph {
  runs: TextRun[];
  bullet: boolean;
}

export interface SlideText {
  paragraphs: Paragraph[];
  kind: "title" | "body" | "footer" | "other";
  inTable: boolean;
  fontScale?: number;
}

export interface Link {
  target: string;
  kind: "external" | "slide-jump" | "other";
  // Resolved part name for slide jumps; undefined when the target does not exist in the file.
  slideTarget?: string;
  missing?: boolean;
}

export interface MediaRef {
  relType: "image" | "video" | "audio" | "ole" | "other";
  target: string;
  external: boolean;
  // For embedded media: the zip part exists.
  partExists: boolean;
  size?: number;
}

export interface Picture {
  name: string;
  hasAlt: boolean;
  decorative: boolean;
  kind: "picture" | "chart";
}

export interface Table {
  name: string;
  hasHeader: boolean;
}

export interface Slide {
  index: number;
  part: string;
  hidden: boolean;
  title?: string;
  texts: SlideText[];
  links: Link[];
  media: MediaRef[];
  pictures: Picture[];
  tables: Table[];
  commentCount: number;
}

export interface Deck {
  fileSize: number;
  slideWidth: number;
  slideHeight: number;
  slides: Slide[];
  embeddedFonts: string[];
  themeFonts: { major?: string; minor?: string };
  mediaFiles: { part: string; size: number }[];
  author?: string;
  lastModifiedBy?: string;
}
