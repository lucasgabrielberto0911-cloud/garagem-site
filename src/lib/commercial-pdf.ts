import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { formatAdminMoney } from "./admin-money";
import { moneyInWords } from "./money-words";
import { SEO_LOCAL_CITY } from "./seo-local";
import { site } from "./site";

/** Campos opcionais não existem em documentos antigos; nesse caso a coluna/linha é omitida. */
export type DocumentSnapshot = {
  customer: string; cpf: string; phone: string; vehicle: string; plate: string; amount: number; payment: string; conditions: string; seller: string; date: string;
  year?: number; yearModel?: number; color?: string; km?: number; total?: number;
};

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 44;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_Y = 40;
const BOTTOM = 74; // limite inferior do conteúdo (acima do rodapé)
const SECTION_GAP = 30; // ritmo vertical: espaço antes de toda seção

const ASPHALT = rgb(0.051, 0.051, 0.059); // #0D0D0F
const BRAND = rgb(0.91, 0.094, 0.11); // #E8181C
const CREAM = rgb(0.969, 0.961, 0.949); // #F7F5F2
const MUTED = rgb(0.4, 0.4, 0.42);
const LINE = rgb(0.85, 0.84, 0.82);
const WHITE = rgb(1, 1, 1);
const SOFT = rgb(0.78, 0.77, 0.75);

// logo.png é quadrado (1024 px) com o wordmark centralizado; medidas em fração da imagem.
const LOGO_SIZE = 190;
const LOGO_WORD_LEFT = 0.093;
const LOGO_WORD_CENTER_Y = 0.488;

const clean = (value: string) => value.replace(/[\x00-\x08\x0B-\x1F\x7F]/g, "").replace(/ /g, " ");
const money = (value: number) => clean(formatAdminMoney(value));

const RECEIPT_TERMS = [
  "O sinal é parte do pagamento e será abatido do valor total do veículo na conclusão do negócio.",
  "O veículo fica reservado ao cliente pelo prazo combinado; vencido o prazo sem a conclusão, a reserva pode ser desfeita.",
  "A devolução ou a retenção do sinal segue o que foi combinado entre as partes no momento da reserva.",
  "Este recibo não substitui o contrato de compra e venda nem a transferência do veículo.",
];

