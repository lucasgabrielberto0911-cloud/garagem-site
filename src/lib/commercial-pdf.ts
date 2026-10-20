import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { formatAdminMoney } from "./admin-money";

export type DocumentSnapshot = { customer: string; cpf: string; phone: string; vehicle: string; plate: string; amount: number; payment: string; conditions: string; seller: string; date: string };

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 44;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_Y = 40;
const BOTTOM = 78; // limite inferior do conteúdo (acima do rodapé)

const ASPHALT = rgb(0.051, 0.051, 0.059); // #0D0D0F
const BRAND = rgb(0.91, 0.094, 0.11); // #E8181C
const CREAM = rgb(0.969, 0.961, 0.949); // #F7F5F2
const MUTED = rgb(0.4, 0.4, 0.42);
const LINE = rgb(0.85, 0.84, 0.82);
const WHITE = rgb(1, 1, 1);

// logo.png é quadrado (1024 px) com o wordmark centralizado; medidas em fração da imagem.
const LOGO_SIZE = 190;
const LOGO_WORD_LEFT = 0.093;
const LOGO_WORD_CENTER_Y = 0.488;

const clean = (value: string) => value.replace(/[\x00-\x08\x0B-\x1F\x7F]/g, "").replace(/ /g, " ");
const money = (value: number) => clean(formatAdminMoney(value));

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
  const regular = await pdf.embedFont(regularBytes);
  const semi = await pdf.embedFont(semiBytes);
  const logo = await pdf.embedPng(logoBytes);

  const issued = new Date(data.date);
  const issuedText = Number.isNaN(issued.getTime())
    ? "—"
    : issued.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).replace(",", " às");

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
      drawLogo(page, PAGE_H - 70, 1);
      const right = PAGE_W - MARGIN;
      const t = docTitle.toUpperCase();
      page.drawText(t, { x: right - title.widthOfTextAtSize(t, 15), y: PAGE_H - 62, size: 15, font: title, color: ASPHALT });
      const meta = `Nº ${clean(id)}`;
      page.drawText(meta, { x: right - semi.widthOfTextAtSize(meta, 9), y: PAGE_H - 78, size: 9, font: semi, color: BRAND });
      const dateText = `Emitido em ${issuedText}`;
      page.drawText(dateText, { x: right - regular.widthOfTextAtSize(dateText, 9), y: PAGE_H - 91, size: 9, font: regular, color: MUTED });
      page.drawRectangle({ x: 0, y: PAGE_H - 112, width: PAGE_W, height: 4, color: BRAND });
      y = PAGE_H - 140;
    } else {
      drawLogo(page, PAGE_H - 52, 0.7);
      const t = `${docTitle} · Nº ${clean(id)}`;
      page.drawText(t, { x: PAGE_W - MARGIN - regular.widthOfTextAtSize(t, 9), y: PAGE_H - 56, size: 9, font: regular, color: MUTED });
      page.drawRectangle({ x: 0, y: PAGE_H - 76, width: PAGE_W, height: 3, color: BRAND });
      y = PAGE_H - 100;
    }
  }

  function ensure(height: number) {
    if (y - height < BOTTOM) newPage(false);
  }

  function section(label: string) {
    ensure(40);
    page.drawRectangle({ x: MARGIN, y: y - 3, width: 3, height: 13, color: BRAND });
    page.drawText(label.toUpperCase(), { x: MARGIN + 10, y, size: 10, font: title, color: ASPHALT });
    page.drawLine({ start: { x: MARGIN, y: y - 9 }, end: { x: PAGE_W - MARGIN, y: y - 9 }, thickness: 0.6, color: LINE });
    y -= 26;
  }

  // Linha de campos: rótulo pequeno em cima, valor embaixo, N colunas com larguras fixas.
  function fields(items: { label: string; value: string; weight?: number }[]) {
    const total = items.reduce((sum, item) => sum + (item.weight ?? 1), 0);
    const gap = 16;
    const usable = CONTENT_W - gap * (items.length - 1);
    const cols = items.map((item) => ({ ...item, width: (usable * (item.weight ?? 1)) / total }));
    const wrapped = cols.map((col) => wrap(col.value || "—", regular, 11, col.width));
    const rows = Math.max(...wrapped.map((lines) => lines.length));
    ensure(14 + rows * 15 + 16);
    let x = MARGIN;
    cols.forEach((col, i) => {
      page.drawText(col.label.toUpperCase(), { x, y, size: 7.5, font: semi, color: MUTED });
      wrapped[i].forEach((text, row) => page.drawText(text, { x, y: y - 15 - row * 15, size: 11, font: regular, color: ASPHALT }));
      x += col.width + gap;
    });
    y -= 14 + rows * 15 + 16;
  }

  newPage(true);

  section("Cliente");
  fields([{ label: "Nome", value: data.customer, weight: 2 }, { label: "CPF", value: data.cpf || "Não informado" }, { label: "Telefone", value: data.phone }]);

  section("Veículo");
  {
    const colW = [CONTENT_W - 130, 130];
    const lines = wrap(data.vehicle, regular, 11, colW[0] - 20);
    const rowH = Math.max(30, lines.length * 15 + 14);
    ensure(24 + rowH);
    page.drawRectangle({ x: MARGIN, y: y - 24, width: CONTENT_W, height: 24, color: ASPHALT });
    page.drawText("DESCRIÇÃO", { x: MARGIN + 10, y: y - 16, size: 7.5, font: semi, color: WHITE });
    page.drawText("PLACA", { x: MARGIN + colW[0] + 10, y: y - 16, size: 7.5, font: semi, color: WHITE });
    const top = y - 24;
    page.drawRectangle({ x: MARGIN, y: top - rowH, width: CONTENT_W, height: rowH, color: CREAM, borderColor: LINE, borderWidth: 0.6 });
    page.drawLine({ start: { x: MARGIN + colW[0], y: top }, end: { x: MARGIN + colW[0], y: top - rowH }, thickness: 0.6, color: LINE });
    lines.forEach((text, i) => page.drawText(text, { x: MARGIN + 10, y: top - 19 - i * 15, size: 11, font: regular, color: ASPHALT }));
    page.drawText(clean(data.plate || "Não informada"), { x: MARGIN + colW[0] + 10, y: top - 19, size: 11, font: semi, color: ASPHALT });
    y = top - rowH - 24;
  }

  section("Valores");
  {
    const label = isReceipt ? "Sinal recebido" : "Valor proposto";
    const payLines = wrap(data.payment, regular, 10.5, CONTENT_W - 40);
    const boxH = 84 + payLines.length * 14;
    ensure(boxH + 24);
    page.drawRectangle({ x: MARGIN, y: y - boxH, width: CONTENT_W, height: boxH, color: ASPHALT });
    page.drawRectangle({ x: MARGIN, y: y - boxH, width: 5, height: boxH, color: BRAND });
    page.drawText(label.toUpperCase(), { x: MARGIN + 20, y: y - 22, size: 8, font: semi, color: rgb(0.78, 0.77, 0.75) });
    // Valor muito grande reduz a fonte para nunca passar da caixa.
    const amountText = money(data.amount);
    let size = 28;
    while (size > 14 && title.widthOfTextAtSize(amountText, size) > CONTENT_W - 40) size -= 1;
    page.drawText(amountText, { x: MARGIN + 20, y: y - 52, size, font: title, color: WHITE });
    page.drawText("FORMA DE PAGAMENTO", { x: MARGIN + 20, y: y - 72, size: 7.5, font: semi, color: rgb(0.78, 0.77, 0.75) });
    payLines.forEach((text, i) => page.drawText(text, { x: MARGIN + 20, y: y - 86 - i * 14, size: 10.5, font: regular, color: CREAM }));
    y -= boxH + 28;
  }

  section("Condições");
  {
    const lines = wrap(data.conditions || "Sem condições adicionais.", regular, 10.5, CONTENT_W);
    for (const text of lines) {
      ensure(16);
      if (text) page.drawText(text, { x: MARGIN, y, size: 10.5, font: regular, color: ASPHALT });
      y -= 15;
    }
    y -= 10;
  }

  fields([{ label: "Responsável pelo registro", value: data.seller }]);

  // Assinaturas ficam juntas na mesma página.
  ensure(110);
  y -= 34;
  const sigW = (CONTENT_W - 40) / 2;
  const sigs = [
    { who: "Cliente", name: data.customer },
    { who: "Garagem", name: data.seller },
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
    p.drawText("Garagem · Linhares/ES · www.suagaragem.net", { x: MARGIN, y: FOOTER_Y + 8, size: 8.5, font: semi, color: ASPHALT });
    p.drawText("Documento de apoio à negociação. Confira os dados antes de assinar.", { x: MARGIN, y: FOOTER_Y - 4, size: 8, font: regular, color: MUTED });
    const n = `Página ${i + 1} de ${pages.length}`;
    p.drawText(n, { x: PAGE_W - MARGIN - regular.widthOfTextAtSize(n, 8), y: FOOTER_Y + 8, size: 8, font: regular, color: MUTED });
  });

  pdf.setTitle(`Garagem — ${isReceipt ? "Recibo de sinal" : "Proposta"}`);
  return pdf.save();
}
