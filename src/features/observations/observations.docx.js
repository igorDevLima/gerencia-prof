// ===========================================================================
// observations.docx.js — gera o .docx da observação de aula, sem dependências.
// Escritor ZIP (store + CRC32) + montagem OOXML, reproduzindo o template
// oficial (timbre + tabelas de identificação, observação e feedback).
// ===========================================================================
import { CRITERIA } from "./observations.criteria.js";
import letterheadDataUri from "./assets/letterhead.jpeg";

// O timbre é embutido pelo webpack como data URI; guardamos só o base64.
const LETTERHEAD = { base64: String(letterheadDataUri).split(",")[1] || "", w: 726, h: 144 };

// ----------------------------------------------------------------- CRC32
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function utf8(str) { return new TextEncoder().encode(str); }

function base64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// ----------------------------------------------- escritor ZIP (método store)
function zipStore(files) {
  const parts = [];
  const central = [];
  let offset = 0;

  files.forEach((f) => {
    const nameBytes = utf8(f.name);
    const data = f.data;
    const crc = crc32(data);
    const size = data.length;

    const lh = new Uint8Array(30 + nameBytes.length);
    const dv = new DataView(lh.buffer);
    dv.setUint32(0, 0x04034b50, true);
    dv.setUint16(4, 20, true);
    dv.setUint16(6, 0, true);
    dv.setUint16(8, 0, true);
    dv.setUint16(10, 0, true);
    dv.setUint16(12, 0x21, true);
    dv.setUint32(14, crc, true);
    dv.setUint32(18, size, true);
    dv.setUint32(22, size, true);
    dv.setUint16(26, nameBytes.length, true);
    dv.setUint16(28, 0, true);
    lh.set(nameBytes, 30);
    parts.push(lh, data);

    const cd = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cd.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0x21, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    cd.set(nameBytes, 46);
    central.push(cd);

    offset += lh.length + data.length;
  });

  let centralSize = 0;
  central.forEach((c) => (centralSize += c.length));

  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  const all = parts.concat(central, [eocd]);
  let total = 0;
  all.forEach((a) => (total += a.length));
  const out = new Uint8Array(total);
  let p = 0;
  all.forEach((a) => { out.set(a, p); p += a.length; });
  return out;
}

// ----------------------------------------------------- builders OOXML
function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function rPr(o) {
  o = o || {};
  let s = "";
  if (o.font) s += `<w:rFonts w:ascii="${o.font}" w:hAnsi="${o.font}" w:cs="${o.font}"/>`;
  if (o.bold) s += "<w:b/>";
  if (o.italic) s += "<w:i/>";
  if (o.color) s += `<w:color w:val="${o.color}"/>`;
  if (o.size) s += `<w:sz w:val="${o.size}"/><w:szCs w:val="${o.size}"/>`;
  return s ? `<w:rPr>${s}</w:rPr>` : "";
}

function run(text, o) {
  const lines = String(text == null ? "" : text).split(/\r?\n/);
  const inner = lines
    .map((ln, i) => (i ? "<w:br/>" : "") + `<w:t xml:space="preserve">${esc(ln)}</w:t>`)
    .join("");
  return `<w:r>${rPr(o)}${inner}</w:r>`;
}

function pPr(o) {
  o = o || {};
  let s = "";
  if (o.align) s += `<w:jc w:val="${o.align}"/>`;
  if (o.before != null || o.after != null) {
    s += `<w:spacing${o.before != null ? ` w:before="${o.before}"` : ""}${o.after != null ? ` w:after="${o.after}"` : ""}/>`;
  }
  if (o.keepNext) s += "<w:keepNext/>";
  return s ? `<w:pPr>${s}</w:pPr>` : "";
}

function para(runsXml, o) { return `<w:p>${pPr(o)}${runsXml || ""}</w:p>`; }
function textPara(text, ro, po) { return para(run(text, ro), po); }

function cell(contentXml, o) {
  o = o || {};
  let pr = "";
  if (o.width) pr += `<w:tcW w:w="${o.width}" w:type="dxa"/>`;
  if (o.gridSpan) pr += `<w:gridSpan w:val="${o.gridSpan}"/>`;
  if (o.shade) pr += `<w:shd w:val="clear" w:color="auto" w:fill="${o.shade}"/>`;
  pr += `<w:vAlign w:val="${o.valign || "center"}"/>`;
  const content = contentXml && contentXml.length ? contentXml : para("");
  return `<w:tc><w:tcPr>${pr}</w:tcPr>${content}</w:tc>`;
}

