import { PDFDocument, rgb, type PDFFont, type PDFImage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { formatAdminMoney } from "./admin-money";
import { PDF_STORE } from "./commercial-pdf";
import { promissoryClause, promissoryDateInWords, promissoryLongDate, validatePromissory, type PromissoryInput } from "./promissory";
import { moneyInWords } from "./money-words";
import { site } from "./site";

type PdfAssets = {
  title: PDFFont;
  regular: PDFFont;
  semi: PDFFont;
  logo: PDFImage;
};

async function createDocumentWithAssets(): Promise<{ pdf: PDFDocument; assets: PdfAssets }> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const [titleBytes, regularBytes, semiBytes, logoBytes] = await Promise.all([
    readFile(path.join(process.cwd(), "public/fonts/Sora-Bold.ttf")),
    readFile(path.join(process.cwd(), "public/fonts/Inter-Regular.ttf")),
    readFile(path.join(process.cwd(), "public/fonts/Inter-SemiBold.ttf")),
    readFile(path.join(process.cwd(), "public/logo.png")),
  ]);
  // Fontes inteiras: o subset do fontkit perde glifos nos PDFs do projeto.
  const [title, regular, semi, logo] = await Promise.all([
    pdf.embedFont(titleBytes),
    pdf.embedFont(regularBytes),
    pdf.embedFont(semiBytes),
    pdf.embedPng(logoBytes),
  ]);
  return { pdf, assets: { title, regular, semi, logo } };
}

