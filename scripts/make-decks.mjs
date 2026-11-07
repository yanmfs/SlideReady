// Builds small fictional .pptx files, one per rule, plus a clean deck that must raise no errors or warnings.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import pptxgen from "pptxgenjs";

const PIXEL =
  "image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

function master(pres) {
  pres.defineSlideMaster({
    title: "M",
    objects: [
      {
        placeholder: {
          options: {
            name: "title",
            type: "title",
            x: 0.5,
            y: 0.4,
            w: 12,
            h: 1,
            fontFace: "Arial",
            fontSize: 32,
          },
          text: "",
        },
      },
      {
        placeholder: {
          options: {
            name: "body",
            type: "body",
            x: 0.5,
            y: 1.6,
            w: 12,
            h: 4,
            fontFace: "Arial",
            fontSize: 24,
          },
          text: "",
        },
      },
    ],
  });
}

// `slides` is a list of { title, body, extra(slide) } where title may be null for an untitled slide.
async function build({ layout = "LAYOUT_WIDE", slides }) {
  const pres = new pptxgen();
  pres.layout = layout;
  master(pres);
  slides.forEach((spec) => {
    const slide = pres.addSlide({ masterName: "M" });
    if (spec.title) slide.addText(spec.title, { placeholder: "title" });
    slide.addText(spec.body ?? "Conteúdo de exemplo", { placeholder: "body" });
    spec.extra?.(slide);
  });
  return pres.write({ outputType: "uint8array" });
}

function patch(bytes, edit) {
  const files = unzipSync(bytes);
  const text = (name) => strFromU8(files[name]);
  const set = (name, value) => {
    files[name] = typeof value === "string" ? strToU8(value) : value;
  };
  edit({ files, text, set });
  return zipSync(files);
}

const slideRels = (n) => `ppt/slides/_rels/slide${n}.xml.rels`;
const addRel = ({ text, set }, n, type, target, external = false) => {
  const rels = text(slideRels(n));
  const id = `rId${900 + (rels.match(/<Relationship /g) ?? []).length}`;
  set(
    slideRels(n),
    rels.replace(
      "</Relationships>",
      `<Relationship Id="${id}" Type="${REL}/${type}" Target="${target}"${external ? ' TargetMode="External"' : ""}/></Relationships>`,
    ),
  );
};

const two = [
  { title: "Resultados do trimestre", body: "Receita cresceu em todas as regiões." },
  { title: "Próximos passos", body: "Definir responsáveis e prazos." },
];