function row(cellsXml, o) {
  o = o || {};
  let pr = "";
  if (o.header) pr += "<w:tblHeader/>";
  pr += "<w:cantSplit/>";
  return `<w:tr><w:trPr>${pr}</w:trPr>${cellsXml}</w:tr>`;
}

function table(rowsXml, colWidths) {
  const grid = colWidths.map((w) => `<w:gridCol w:w="${w}"/>`).join("");
  const total = colWidths.reduce((a, b) => a + b, 0);
  const B = (tag) => `<w:${tag} w:val="single" w:sz="4" w:space="0" w:color="808080"/>`;
  const borders = `<w:tblBorders>${B("top")}${B("left")}${B("bottom")}${B("right")}${B("insideH")}${B("insideV")}</w:tblBorders>`;
  const tblPr = `<w:tblPr><w:tblW w:w="${total}" w:type="dxa"/><w:tblLayout w:type="fixed"/>${borders}<w:tblCellMar><w:top w:w="40" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr>`;
  return `<w:tbl>${tblPr}<w:tblGrid>${grid}</w:tblGrid>${rowsXml}</w:tbl>`;
}

function heading(text) {
  return textPara(text, { bold: true, size: 24 }, { align: "center", before: 200, after: 100, keepNext: true });
}
function spacer() { return textPara("", { size: 8 }); }