function drawPromissoryPage(pdf: PDFDocument, assets: PdfAssets, data: ReturnType<typeof validatePromissory>) {
  const { title, regular, semi, logo } = assets;
  const page = pdf.addPage([595.28, 841.89]);
  const margin = 44;
  const width = page.getWidth() - margin * 2;
  const asphalt = rgb(0.051, 0.051, 0.059);
  const brand = rgb(0.91, 0.094, 0.11);
  const muted = rgb(0.4, 0.4, 0.42);
  const line = rgb(0.85, 0.84, 0.82);
  let y = 642;

  function draw(value: string, x: number, top: number, size = 10, font: PDFFont = regular, color = asphalt) {
    page.drawText(value.replace(/\u00a0/g, " "), { x, y: top, size, font, color });
  }

  function wrap(value: string, available: number, size = 10, font: PDFFont = regular) {
    const lines: string[] = [];
    let current = "";
    for (const word of value.replace(/\u00a0/g, " ").split(/\s+/).filter(Boolean)) {
      const next = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= available) { current = next; continue; }
      if (current) lines.push(current);
      current = "";
      for (const char of word) {
        if (current && font.widthOfTextAtSize(current + char, size) > available) { lines.push(current); current = ""; }
        current += char;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  function fields(items: { label: string; value: string }[]) {
    const gap = 20;
    const column = (width - gap * (items.length - 1)) / items.length;
    let rows = 1;
    items.forEach((item, index) => {
      const x = margin + index * (column + gap);
      draw(item.label.toUpperCase(), x, y, 7.5, semi, brand);
      const lines = wrap(item.value, column);
      rows = Math.max(rows, lines.length);
      lines.forEach((value, row) => draw(value, x, y - 17 - row * 14));
    });
    items.forEach((_, index) => {
      const x = margin + index * (column + gap);
      const bottom = y - 17 - (rows - 1) * 14 - 10;
      page.drawLine({ start: { x, y: bottom }, end: { x: x + column, y: bottom }, color: asphalt, thickness: 0.6 });
    });
    y -= 31 + rows * 14;
  }

  page.drawImage(logo, { x: margin - 190 * 0.093, y: 778 - 190 * (1 - 0.488), width: 190, height: 190 });
  [
    `${PDF_STORE.legalName}`,
    `CNPJ ${PDF_STORE.cnpj} · ${PDF_STORE.city}/${PDF_STORE.stateCode}`,
    `WhatsApp ${site.whatsappLabel} · ${site.email}`,
    "www.suagaragem.net",
  ].forEach((value, index) => draw(value, margin + width - regular.widthOfTextAtSize(value, 8), 795 - index * 13, 8));
  page.drawLine({ start: { x: margin, y: 737 }, end: { x: margin + width, y: 737 }, color: brand, thickness: 2 });
  page.drawRectangle({ x: margin - 10, y: 66, width: width + 20, height: 661, borderColor: asphalt, borderWidth: 0.8 });
  page.drawLine({ start: { x: margin - 10, y: 727 }, end: { x: margin + width + 10, y: 727 }, color: brand, thickness: 4 });
  draw("NOTA PROMISSÓRIA", margin, 704, 18, title);
  draw(`Nº ${data.number ?? "______"} · ${data.status === "paga" ? "QUITADA · Reimpressão histórica" : "Via única"}`, margin, 682, 10, semi, muted);
  const amount = formatAdminMoney(data.amount).replace(/\u00a0/g, " ");
  const amountWidth = title.widthOfTextAtSize(amount, 18);
  page.drawRectangle({ x: margin + width - amountWidth - 20, y: 674, width: amountWidth + 20, height: 42, borderColor: asphalt, borderWidth: 0.8 });
  draw(amount, margin + width - amountWidth - 10, 683, 18, title);
  draw("VALOR", margin + width - semi.widthOfTextAtSize("VALOR", 7.5) - 10, 703, 7.5, semi, brand);

  y = 642;
  draw("Vencimento:", margin, y, 12, semi);
  draw(` ${promissoryLongDate(data.dueDate)}`, margin + semi.widthOfTextAtSize("Vencimento:", 12), y, 12);
  y -= 30;
  const clause = data.status === "paga"
    ? `NOTA QUITADA. Pagamento registrado${data.paidAt ? ` em ${new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short" }).format(new Date(data.paidAt))}` : " (data não disponível)"}. Reimpressão histórica da nota; não representa nova cobrança.`
    : promissoryClause(data);
  const highlights = [promissoryDateInWords(data.dueDate) + ",", "NOTA PROMISSÓRIA", `${site.legalName.toUpperCase()},`, site.cnpj, `${amount} (${moneyInWords(data.amount)})`].map(value => {
    const start = clause.indexOf(value);
    return { start, end: start + value.length };
  }).filter(range => range.start !== -1);
  let x = margin;
  for (const word of clause.matchAll(/\S+/g)) {
    const font = highlights.some(range => word.index >= range.start && word.index < range.end) ? semi : regular;
    const wordWidth = font.widthOfTextAtSize(word[0], 10.5);
    if (x + wordWidth > margin + width) { x = margin; y -= 16; }
    draw(word[0], x, y, 10.5, font);
    x += wordWidth + regular.widthOfTextAtSize(" ", 10.5);
  }
  y -= 16;
  y -= 18;
  fields([
    { label: "Praça de pagamento", value: data.paymentPlace },
    { label: "Local e data de emissão", value: `${data.issuePlace}, ${promissoryLongDate(data.issuedAt)}` },
  ]);
  fields([{ label: "Emitente", value: data.issuer.name }]);
  fields([{ label: "CPF", value: data.issuer.cpf }, { label: "RG / órgão emissor", value: data.issuer.rg }]);
  fields([
    { label: "Data de nascimento", value: data.issuer.birthDate.split("-").reverse().join("/") },
    { label: "Telefone", value: data.issuer.phone },
  ]);
  fields([{ label: "Endereço do emitente", value: data.issuer.address }]);

  y -= 22;
  page.drawLine({ start: { x: margin + 70, y }, end: { x: margin + width - 70, y }, color: asphalt, thickness: 0.8 });
  const nameLines = wrap(data.issuer.name, width - 140, 10, semi);
  nameLines.forEach((value) => {
    y -= 14;
    draw(value, margin + (width - semi.widthOfTextAtSize(value, 10)) / 2, y, 10, semi);
  });
  y -= 15;
  const signature = `Assinatura do emitente · CPF ${data.issuer.cpf}`;
  draw(signature, margin + (width - regular.widthOfTextAtSize(signature, 9)) / 2, y, 9, regular, muted);
  y -= 28;
  const witnessColumn = (width - 20) / 2;
  [margin, margin + witnessColumn + 20].forEach((x, index) => {
    draw(`TESTEMUNHA ${index + 1}`, x, y, 7.5, semi, brand);
    ["Nome", "CPF", "Assinatura"].forEach((label, row) => {
      const top = y - 18 - row * 24;
      draw(`${label}:`, x, top, 9, regular, muted);
      page.drawLine({ start: { x, y: top - 10 }, end: { x: x + witnessColumn, y: top - 10 }, color: asphalt, thickness: 0.6 });
    });
  });
  y -= 88;
  if (y < 74) throw new Error("Os dados excedem o espaço de uma página A4. Reduza os textos dos campos.");
  page.drawLine({ start: { x: margin, y: 49 }, end: { x: margin + width, y: 49 }, color: line, thickness: 0.6 });
  const footer = `${PDF_STORE.legalName} · CNPJ ${PDF_STORE.cnpj} · ${PDF_STORE.city}/${PDF_STORE.stateCode} · www.suagaragem.net`;
  draw(footer, margin + (width - regular.widthOfTextAtSize(footer, 7.5)) / 2, 34, 7.5, regular, muted);
}

/** Via única em A4, com os mesmos recursos locais dos demais PDFs comerciais. */
export async function promissoryPdf(input: PromissoryInput) {
  const data = validatePromissory(input);
  const { pdf, assets } = await createDocumentWithAssets();
  drawPromissoryPage(pdf, assets, data);
  pdf.setTitle(`Nota promissória nº ${data.number ?? "______"} · Garagem`);
  pdf.setAuthor(PDF_STORE.legalName);
  return pdf.save();
}

/** Lote de notas em um único PDF (1 página A4 por parcela) para imprimir todas de uma vez. */
export async function promissoryBatchPdf(inputs: PromissoryInput[]) {
  if (!inputs.length) throw new Error("Informe ao menos uma nota promissória para gerar o PDF.");
  if (inputs.length === 1) return promissoryPdf(inputs[0]);
  const validated = inputs.map((item) => validatePromissory(item));
  const { pdf, assets } = await createDocumentWithAssets();
  for (const data of validated) {
    drawPromissoryPage(pdf, assets, data);
  }
  const firstNo = validated[0].number ?? "1";
  const lastNo = validated[validated.length - 1].number ?? String(validated.length);
  pdf.setTitle(`Notas promissórias nº ${firstNo} a ${lastNo} · Garagem`);
  pdf.setAuthor(PDF_STORE.legalName);
  return pdf.save();
}

/** Usa exatamente o renderizador de impressão antes de persistir o lote. */
export async function validatePromissoryPages(inputs: PromissoryInput[]) {
  const { pdf, assets } = await createDocumentWithAssets();
  for (const input of inputs) drawPromissoryPage(pdf, assets, validatePromissory(input));
}