export async function buildDecks() {
  const decks = {};
  decks.clean = await build({
    slides: [
      {
        title: "Resultados do trimestre",
        body: "Receita cresceu em todas as regiões.",
        extra: (s) =>
          s.addImage({ data: PIXEL, x: 1, y: 5, w: 1, h: 1, altText: "Gráfico de receita" }),
      },
      { title: "Próximos passos", body: "Definir responsáveis e prazos." },
    ],
  });

  decks["link-local-file"] = await build({
    slides: [
      {
        title: "Dados",
        extra: (s) =>
          s.addText(
            [
              {
                text: "planilha",
                options: { hyperlink: { url: "file:///C:/Users/ana/Documents/planilha.xlsx" } },
              },
            ],
            { x: 1, y: 5.5, w: 4, h: 0.5, fontFace: "Arial", fontSize: 20 },
          ),
      },
      {
        title: "Mais dados",
        extra: (s) =>
          s.addText([{ text: "relativo", options: { hyperlink: { url: "dados.xlsx" } } }], {
            x: 1,
            y: 5.5,
            w: 4,
            h: 0.5,
            fontFace: "Arial",
            fontSize: 20,
          }),
      },
    ],
  });
  decks["link-malformed"] = await build({
    slides: [
      {
        title: "Site",
        extra: (s) =>
          s.addText(
            [{ text: "site", options: { hyperlink: { url: "http://exa mple.com/pagina" } } }],
            { x: 1, y: 5.5, w: 4, h: 0.5, fontFace: "Arial", fontSize: 20 },
          ),
      },
    ],
  });
  decks["link-slide-jump"] = patch(
    await build({
      slides: [
        {
          title: "Início",
          extra: (s) =>
            s.addText([{ text: "ir", options: { hyperlink: { slide: 2, tooltip: "x" } } }], {
              x: 1,
              y: 5.5,
              w: 4,
              h: 0.5,
              fontFace: "Arial",
              fontSize: 20,
            }),
        },
        { title: "Fim" },
      ],
    }),
    ({ text, set }) =>
      set(
        slideRels(1),
        text(slideRels(1)).replace(/slides\/slide2\.xml|slide2\.xml/, "slide99.xml"),
      ),
  );
  decks["link-ok"] = await build({
    slides: [
      {
        title: "Início",
        extra: (s) =>
          s.addText(
            [
              { text: "ir", options: { hyperlink: { slide: 2, tooltip: "x" } } },
              { text: " e ", options: {} },
              {
                text: "site",
                options: { hyperlink: { url: "https://exemplo.com.br/pagina?a=1" } },
              },
            ],
            { x: 1, y: 5.5, w: 6, h: 0.5, fontFace: "Arial", fontSize: 20 },
          ),
      },
      { title: "Fim" },
    ],
  });

  decks["media-linked"] = patch(await build({ slides: two }), (ctx) =>
    addRel(ctx, 1, "video", "file:///C:/Users/ana/Videos/demo.mp4", true),
  );
  decks["media-missing-part"] = patch(
    await build({
      slides: [
        {
          title: "Imagem",
          extra: (s) => s.addImage({ data: PIXEL, x: 1, y: 5, w: 1, h: 1, altText: "Pixel" }),
        },
      ],
    }),
    ({ text, set }) =>
      set(slideRels(1), text(slideRels(1)).replace(/\.\.\/media\/[^"]+/, "../media/ausente.png")),
  );
  decks["media-format"] = patch(await build({ slides: two }), (ctx) => {
    ctx.set("ppt/media/clip.wmv", new Uint8Array(1024));
    addRel(ctx, 1, "video", "../media/clip.wmv");
  });
  decks["media-heavy"] = patch(await build({ slides: two }), (ctx) => {
    ctx.set("ppt/media/grande.mp4", new Uint8Array(21 * 1024 * 1024));
    addRel(ctx, 1, "video", "../media/grande.mp4");
  });

  const fontSlide = (face) => ({
    title: "Fontes",
    extra: (s) =>
      s.addText("Texto em outra fonte", {
        x: 1,
        y: 5.5,
        w: 6,
        h: 0.6,
        fontFace: face,
        fontSize: 24,
      }),
  });
  decks["font-missing"] = await build({ slides: [fontSlide("Zorblax Display")] });
  decks["font-risky"] = await build({ slides: [fontSlide("Helvetica Neue")] });
  decks["font-embedded"] = patch(
    await build({ slides: [fontSlide("Zorblax Display")] }),
    ({ text, set }) =>
      set(
        "ppt/presentation.xml",
        text("ppt/presentation.xml").replace(
          /(<p:notesSz [^>]*\/>)/,
          '$1<p:embeddedFontLst><p:embeddedFont><p:font typeface="Zorblax Display"/></p:embeddedFont></p:embeddedFontLst>',
        ),
      ),
  );

  decks["text-placeholder"] = await build({
    slides: [{ title: "Visão geral", body: "Lorem ipsum dolor sit amet" }],
  });
  decks["text-small"] = await build({
    slides: [
      {
        title: "Rodapé",
        extra: (s) =>
          s.addText("Texto pequeno de apoio", {
            x: 1,
            y: 5.5,
            w: 6,
            h: 0.5,
            fontFace: "Arial",
            fontSize: 14,
          }),
      },
    ],
  });
  decks["text-tiny"] = await build({
    slides: [
      {
        title: "Rodapé",
        extra: (s) =>
          s.addText("Texto minúsculo ilegível", {
            x: 1,
            y: 5.5,
            w: 6,
            h: 0.5,
            fontFace: "Arial",
            fontSize: 9,
          }),
      },
    ],
  });
  decks["text-autofit"] = patch(
    await build({ slides: [{ title: "Muito texto", body: "Linha de conteúdo" }] }),
    ({ text, set }) =>
      set(
        "ppt/slides/slide1.xml",
        text("ppt/slides/slide1.xml").replace(
          /<a:bodyPr wrap="square" rtlCol="0"><\/a:bodyPr>/g,
          '<a:bodyPr wrap="square" rtlCol="0"><a:normAutofit fontScale="62500" lnSpcReduction="20000"/></a:bodyPr>',
        ),
      ),
  );
  decks["text-inherited"] = patch(
    await build({ slides: [{ title: "Herdado", body: "Texto sem tamanho próprio" }] }),
    ({ text, set }) => {
      let xml = text("ppt/slides/slide1.xml");
      xml = xml.replace(
        /(type="body"[\s\S]*?<a:lstStyle)\/>/,
        '$1><a:lvl1pPr><a:defRPr sz="1000"/></a:lvl1pPr></a:lstStyle>',
      );
      xml = xml.replace(/(type="body"[\s\S]*?<\/p:sp>)/, (shape) =>
        shape.replace(/ sz="2400"/g, ""),
      );
      set("ppt/slides/slide1.xml", xml);
    },
  );
  decks["text-dense"] = await build({
    slides: [
      { title: "Denso", body: Array.from({ length: 70 }, (_, i) => `palavra${i}`).join(" ") },
    ],
  });

  const picture = (alt) => (s) => s.addImage({ data: PIXEL, x: 1, y: 5, w: 1, h: 1, altText: alt });
  decks["a11y-alt-missing"] = patch(
    await build({ slides: [{ title: "Foto", extra: picture("x") }] }),
    ({ text, set }) =>
      set(
        "ppt/slides/slide1.xml",
        text("ppt/slides/slide1.xml").replace(/descr="[^"]*"/, 'descr=""'),
      ),
  );
  decks["a11y-decorative"] = patch(
    await build({ slides: [{ title: "Foto", extra: picture("x") }] }),
    ({ text, set }) =>
      set(
        "ppt/slides/slide1.xml",
        text("ppt/slides/slide1.xml").replace(
          /descr="[^"]*">/,
          'descr=""><a:extLst><a:ext uri="{C183D7F6-B498-43B3-948B-1728B52AA6E4}"><adec:decorative xmlns:adec="http://schemas.microsoft.com/office/drawing/2017/decorative" val="1"/></a:ext></a:extLst>',
        ),
      ),
  );
  decks["a11y-no-title"] = await build({
    slides: [{ title: null, body: "Slide sem título" }, { title: "Com título" }],
  });
  decks["a11y-duplicate-title"] = await build({
    slides: [{ title: "Resumo" }, { title: "Outro" }, { title: "  resumo " }],
  });
  const table = (s) =>
    s.addTable(
      [
        [{ text: "Nome" }, { text: "Valor" }],
        [{ text: "A" }, { text: "1" }],
      ],
      { x: 1, y: 5, w: 5, fontFace: "Arial", fontSize: 14 },
    );
  decks["a11y-table-header"] = await build({ slides: [{ title: "Tabela", extra: table }] });
  decks["a11y-table-ok"] = patch(
    await build({ slides: [{ title: "Tabela", extra: table }] }),
    ({ text, set }) =>
      set(
        "ppt/slides/slide1.xml",
        text("ppt/slides/slide1.xml").replace("<a:tblPr/>", '<a:tblPr firstRow="1"/>'),
      ),
  );

  decks["hygiene-hidden"] = patch(await build({ slides: two }), ({ text, set }) =>
    set(
      "ppt/slides/slide2.xml",
      text("ppt/slides/slide2.xml").replace("<p:sld ", '<p:sld show="0" '),
    ),
  );
  decks["hygiene-comments"] = patch(await build({ slides: two }), (ctx) => {
    ctx.set(
      "ppt/comments/comment1.xml",
      '<?xml version="1.0"?><p:cmLst xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cm authorId="0" idx="1"><p:text>Revisar</p:text></p:cm></p:cmLst>',
    );
    addRel(ctx, 1, "comments", "../comments/comment1.xml");
  });
  decks["deck-aspect"] = await build({ layout: "LAYOUT_4x3", slides: two });

  decks["shuffled"] = patch(
    await build({
      slides: [
        { title: "A primeiro no arquivo" },
        { title: "B segundo no arquivo" },
        { title: "C terceiro no arquivo" },
      ],
    }),
    ({ text, set }) => {
      const xml = text("ppt/presentation.xml");
      const ids = xml.match(/<p:sldId [^>]*\/>/g) ?? [];
      const [a, b, c] = ids;
      set("ppt/presentation.xml", xml.replace(ids.join(""), [c, a, b].join("")));
    },
  );
  decks["alternate-content"] = patch(
    await build({ slides: [{ title: "Alternativo", extra: picture("Escolha") }] }),
    ({ text, set }) => {
      const xml = text("ppt/slides/slide1.xml");
      const pic = /<p:pic>[\s\S]*?<\/p:pic>/.exec(xml)?.[0] ?? "";
      const fallback = pic.replace(/descr="[^"]*"/, 'descr=""');
      const wrapped = `<mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"><mc:Choice Requires="p14">${pic}</mc:Choice><mc:Fallback>${fallback}</mc:Fallback></mc:AlternateContent>`;
      set("ppt/slides/slide1.xml", xml.replace(pic, wrapped));
    },
  );

  const txt = (s, text, opts) =>
    s.addText(text, { x: 1, y: 5.2, w: 6, h: 0.6, fontFace: "Arial", fontSize: 24, ...opts });
  decks["contrast-warning"] = await build({
    slides: [
      { title: "Contraste", extra: (s) => txt(s, "Texto cinza claro", { color: "888888" }) },
    ],
  });
  decks["contrast-error"] = await build({
    slides: [
      { title: "Contraste", extra: (s) => txt(s, "Texto quase invisível", { color: "DDDDDD" }) },
    ],
  });
  decks["contrast-dark-panel"] = await build({
    slides: [
      {
        title: "Painel escuro",
        extra: (s) => {
          s.addShape("rect", { x: 0.5, y: 5, w: 8, h: 1.2, fill: { color: "1F2937" } });
          txt(s, "Texto branco sobre painel", { color: "FFFFFF" });
        },
      },
    ],
  });
  decks["off-slide"] = await build({
    slides: [
      {
        title: "Fora da área",
        extra: (s) => txt(s, "Caixa esquecida", { x: 14, y: 2, w: 3, h: 1 }),
      },
      { title: "Dentro da área" },
    ],
  });
  decks.metadata = patch(decks.clean, ({ text, set }) =>
    set(
      "docProps/core.xml",
      text("docProps/core.xml")
        .replace(/<dc:creator>[^<]*<\/dc:creator>/, "<dc:creator>Maria Fictícia</dc:creator>")
        .replace(
          /<cp:lastModifiedBy>[^<]*<\/cp:lastModifiedBy>/,
          "<cp:lastModifiedBy>Maria Fictícia</cp:lastModifiedBy>",
        ),
    ),
  );

  decks.demo = patch(
    await build({
      slides: [
        {
          title: "Resultados do trimestre",
          body: "Lorem ipsum dolor sit amet",
          extra: (s) =>
            s.addText(
              [
                {
                  text: "planilha de vendas",
                  options: { hyperlink: { url: "file:///C:/Users/ana/Documents/vendas.xlsx" } },
                },
              ],
              { x: 1, y: 5.5, w: 5, h: 0.5, fontFace: "Zorblax Display", fontSize: 20 },
            ),
        },
        {
          title: "Próximos passos",
          body: "Definir responsáveis e prazos.",
          extra: (s) =>
            s.addText("Fonte: relatório interno", {
              x: 1,
              y: 5.8,
              w: 5,
              h: 0.4,
              fontFace: "Arial",
              fontSize: 10,
            }),
        },
        { title: "Anexos", body: "Dados de apoio" },
      ],
    }),
    ({ text, set }) =>
      set(
        "ppt/slides/slide3.xml",
        text("ppt/slides/slide3.xml").replace("<p:sld ", '<p:sld show="0" '),
      ),
  );
  return decks;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = join(dirname(fileURLToPath(import.meta.url)), "..", "tests", "fixtures", "decks");
  mkdirSync(out, { recursive: true });
  for (const [name, bytes] of Object.entries(await buildDecks()))
    writeFileSync(join(out, `${name}.pptx`), bytes);
}