export function formatDateBR(iso) {
  if (!iso) return "";
  const d = String(iso).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return String(iso);
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function imageParagraph(letterhead, usableTwips) {
  const EMU_PER_TWIP = 635;
  const cx = Math.round(usableTwips * EMU_PER_TWIP);
  const cy = Math.round(cx * (letterhead.h / letterhead.w));
  const drawing =
    `<w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">` +
    `<wp:extent cx="${cx}" cy="${cy}"/>` +
    `<wp:effectExtent l="0" t="0" r="0" b="0"/>` +
    `<wp:docPr id="1" name="Cabecalho"/>` +
    `<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>` +
    `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">` +
    `<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:nvPicPr><pic:cNvPr id="1" name="image1.jpeg"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="rIdImg"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
    `</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing>`;
  return `<w:p>${pPr({ align: "center", after: 120 })}<w:r>${drawing}</w:r></w:p>`;
}

function identificationTable(obs, W) {
  const rows = [];
  rows.push(row(cell(
    textPara(obs.escola || "", { bold: true, size: 22 }, { align: "center", after: 0 }),
    { width: W, shade: "EFEFEF" }
  )));
  const line = (label, value) =>
    row(cell(para(run(label, { bold: true }) + run(value || ""), { after: 0 }), { width: W }));
  rows.push(line("Etapa: ", obs.etapa));
  rows.push(line("Modalidade: ", obs.modalidade));
  rows.push(line("Turno: ", obs.turno));
  rows.push(line("Área de Conhecimento / Área Técnica: ", obs.area));
  rows.push(line("Coordenadora Pedagógica: ", obs.coordenadoraPedagogica));
  rows.push(line("Professor(a) Coordenador(a) de Área / Coordenador(a) de Curso Técnico: ", obs.coordenadorArea));
  rows.push(line("Disciplina: ", obs.disciplina));
  rows.push(line("Professor(a): ", obs.professor));
  rows.push(line("Série/Turma: ", obs.serieTurma));
  const data = formatDateBR(obs.dataObservacao);
  const dataTxt = data + (obs.horario ? `  (${obs.horario})` : "");
  rows.push(line("Data da observação: ", dataTxt));
  return table(rows.join(""), [W]);
}

function observationTable(obs, cols) {
  const head = row(
    ["Critério", "Sim", "Não", "Não foi possível observar", "Indicadores/Evidências"]
      .map((t, i) => cell(textPara(t, { bold: true, size: 18 }, { align: i === 0 || i === 4 ? "left" : "center", after: 0 }),
        { width: cols[i], shade: "D9E2F3", valign: "center" })).join(""),
    { header: true }
  );
  const body = CRITERIA.map((crit, idx) => {
    const c = (obs.criterios && obs.criterios[idx]) || {};
    const mark = c.mark || "";
    const x = (m) => textPara(mark === m ? "X" : "", { bold: true }, { align: "center", after: 0 });
    return row(
      cell(textPara(crit, { size: 18 }, { after: 0 }), { width: cols[0] }) +
      cell(x("sim"), { width: cols[1] }) +
      cell(x("nao"), { width: cols[2] }) +
      cell(x("na"), { width: cols[3] }) +
      cell(textPara(c.evidencias || "", { size: 18 }, { after: 0 }), { width: cols[4] })
    );
  }).join("");
  const total = cols.reduce((a, b) => a + b, 0);
  const obsRow = row(cell(
    para(run("Observações: ", { bold: true }) + run(obs.observacoes || ""), { after: 0 }),
    { gridSpan: cols.length, width: total }
  ));
  return table(head + body + obsRow, cols);
}

function feedbackTable(obs, W) {
  const sectionHead = (t) => row(cell(textPara(t, { bold: true, size: 20 }, { after: 0 }), { width: W, shade: "D9E2F3" }));
  const textRow = (t) => row(cell(textPara(t || "", { size: 20 }, { after: 0 }), { width: W, valign: "top" }));
  const rows = [];
  rows.push(sectionHead("Registro de Evidências"));
  rows.push(textRow(obs.registroEvidencias));
  rows.push(sectionHead("Sugestões/Orientações"));
  rows.push(textRow(obs.sugestoes));
  rows.push(row(cell(para(run("Data do Feedback: ", { bold: true }) + run(formatDateBR(obs.dataFeedback)), { after: 0 }), { width: W })));

  const sig = obs.assinaturas || {};
  const sigRow = (label, name) => row(cell(
    para(run(label, { bold: true }), { after: 0 }) +
    textPara(name || "", { size: 20 }, { before: 120, after: 0 }),
    { width: W, valign: "top" }
  ));
  rows.push(sigRow("Assinatura do(a) Professor(a) Regente:", sig.regente));
  rows.push(sigRow("Assinatura do(a) Professor(a) Coordenador(a) de Área / Coordenador(a) de Curso Técnico:", sig.coordenadorArea));
  rows.push(sigRow("Assinatura da Pedagoga:", sig.pedagoga));
  rows.push(sigRow("Assinatura da Coordenadora Pedagógica:", sig.coordenadoraPedagogica));
  return table(rows.join(""), [W]);
}

function buildDocumentXml(obs, letterhead) {
  const PAGE_W = 11906, MAR_L = 1080, MAR_R = 1080;
  const usable = PAGE_W - MAR_L - MAR_R;
  const obsCols = [3300, 560, 560, 1480, usable - 3300 - 560 - 560 - 1480];

  let body = "";
  if (letterhead && letterhead.base64) body += imageParagraph(letterhead, usable);
  body += identificationTable(obs, usable);
  body += spacer();
  body += heading("PROTOCOLO PARA OBSERVAÇÃO DE AULA");
  body += observationTable(obs, obsCols);
  body += spacer();
  body += heading("PROTOCOLO DO FEEDBACK");
  body += feedbackTable(obs, usable);
  body += para(""); // parágrafo final antes do sectPr (compatibilidade com o Word)

  const sectPr =
    `<w:sectPr><w:pgSz w:w="${PAGE_W}" w:h="16838"/>` +
    `<w:pgMar w:top="720" w:right="${MAR_R}" w:bottom="720" w:left="${MAR_L}" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>`;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n` +
    `<w:document ` +
    `xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ` +
    `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ` +
    `xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" ` +
    `xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ` +
    `xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<w:body>${body}${sectPr}</w:body></w:document>`;
}

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n` +
  `<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
  `<w:docDefaults><w:rPrDefault><w:rPr>` +
  `<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/>` +
  `</w:rPr></w:rPrDefault><w:pPrDefault><w:pPr>` +
  `<w:spacing w:after="120" w:line="259" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>` +
  `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>` +
  `</w:styles>`;

function rootRels() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>` +
    `</Relationships>`;
}

function documentRels(hasImage) {
  let r = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`;
  if (hasImage) {
    r += `<Relationship Id="rIdImg" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.jpeg"/>`;
  }
  return r + `</Relationships>`;
}

function contentTypes(hasImage) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    (hasImage ? `<Default Extension="jpeg" ContentType="image/jpeg"/>` : "") +
    `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
    `<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>` +
    `</Types>`;
}

// Gera os bytes (Uint8Array) do .docx. opts.letterhead sobrescreve o timbre padrão.
export function buildDocx(obs, opts) {
  opts = opts || {};
  const letterhead = opts.letterhead || LETTERHEAD;
  const hasImage = !!(letterhead && letterhead.base64);
  const files = [
    { name: "[Content_Types].xml", data: utf8(contentTypes(hasImage)) },
    { name: "_rels/.rels", data: utf8(rootRels()) },
    { name: "word/document.xml", data: utf8(buildDocumentXml(obs, hasImage ? letterhead : null)) },
    { name: "word/styles.xml", data: utf8(STYLES_XML) },
    { name: "word/_rels/document.xml.rels", data: utf8(documentRels(hasImage)) },
  ];
  if (hasImage) {
    files.push({ name: "word/media/image1.jpeg", data: base64ToBytes(letterhead.base64) });
  }
  return zipStore(files);
}