export async function commercialPdf(kind: string, data: DocumentSnapshot, id: string) {
  const isReceipt = kind === "recibo";
  const docTitle = isReceipt ? "Recibo de sinal" : "Proposta comercial";
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const [titleBytes, regularBytes, semiBytes, logoBytes] = await Promise.all([
    readFile(path.join(process.cwd(), "public/fonts/Sora-Bold.ttf")),
    readFile(path.join(process.cwd(), "public/fonts/Inter-Regular.ttf")),
    readFile(path.join(process.cwd(), "public/fonts/Inter-SemiBold.ttf")),
    readFile(path.join(process.cwd(), "public/logo.png")),
  ]);
  const title = await pdf.embedFont(titleBytes, { subset: true });
  // Inter fica sem subset: o subset do fontkit perde glifos nessa fonte.
  const regular = await pdf.embedFont(regularBytes);
  const semi = await pdf.embedFont(semiBytes);
  const logo = await pdf.embedPng(logoBytes);

  const issued = new Date(data.date);
  const validDate = !Number.isNaN(issued.getTime());
  const tz = "America/Sao_Paulo";
  const issuedText = validDate
    ? issued.toLocaleString("pt-BR", { timeZone: tz, dateStyle: "short", timeStyle: "short" }).replace(",", " às")
    : "—";
  const longDate = validDate ? issued.toLocaleDateString("pt-BR", { timeZone: tz, dateStyle: "long" }) : "";

  // Quebra por palavras; palavras maiores que a largura quebram por caractere.
  function wrap(value: string, font: PDFFont, size: number, width: number) {
    const lines: string[] = [];
    for (const paragraph of clean(value).split("\n")) {
      let current = "";
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        const next = current ? `${current} ${word}` : word;
        if (font.widthOfTextAtSize(next, size) <= width) { current = next; continue; }
        if (current) lines.push(current);
        current = "";
        for (const char of word) {
          if (current && font.widthOfTextAtSize(current + char, size) > width) { lines.push(current); current = ""; }
          current += char;
        }
      }
      lines.push(current);
    }
    return lines;
  }

  const pages: PDFPage[] = [];
  let page!: PDFPage;
  let y = 0;
  let topY = 0;

  function drawLogo(target: PDFPage, centerY: number, scale: number) {
    const size = LOGO_SIZE * scale;
    target.drawImage(logo, {
      x: MARGIN - LOGO_WORD_LEFT * size,
      y: centerY - (1 - LOGO_WORD_CENTER_Y) * size,
      width: size,
      height: size,
    });
  }

  function newPage(first: boolean) {
    page = pdf.addPage([PAGE_W, PAGE_H]);
    pages.push(page);
    // O logo vem primeiro: a imagem tem fundo branco e não pode cobrir o resto.
    if (first) {
      drawLogo(page, PAGE_H - 66, 1);
      page.drawText(`${site.legalName} · CNPJ ${site.cnpj}`, { x: MARGIN, y: PAGE_H - 92, size: 8, font: semi, color: ASPHALT });
      page.drawText(`WhatsApp ${site.whatsappLabel} · ${site.email}`, { x: MARGIN, y: PAGE_H - 104, size: 8, font: regular, color: MUTED });
      const right = PAGE_W - MARGIN;
      const t = docTitle.toUpperCase();
      page.drawText(t, { x: right - title.widthOfTextAtSize(t, 15), y: PAGE_H - 58, size: 15, font: title, color: ASPHALT });
      const meta = `Nº ${clean(id)}`;
      page.drawText(meta, { x: right - semi.widthOfTextAtSize(meta, 9), y: PAGE_H - 75, size: 9, font: semi, color: BRAND });
      const dateText = `Emitido em ${issuedText}`;
      page.drawText(dateText, { x: right - regular.widthOfTextAtSize(dateText, 9), y: PAGE_H - 88, size: 9, font: regular, color: MUTED });
      page.drawRectangle({ x: 0, y: PAGE_H - 122, width: PAGE_W, height: 4, color: BRAND });
      y = PAGE_H - 126;
    } else {
      drawLogo(page, PAGE_H - 52, 0.7);
      const t = `${docTitle} · Nº ${clean(id)}`;
      page.drawText(t, { x: PAGE_W - MARGIN - regular.widthOfTextAtSize(t, 9), y: PAGE_H - 56, size: 9, font: regular, color: MUTED });
      page.drawRectangle({ x: 0, y: PAGE_H - 76, width: PAGE_W, height: 3, color: BRAND });
      y = PAGE_H - 104;
    }
    topY = y;
  }

  function ensure(height: number) {
    if (y - height < BOTTOM) newPage(false);
  }

  // Toda seção começa com o mesmo espaço, exceto no topo da página.
  function section(label: string, bodyHeight = 20) {
    if (y < topY) y -= SECTION_GAP;
    else y -= 24;
    ensure(28 + bodyHeight); // título e corpo ficam juntos
    page.drawRectangle({ x: MARGIN, y: y - 3, width: 3, height: 13, color: BRAND });
    page.drawText(label.toUpperCase(), { x: MARGIN + 10, y, size: 10, font: title, color: ASPHALT });
    page.drawLine({ start: { x: MARGIN, y: y - 9 }, end: { x: PAGE_W - MARGIN, y: y - 9 }, thickness: 0.6, color: LINE });
    y -= 28;
  }

  // Linha de campos: rótulo pequeno em cima, valor embaixo.
  function fields(items: { label: string; value: string; weight?: number }[]) {
    const total = items.reduce((sum, item) => sum + (item.weight ?? 1), 0);
    const gap = 16;
    const usable = CONTENT_W - gap * (items.length - 1);
    const cols = items.map((item) => ({ ...item, width: (usable * (item.weight ?? 1)) / total }));
    const wrapped = cols.map((col) => wrap(col.value || "—", regular, 11, col.width));
    const rows = Math.max(...wrapped.map((lines) => lines.length));
    ensure(14 + rows * 15);
    let x = MARGIN;
    cols.forEach((col, i) => {
      page.drawText(col.label.toUpperCase(), { x, y, size: 7.5, font: semi, color: MUTED });
      wrapped[i].forEach((text, row) => page.drawText(text, { x, y: y - 15 - row * 15, size: 11, font: regular, color: ASPHALT }));
      x += col.width + gap;
    });
    y -= 14 + rows * 15;
  }

  function paragraph(text: string, size = 10.5, bullet = false) {
    const lines = wrap(text, regular, size, CONTENT_W - (bullet ? 14 : 0));
    ensure(lines.length * 15);
    lines.forEach((line, i) => {
      if (bullet && i === 0) page.drawRectangle({ x: MARGIN + 1, y: y + 3, width: 3, height: 3, color: BRAND });
      if (line) page.drawText(line, { x: MARGIN + (bullet ? 14 : 0), y, size, font: regular, color: ASPHALT });
      y -= 15;
    });
  }

  newPage(true);

  section("Cliente");
  fields([{ label: "Nome", value: data.customer, weight: 2 }, { label: "CPF", value: data.cpf || "Não informado" }, { label: "Telefone", value: data.phone }]);

  section("Veículo");
  {
    const yearText = data.yearModel ? (data.year && data.year !== data.yearModel ? `${data.year}/${data.yearModel}` : String(data.yearModel)) : "";
    const kmText = typeof data.km === "number" ? `${new Intl.NumberFormat("pt-BR").format(data.km)} km` : "";
    // Colunas opcionais só aparecem quando o dado existe (sem chassi/renavam no cadastro).
    const cols = [
      { label: "Marca / modelo", value: data.vehicle, width: 0 },
      ...(yearText ? [{ label: "Ano", value: yearText, width: 84 }] : []),
      ...(data.color ? [{ label: "Cor", value: data.color, width: 80 }] : []),
      ...(kmText ? [{ label: "Km", value: kmText, width: 78 }] : []),
      { label: "Placa", value: data.plate || "Não informada", width: 86 },
    ];
    const fixed = cols.reduce((sum, col) => sum + col.width, 0);
    cols[0].width = CONTENT_W - fixed;
    const wrapped = cols.map((col) => wrap(col.value, col === cols[0] ? regular : semi, 10.5, col.width - 20));
    const rowH = Math.max(32, Math.max(...wrapped.map((l) => l.length)) * 14 + 16);
    ensure(24 + rowH);
    page.drawRectangle({ x: MARGIN, y: y - 24, width: CONTENT_W, height: 24, color: ASPHALT });
    const top = y - 24;
    page.drawRectangle({ x: MARGIN, y: top - rowH, width: CONTENT_W, height: rowH, color: CREAM, borderColor: LINE, borderWidth: 0.6 });
    let x = MARGIN;
    cols.forEach((col, i) => {
      page.drawText(col.label.toUpperCase(), { x: x + 10, y: y - 16, size: 7.5, font: semi, color: WHITE });
      if (i > 0) page.drawLine({ start: { x, y: top }, end: { x, y: top - rowH }, thickness: 0.6, color: LINE });
      wrapped[i].forEach((text, row) => page.drawText(text, { x: x + 10, y: top - 20 - row * 14, size: 10.5, font: i === 0 ? regular : semi, color: ASPHALT }));
      x += col.width;
    });
    y = top - rowH;
  }

  section("Valores");
  {
    const hasTotal = isReceipt && typeof data.total === "number" && data.total > 0;
    const balance = hasTotal ? Math.max(0, Math.round((data.total! - data.amount) * 100) / 100) : 0;
    const label = isReceipt ? "Sinal recebido" : "Valor proposto";
    const payLines = wrap(data.payment, regular, 10.5, CONTENT_W - 40);
    const headH = 66; // rótulo + valor principal
    const summaryH = hasTotal ? 46 : 0;
    const boxH = headH + summaryH + 34 + payLines.length * 14;
    ensure(boxH);
    const top = y;
    page.drawRectangle({ x: MARGIN, y: top - boxH, width: CONTENT_W, height: boxH, color: ASPHALT });
    page.drawRectangle({ x: MARGIN, y: top - boxH, width: 5, height: boxH, color: BRAND });
    page.drawText(label.toUpperCase(), { x: MARGIN + 20, y: top - 24, size: 8, font: semi, color: SOFT });
    const amountText = money(data.amount);
    let size = 28;
    while (size > 14 && title.widthOfTextAtSize(amountText, size) > CONTENT_W - 40) size -= 1;
    page.drawText(amountText, { x: MARGIN + 20, y: top - 54, size, font: title, color: WHITE });
    let cursor = top - headH;
    if (hasTotal) {
      page.drawLine({ start: { x: MARGIN + 20, y: cursor }, end: { x: MARGIN + CONTENT_W - 20, y: cursor }, thickness: 0.5, color: rgb(0.25, 0.25, 0.27) });
      const half = (CONTENT_W - 40) / 2;
      [["Valor total do veículo", money(data.total!), WHITE], ["Saldo restante", money(balance), WHITE]].forEach(([lab, val, color], i) => {
        const x = MARGIN + 20 + i * half;
        page.drawText((lab as string).toUpperCase(), { x, y: cursor - 20, size: 7.5, font: semi, color: SOFT });
        page.drawText(val as string, { x, y: cursor - 38, size: 13, font: title, color: color as typeof WHITE });
      });
      cursor -= summaryH;
    }
    page.drawLine({ start: { x: MARGIN + 20, y: cursor }, end: { x: MARGIN + CONTENT_W - 20, y: cursor }, thickness: 0.5, color: rgb(0.25, 0.25, 0.27) });
    page.drawText("FORMA DE PAGAMENTO", { x: MARGIN + 20, y: cursor - 20, size: 7.5, font: semi, color: SOFT });
    payLines.forEach((text, i) => page.drawText(text, { x: MARGIN + 20, y: cursor - 35 - i * 14, size: 10.5, font: regular, color: CREAM }));
    y = top - boxH;
  }

  if (isReceipt) {
    section("Declaração");
    const vehicleLine = [data.vehicle, data.yearModel ? `ano ${data.year && data.year !== data.yearModel ? `${data.year}/${data.yearModel}` : data.yearModel}` : "", data.color ? `cor ${data.color}` : "", data.plate ? `placa ${data.plate}` : ""].filter(Boolean).join(", ");
    paragraph(`Recebemos de ${data.customer}${data.cpf ? `, CPF ${data.cpf}` : ""}, a quantia de ${money(data.amount)} (${moneyInWords(data.amount)}), referente ao sinal do veículo ${vehicleLine}, dando-lhe plena quitação do valor recebido.`, 11);
    section("Condições do recibo", RECEIPT_TERMS.reduce((sum, term) => sum + wrap(term, regular, 10.5, CONTENT_W - 14).length * 15, 0));
    RECEIPT_TERMS.forEach((term) => paragraph(term, 10.5, true));
    if (data.conditions.trim()) {
      section("Observações", wrap(data.conditions, regular, 10.5, CONTENT_W).length * 15);
      paragraph(data.conditions);
    }
  } else {
    section("Condições");
    paragraph(data.conditions || "Sem condições adicionais.");
  }

  // Local, data e assinaturas ficam juntos na mesma página.
  y -= SECTION_GAP;
  ensure(100);
  const place = `${SEO_LOCAL_CITY}/${site.stateCode}${longDate ? `, ${longDate}` : ""}.`;
  page.drawText(place, { x: MARGIN, y, size: 11, font: regular, color: ASPHALT });
  y -= 46;
  const sigW = (CONTENT_W - 40) / 2;
  const sigs = [
    { who: "Cliente", name: data.customer },
    { who: "Garagem", name: `Responsável: ${data.seller}` },
  ];
  sigs.forEach((sig, i) => {
    const x = MARGIN + i * (sigW + 40);
    page.drawLine({ start: { x, y }, end: { x: x + sigW, y }, thickness: 0.8, color: ASPHALT });
    page.drawText(sig.who.toUpperCase(), { x, y: y - 14, size: 8, font: semi, color: BRAND });
    wrap(sig.name, regular, 9.5, sigW).slice(0, 2).forEach((text, row) => page.drawText(text, { x, y: y - 27 - row * 12, size: 9.5, font: regular, color: MUTED }));
  });

  // Rodapé e numeração depois que o total de páginas é conhecido.
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: MARGIN, y: FOOTER_Y + 22 }, end: { x: PAGE_W - MARGIN, y: FOOTER_Y + 22 }, thickness: 0.6, color: LINE });
    p.drawText(`${site.legalName} · CNPJ ${site.cnpj} · ${SEO_LOCAL_CITY}/${site.stateCode} · www.suagaragem.net`, { x: MARGIN, y: FOOTER_Y + 8, size: 8, font: semi, color: ASPHALT });
    p.drawText("Documento de apoio à negociação. Confira os dados antes de assinar.", { x: MARGIN, y: FOOTER_Y - 4, size: 8, font: regular, color: MUTED });
    const n = `Página ${i + 1} de ${pages.length}`;
    p.drawText(n, { x: PAGE_W - MARGIN - regular.widthOfTextAtSize(n, 8), y: FOOTER_Y + 8, size: 8, font: regular, color: MUTED });
  });

  pdf.setTitle(`Garagem — ${isReceipt ? "Recibo de sinal" : "Proposta"}`);
  return pdf.save();
}
