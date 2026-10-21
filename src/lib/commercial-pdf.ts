import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { formatAdminMoney, moneySum } from "./admin-money";
import { type ContractPaymentItem, formatContractPaymentRow, sumContractPayments } from "./admin-commercial";
import { expectedMargin, extrasTotal, hasCostBasis, investedTotal, VEHICLE_COST_KINDS } from "./vehicle-ops";
import { moneyInWords } from "./money-words";
import { SEO_LOCAL_CITY } from "./seo-local";
import { site } from "./site";

/** Campos opcionais não existem em documentos antigos; nesse caso a coluna/linha é omitida. */
export type DocumentSnapshot = {
  customer: string; cpf: string; phone: string; vehicle: string; plate: string; amount: number; payment: string; conditions: string; seller: string; date: string;
  year?: number; yearModel?: number; color?: string; km?: number; total?: number;
  /** Só contrato: dados que o cadastro ainda não tem saem como linha em branco para preencher à mão. */
  rg?: string; address?: string; chassis?: string; renavam?: string;
  /** Sinal já pago: número e data do recibo; é abatido do preço. */
  signal?: { amount: number; receiptId?: string; date?: string };
  downPayment?: number; financed?: number;
  /** Formas de pagamento detalhadas do contrato (compatível com método único em contratos antigos). */
  payments?: ContractPaymentItem[];
  /** Garantia anunciada na ficha do veículo (texto livre). */
  warranty?: string;
  /** Prazo de entrega em dias úteis após a quitação (padrão: 5). */
  deliveryDays?: number;
};

/**
 * DADOS DA LOJA NOS PDFs (contrato e recibo). Único lugar para trocar.
 * Para a loja de Vitória: ajuste razão social, CNPJ, endereço e cidade abaixo.
 * `address` vazio = o cabeçalho omite o endereço; `registeredAddress` identifica a sede no contrato.
 */
export const PDF_STORE = {
  legalName: site.legalName, // razão social
  cnpj: site.cnpj,
  address: "", // endereço opcional do cabeçalho dos PDFs
  registeredAddress: "Avenida Castro Alves, 48, Loja 2, Interlagos, Linhares - ES, CEP 29.903-168",
  city: SEO_LOCAL_CITY, // cidade usada em "Cidade/UF, data" acima das assinaturas
  stateCode: site.stateCode,
} as const;

const ADDRESS_PLACEHOLDER = "[ENDEREÇO DA SEDE — PREENCHER]";

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 44;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_Y = 40;
const BOTTOM = 74; // limite inferior do conteúdo (acima do rodapé)

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
  "O sinal é uma garantia (arras) que reserva o veículo ao cliente e, concretizada a compra, será abatido do preço no Contrato de Compra e Venda de Veículo. Este recibo não substitui o contrato nem a transferência.",
  "O veículo fica reservado ao cliente pelo prazo combinado; vencido o prazo sem a conclusão, a reserva pode ser desfeita.",
  "Em caso de desistência do cliente, o sinal não é restituído e fica com a Garagem; se a desistência for da Garagem, o sinal é devolvido na forma da lei (cláusula 8ª do contrato).",
];

export async function commercialPdf(kind: string, input: DocumentSnapshot, id: string, number?: number) {
  const isReceipt = kind === "recibo";
  let data = input;
  // Recibo é compacto: 1 página, ou 2 se a observação for longa.
  const SECTION_GAP = isReceipt ? 10 : 30; // espaço antes de toda seção
  const LEAD = isReceipt ? 12.5 : 15; // entrelinha dos textos
  const docTitle = isReceipt ? "Recibo de sinal" : "Contrato de compra e venda";
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const [titleBytes, regularBytes, semiBytes, logoBytes] = await Promise.all([
    readFile(path.join(process.cwd(), "public/fonts/Sora-Bold.ttf")),
    readFile(path.join(process.cwd(), "public/fonts/Inter-Regular.ttf")),
    readFile(path.join(process.cwd(), "public/fonts/Inter-SemiBold.ttf")),
    readFile(path.join(process.cwd(), "public/logo.png")),
  ]);
  const title = await pdf.embedFont(titleBytes);
  // Fontes inteiras (sem subset): o subset do fontkit perde glifos.
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
      page.drawText(`${PDF_STORE.legalName} · CNPJ ${PDF_STORE.cnpj}`, { x: MARGIN, y: PAGE_H - 92, size: 8, font: semi, color: ASPHALT });
      const contact = [PDF_STORE.address, `WhatsApp ${site.whatsappLabel}`, site.email].filter(Boolean).join(" · ");
      page.drawText(contact, { x: MARGIN, y: PAGE_H - 104, size: 8, font: regular, color: MUTED });
      const right = PAGE_W - MARGIN;
      const t = docTitle.toUpperCase();
      page.drawText(t, { x: right - title.widthOfTextAtSize(t, 15), y: PAGE_H - 58, size: 15, font: title, color: ASPHALT });
      const meta = number ? `Nº ${number} · Registro ${clean(id)}` : `Nº ${clean(id)}`;
      page.drawText(meta, { x: right - semi.widthOfTextAtSize(meta, 9), y: PAGE_H - 75, size: 9, font: semi, color: BRAND });
      const dateText = `Emitido em ${issuedText}`;
      page.drawText(dateText, { x: right - regular.widthOfTextAtSize(dateText, 9), y: PAGE_H - 88, size: 9, font: regular, color: MUTED });
      page.drawRectangle({ x: 0, y: PAGE_H - (isReceipt ? 112 : 122), width: PAGE_W, height: 4, color: BRAND });
      y = PAGE_H - (isReceipt ? 116 : 126);
    } else {
      drawLogo(page, PAGE_H - 52, 0.7);
      const t = `${docTitle} · Nº ${number ?? clean(id)}`;
      page.drawText(t, { x: PAGE_W - MARGIN - regular.widthOfTextAtSize(t, 9), y: PAGE_H - 56, size: 9, font: regular, color: MUTED });
      page.drawRectangle({ x: 0, y: PAGE_H - 76, width: PAGE_W, height: 3, color: BRAND });
      y = PAGE_H - 104;
    }
    topY = y;
  }

  function ensure(height: number) {
    if (y - height < (isReceipt ? 64 : BOTTOM)) newPage(false);
  }

  // Toda seção começa com o mesmo espaço, exceto no topo da página.
  function section(label: string, bodyHeight = 20) {
    if (y < topY) y -= SECTION_GAP;
    else y -= isReceipt ? 16 : 24;
    ensure(28 + bodyHeight); // título e corpo ficam juntos
    page.drawRectangle({ x: MARGIN, y: y - 3, width: 3, height: 13, color: BRAND });
    page.drawText(label.toUpperCase(), { x: MARGIN + 10, y, size: 10, font: title, color: ASPHALT });
    page.drawLine({ start: { x: MARGIN, y: y - 9 }, end: { x: PAGE_W - MARGIN, y: y - 9 }, thickness: 0.6, color: LINE });
    y -= isReceipt ? 22 : 28;
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
    lines.forEach((line, i) => {
      ensure(LEAD);
      if (bullet && i === 0) page.drawRectangle({ x: MARGIN + 1, y: y + 3, width: 3, height: 3, color: BRAND });
      if (line) page.drawText(line, { x: MARGIN + (bullet ? 14 : 0), y, size, font: regular, color: ASPHALT });
      y -= LEAD;
    });
  }


  function contract() {
    const blank = (value: string | undefined, n = 28) => clean(value ?? "").trim() || "_".repeat(n);
    const price = data.amount;
    const signal = data.signal?.amount ?? 0;
    const down = data.downPayment ?? 0;
    const financed = data.financed ?? 0;
    const balance = Math.round((price - signal - down - financed) * 100) / 100;
    const yearText = data.yearModel ? (data.year && data.year !== data.yearModel ? `${data.year}/${data.yearModel}` : String(data.yearModel)) : blank(undefined, 8);
    const kmText = typeof data.km === "number" ? `${new Intl.NumberFormat("pt-BR").format(data.km)} km` : blank(undefined, 8);
    const days = data.deliveryDays ?? 5;
    const receiptRef = data.signal?.receiptId
      ? `recibo de sinal nº ${clean(data.signal.receiptId)}${data.signal.date ? `, emitido em ${new Date(data.signal.date).toLocaleDateString("pt-BR", { timeZone: tz })}` : ""}`
      : "recibo de sinal emitido pela VENDEDORA";

    const clause = (heading: string, texts: string[]) => {
      const h = texts.reduce((sum, t) => sum + wrap(t, regular, 10, CONTENT_W).length * 13.5, 0);
      y -= 12;
      ensure(30 + Math.min(h, 60));
      page.drawText(heading.toUpperCase(), { x: MARGIN, y, size: 9.5, font: title, color: ASPHALT });
      y -= 15;
      texts.forEach((t) => {
        const lines = wrap(t, regular, 10, CONTENT_W);
        lines.forEach((line) => {
          ensure(13.5);
          if (line) page.drawText(line, { x: MARGIN, y, size: 10, font: regular, color: ASPHALT });
          y -= 13.5;
        });
        y -= 2;
      });
    };

    section("Das partes", 90);
    paragraph(`VENDEDORA: ${PDF_STORE.legalName}, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº ${PDF_STORE.cnpj}, com sede em ${PDF_STORE.registeredAddress || `${ADDRESS_PLACEHOLDER}, ${PDF_STORE.city}/${PDF_STORE.stateCode}`}, doravante denominada VENDEDORA.`, 10);
    y -= 4;
    paragraph(`COMPRADOR(A): ${clean(data.customer)}, portador(a) do CPF nº ${blank(data.cpf, 18)}, RG nº ${blank(data.rg, 16)}, residente e domiciliado(a) em ${blank(data.address, 44)}, telefone ${blank(data.phone, 16)}, doravante denominado(a) COMPRADOR(A).`, 10);
    y -= 4;
    paragraph("As partes têm entre si justo e contratado o presente Contrato de Compra e Venda de Veículo, que se rege pelas cláusulas abaixo.", 10);

    section("Veículo", 70);
    {
      const rowsData = [
        [{ label: "Marca / modelo", value: data.vehicle, weight: 2 }, { label: "Ano fab./modelo", value: yearText }, { label: "Cor", value: blank(data.color, 10) }],
        [{ label: "Placa", value: blank(data.plate, 10) }, { label: "RENAVAM", value: blank(data.renavam, 14), weight: 1.3 }, { label: "Chassi", value: blank(data.chassis, 20), weight: 1.8 }, { label: "Km", value: kmText }],
      ];
      rowsData.forEach((r) => { fields(r); y -= 4; });
    }

    clause("Cláusula 1ª — Do objeto", [
      "A VENDEDORA vende ao(à) COMPRADOR(A), e este(a) compra, o veículo identificado acima, no estado em que se encontra, livre e desembaraçado de ônus, gravames, penhoras e restrições judiciais ou administrativas, salvo se expressamente informado neste contrato.",
    ]);

    // Preço e pagamento: tabela que fecha com o total.
    y -= 12;
    ensure(30 + 4 * 24);
    page.drawText("CLÁUSULA 2ª — DO PREÇO E DA FORMA DE PAGAMENTO", { x: MARGIN, y, size: 9.5, font: title, color: ASPHALT });
    y -= 15;
    paragraph(`O preço certo e ajustado da venda é de ${money(price)} (${moneyInWords(price)}), pago da seguinte forma:`, 10);
    y -= 2;
    const rows: [string, string, boolean][] = [["Preço total do veículo", money(price), true]];
    const hasDetailedPayments = Array.isArray(data.payments) && data.payments.length > 0;
    let computedBalance = balance;
    if (hasDetailedPayments) {
      for (const item of data.payments!) {
        if (item.method === "financiamento" && item.downPayment && item.downPayment > 0) {
          rows.push(["(−) Entrada do financiamento", money(item.downPayment), false]);
        }
        if (item.amount > 0) {
          const ref = item.method === "sinal" && data.signal?.receiptId ? receiptRef : undefined;
          rows.push([clean(formatContractPaymentRow(item, ref)), money(item.amount), false]);
        }
      }
      computedBalance = Math.round((price - sumContractPayments(data.payments!)) * 100) / 100;
    } else {
      if (signal > 0) rows.push([`(−) Sinal já pago — ${receiptRef}, abatido do preço`, money(signal), false]);
      if (down > 0) rows.push(["(−) Entrada", money(down), false]);
      if (financed > 0) rows.push(["(−) Valor financiado (pago pela instituição financeira)", money(financed), false]);
    }
    rows.push([computedBalance > 0 ? "Saldo a pagar pelo(a) COMPRADOR(A)" : "Saldo", money(Math.max(computedBalance, 0)), true]);
    const labelW = (text: string, strong: boolean) => CONTENT_W - 20 - (strong ? title : regular).widthOfTextAtSize(text, 10) - 14;
    const laid = rows.map(([lab, val, strong]) => ({ lines: wrap(lab, strong ? semi : regular, 9.5, labelW(val, strong)), val, strong }));
    const heightOf = (r: { lines: string[] }) => Math.max(22, r.lines.length * 12 + 10);
    ensure(laid.reduce((sum, r) => sum + heightOf(r), 0) + 6);
    laid.forEach((r) => {
      const h = heightOf(r);
      page.drawRectangle({ x: MARGIN, y: y - h, width: CONTENT_W, height: h, color: r.strong ? CREAM : WHITE, borderColor: LINE, borderWidth: 0.6 });
      r.lines.forEach((line, i) => page.drawText(line, { x: MARGIN + 10, y: y - 15 - i * 12, size: 9.5, font: r.strong ? semi : regular, color: ASPHALT }));
      page.drawText(r.val, { x: MARGIN + CONTENT_W - 10 - (r.strong ? title : regular).widthOfTextAtSize(r.val, 10), y: y - 15, size: 10, font: r.strong ? title : regular, color: ASPHALT });
      y -= h;
    });
    y -= 8;
    paragraph(`Forma de pagamento${hasDetailedPayments ? "" : " do saldo"}: ${clean(data.payment)}.`, 10);
    paragraph("§ 1º O sinal tem natureza de garantia (arras): reserva o veículo ao(à) COMPRADOR(A) e, concretizada a compra, é integralmente abatido do preço. § 2º Em caso de financiamento, a venda fica condicionada à aprovação do crédito; se negado, as partes poderão ajustar outra forma de pagamento ou rescindir o contrato.", 10);

    clause("Cláusula 3ª — Da entrega", [
      `A entrega do veículo ocorrerá em até ${days} (${days === 1 ? "um" : days === 5 ? "cinco" : String(days)}) dias úteis após a compensação integral dos valores devidos e a assinatura deste contrato, nas dependências da VENDEDORA, mediante termo de entrega, com o veículo limpo e acompanhado das chaves e do manual, quando existirem.`,
    ]);
    clause("Cláusula 4ª — Da transferência e da documentação", [
      "A VENDEDORA entregará o Certificado de Registro do Veículo (CRV/ATPV-e) devidamente preenchido e assinado, com firma reconhecida quando exigida, e o veículo licenciado. O(A) COMPRADOR(A) compromete-se a providenciar a transferência de propriedade no órgão de trânsito no prazo de 30 (trinta) dias, nos termos do art. 123 do Código de Trânsito Brasileiro, arcando com taxas, vistoria e emolumentos da transferência.",
    ]);
    clause("Cláusula 5ª — Das multas, débitos e responsabilidades", [
      "Multas, IPVA, licenciamento, taxas e quaisquer débitos relativos a fatos geradores anteriores à data da entrega são de responsabilidade da VENDEDORA. Os posteriores à entrega, inclusive infrações de trânsito cometidas após a tradição, são de responsabilidade do(a) COMPRADOR(A), que deverá indicar-se como condutor quando for o caso.",
      "O(A) COMPRADOR(A) responde por danos a terceiros e infrações ocorridas depois da entrega, ainda que a transferência de propriedade não tenha sido concluída, e se obriga a realizá-la no prazo da cláusula 4ª.",
    ]);
    clause("Cláusula 6ª — Do estado do veículo e da vistoria", [
      "O(A) COMPRADOR(A) declara ter examinado o veículo, sua documentação e seu histórico, podendo submetê-lo a vistoria de sua confiança antes da entrega, e o recebe em seu estado de conservação, ciente de que se trata de veículo usado, sujeito ao desgaste natural compatível com a idade e a quilometragem informadas.",
      "A VENDEDORA declara que a quilometragem, o ano e as demais características informadas neste contrato correspondem ao que é de seu conhecimento.",
    ]);
    clause("Cláusula 7ª — Da garantia", [
      ...(data.warranty?.trim() ? [`Garantia oferecida para este veículo, conforme anúncio: ${clean(data.warranty)}.`] : []),
      "Aplica-se a garantia legal prevista no Código de Defesa do Consumidor (Lei nº 8.078/1990), de 90 (noventa) dias para vícios de fácil constatação e ocultos em veículos usados, contados da entrega. A garantia não cobre desgaste natural de peças, mau uso, acidentes, modificações feitas por terceiros ou falta de manutenção.",
    ]);
    clause("Cláusula 8ª — Da desistência e do sinal", [
      "O sinal pago é garantia (arras) destinada a reservar o veículo, que deixa de ser oferecido a terceiros enquanto durar a reserva. Concretizada a compra, o sinal é abatido do preço. Em caso de desistência do(a) COMPRADOR(A), o sinal não será restituído e ficará com a VENDEDORA.",
      "Em caso de desistência da VENDEDORA, esta restituirá o sinal ao(à) COMPRADOR(A) nos termos da lei, sem prejuízo das demais consequências legais cabíveis.",
    ]);
    if (data.conditions.trim()) clause("Cláusula 9ª — Das condições adicionais", [clean(data.conditions)]);
    clause(`Cláusula ${data.conditions.trim() ? "10ª" : "9ª"} — Do foro`, [
      `As partes elegem o foro da comarca de ${PDF_STORE.city}/${PDF_STORE.stateCode} para dirimir quaisquer controvérsias deste contrato, ressalvado o foro do domicílio do consumidor, quando aplicável. E, por estarem justas e contratadas, assinam este instrumento em 2 (duas) vias de igual teor, na presença de 2 (duas) testemunhas.`,
    ]);

    // Local, data e assinaturas juntos.
    y -= 18;
    ensure(230);
    page.drawText(`${PDF_STORE.city}/${PDF_STORE.stateCode}${longDate ? `, ${longDate}` : ""}.`, { x: MARGIN, y, size: 11, font: regular, color: ASPHALT });
    y -= 50;
    const sigW = (CONTENT_W - 40) / 2;
    const sign = (x: number, who: string, name: string, sub: string) => {
      page.drawLine({ start: { x, y }, end: { x: x + sigW, y }, thickness: 0.8, color: ASPHALT });
      page.drawText(who.toUpperCase(), { x, y: y - 14, size: 8, font: semi, color: BRAND });
      const lines = [...(name ? wrap(name, semi, 10, sigW).slice(0, 2) : []), ...(sub ? [sub] : [])];
      lines.forEach((text, row) => page.drawText(text, { x, y: y - 28 - row * 12, size: row === 0 && name ? 10 : 9, font: row === 0 && name ? semi : regular, color: row === 0 && name ? ASPHALT : MUTED }));
    };
    sign(MARGIN, "Vendedora", PDF_STORE.legalName, `CNPJ ${PDF_STORE.cnpj}`);
    sign(MARGIN + sigW + 40, "Comprador(a)", clean(data.customer), data.cpf ? `CPF ${data.cpf}` : "");
    y -= 70;
    sign(MARGIN, "Testemunha 1", "", "Nome e CPF:");
    sign(MARGIN + sigW + 40, "Testemunha 2", "", "Nome e CPF:");
  }

  // Recibo compacto: campos do cabeçalho são cortados com "…". A observação nunca é cortada (quebra e segue na 2ª página).
  function fit(value: string, font: PDFFont, size: number, width: number, maxLines: number) {
    const text = clean(value).replace(/\s+/g, " ").trim();
    if (wrap(text, font, size, width).length <= maxLines) return text;
    let lo = 0, hi = text.length;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (wrap(`${text.slice(0, mid).trimEnd()}…`, font, size, width).length <= maxLines) lo = mid; else hi = mid - 1;
    }
    return `${text.slice(0, lo).trimEnd()}…`;
  }
  if (isReceipt) {
    const nameW = ((CONTENT_W - 32) * 2) / 4;
    data = {
      ...input,
      customer: fit(input.customer, regular, 11, nameW, 2),
      cpf: fit(input.cpf, regular, 11, 100, 1),
      phone: fit(input.phone, regular, 11, 100, 1),
      vehicle: fit(input.vehicle, regular, 10.5, 150, 2),
      color: fit(input.color ?? "", semi, 10.5, 60, 1),
      plate: fit(input.plate, semi, 10.5, 66, 1),
      payment: fit(input.payment, regular, 10.5, CONTENT_W - 40, 1),
    };
  }

  newPage(true);

  if (isReceipt) {
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
    const rowH = Math.max(28, Math.max(...wrapped.map((l) => l.length)) * 14 + 16);
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
    const hasTotal = typeof data.total === "number" && data.total > 0;
    const balance = hasTotal ? Math.max(0, Math.round((data.total! - data.amount) * 100) / 100) : 0;
    const label = "Sinal recebido";
    const payLines = wrap(data.payment, regular, 10.5, CONTENT_W - 40);
    const headH = 58; // rótulo + valor principal
    const summaryH = hasTotal ? 40 : 0;
    const boxH = headH + summaryH + 30 + payLines.length * 14;
    ensure(boxH);
    const top = y;
    page.drawRectangle({ x: MARGIN, y: top - boxH, width: CONTENT_W, height: boxH, color: ASPHALT });
    page.drawRectangle({ x: MARGIN, y: top - boxH, width: 5, height: boxH, color: BRAND });
    page.drawText(label.toUpperCase(), { x: MARGIN + 20, y: top - 24, size: 8, font: semi, color: SOFT });
    const amountText = money(data.amount);
    let size = 24;
    while (size > 14 && title.widthOfTextAtSize(amountText, size) > CONTENT_W - 40) size -= 1;
    page.drawText(amountText, { x: MARGIN + 20, y: top - 50, size, font: title, color: WHITE });
    let cursor = top - headH;
    if (hasTotal) {
      page.drawLine({ start: { x: MARGIN + 20, y: cursor }, end: { x: MARGIN + CONTENT_W - 20, y: cursor }, thickness: 0.5, color: rgb(0.25, 0.25, 0.27) });
      const half = (CONTENT_W - 40) / 2;
      [["Valor total do veículo", money(data.total!), WHITE], ["Saldo restante", money(balance), WHITE]].forEach(([lab, val, color], i) => {
        const x = MARGIN + 20 + i * half;
        page.drawText((lab as string).toUpperCase(), { x, y: cursor - 18, size: 7.5, font: semi, color: SOFT });
        page.drawText(val as string, { x, y: cursor - 35, size: 13, font: title, color: color as typeof WHITE });
      });
      cursor -= summaryH;
    }
    page.drawLine({ start: { x: MARGIN + 20, y: cursor }, end: { x: MARGIN + CONTENT_W - 20, y: cursor }, thickness: 0.5, color: rgb(0.25, 0.25, 0.27) });
    page.drawText("FORMA DE PAGAMENTO", { x: MARGIN + 20, y: cursor - 20, size: 7.5, font: semi, color: SOFT });
    payLines.forEach((text, i) => page.drawText(text, { x: MARGIN + 20, y: cursor - 35 - i * 14, size: 10.5, font: regular, color: CREAM }));
    y = top - boxH;
  }

    section("Declaração");
    const vehicleLine = [fit(data.vehicle, regular, 11, 240, 1), data.yearModel ? `ano ${data.year && data.year !== data.yearModel ? `${data.year}/${data.yearModel}` : data.yearModel}` : "", data.color ? `cor ${data.color}` : "", data.plate ? `placa ${data.plate}` : ""].filter(Boolean).join(", ");
    paragraph(`Recebemos de ${fit(data.customer, regular, 11, 240, 1)}${data.cpf ? `, CPF ${data.cpf}` : ""}, a quantia de ${money(data.amount)} (${moneyInWords(data.amount)}), referente ao sinal do veículo ${vehicleLine}, dando-lhe plena quitação do valor recebido.`, 11);
    section("Condições do recibo", RECEIPT_TERMS.reduce((sum, term) => sum + wrap(term, regular, 9.5, CONTENT_W - 14).length * LEAD, 0));
    RECEIPT_TERMS.forEach((term) => paragraph(term, 9.5, true));
    if (data.conditions.trim()) {
      y -= 4;
      paragraph(`Observações: ${data.conditions}`, 9.5);
    }

  }
  if (!isReceipt) contract();

  // Local, data e assinaturas ficam juntos na mesma página.
  if (isReceipt) {
  y -= SECTION_GAP;
  ensure(86);
  const place = `${PDF_STORE.city}/${PDF_STORE.stateCode}${longDate ? `, ${longDate}` : ""}.`;
  page.drawText(place, { x: MARGIN, y, size: 11, font: regular, color: ASPHALT });
  y -= 30;
  const sigW = (CONTENT_W - 40) / 2;
  const sigs = [
    { who: "Cliente", name: data.customer, sub: data.cpf ? `CPF ${data.cpf}` : "" },
    { who: "Vendedora", name: PDF_STORE.legalName, sub: `CNPJ ${PDF_STORE.cnpj}` },
  ];
  sigs.forEach((sig, i) => {
    const x = MARGIN + i * (sigW + 40);
    page.drawLine({ start: { x, y }, end: { x: x + sigW, y }, thickness: 0.8, color: ASPHALT });
    page.drawText(sig.who.toUpperCase(), { x, y: y - 14, size: 8, font: semi, color: BRAND });
    const lines = [...wrap(sig.name, semi, 10, sigW).slice(0, 2), ...(sig.sub ? [sig.sub] : [])];
    lines.forEach((text, row) => page.drawText(text, { x, y: y - 28 - row * 12, size: row === 0 && sig.name ? 10 : 9, font: row === 0 && sig.name ? semi : regular, color: row === 0 && sig.name ? ASPHALT : MUTED }));
  });
  }

  // Rodapé e numeração depois que o total de páginas é conhecido.
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: MARGIN, y: FOOTER_Y + 22 }, end: { x: PAGE_W - MARGIN, y: FOOTER_Y + 22 }, thickness: 0.6, color: LINE });
    p.drawText(`${PDF_STORE.legalName} · CNPJ ${PDF_STORE.cnpj} · ${PDF_STORE.city}/${PDF_STORE.stateCode} · www.suagaragem.net`, { x: MARGIN, y: FOOTER_Y + 8, size: 8, font: semi, color: ASPHALT });
    p.drawText(isReceipt ? "Confira os dados antes de assinar." : "Contrato de compra e venda de veículo. Rubrique as páginas e confira os dados antes de assinar.", { x: MARGIN, y: FOOTER_Y - 4, size: 8, font: regular, color: MUTED });
    const n = `Página ${i + 1} de ${pages.length}`;
    p.drawText(n, { x: PAGE_W - MARGIN - regular.widthOfTextAtSize(n, 8), y: FOOTER_Y + 8, size: 8, font: regular, color: MUTED });
  });

  pdf.setTitle(`Garagem — ${isReceipt ? "Recibo" : "Contrato de compra e venda"}${isReceipt && number ? ` nº ${number}` : ""}`);
  return pdf.save();
}

export type ExpensesPdfInput = {
  vehicle: string;
  plate?: string;
  consigned: boolean;
  purchasePrice: number | null;
  /** Preço de venda fechado, ou o anunciado quando ainda não vendeu. */
  salePrice: number | null;
  sold: boolean;
  costs: { kind: string; description: string; amount: number; date: string }[];
  /** Rótulo legível da categoria (ex.: "Mecânica / revisão"). */
  kindLabel: (kind: string) => string;
};

/** Categorias na ordem do cadastro (`VEHICLE_COST_KINDS`, depois as desconhecidas); datas crescentes dentro de cada uma. */
export function groupExpenseCosts(costs: ExpensesPdfInput["costs"]) {
  const order = (kind: string) => {
    const i = VEHICLE_COST_KINDS.findIndex((item) => item.value === kind);
    return i < 0 ? VEHICLE_COST_KINDS.length : i;
  };
  const groups = new Map<string, ExpensesPdfInput["costs"]>();
  for (const cost of [...costs].sort((a, b) => order(a.kind) - order(b.kind) || a.date.localeCompare(b.date))) {
    groups.set(cost.kind, [...(groups.get(cost.kind) ?? []), cost]);
  }
  return groups;
}

/** Relatório de gastos de um veículo, no mesmo padrão visual do contrato. */
export async function expensesPdf(input: ExpensesPdfInput) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const [titleBytes, regularBytes, semiBytes, logoBytes] = await Promise.all([
    readFile(path.join(process.cwd(), "public/fonts/Sora-Bold.ttf")),
    readFile(path.join(process.cwd(), "public/fonts/Inter-Regular.ttf")),
    readFile(path.join(process.cwd(), "public/fonts/Inter-SemiBold.ttf")),
    readFile(path.join(process.cwd(), "public/logo.png")),
  ]);
  const title = await pdf.embedFont(titleBytes);
  const regular = await pdf.embedFont(regularBytes);
  const semi = await pdf.embedFont(semiBytes);
  const logo = await pdf.embedPng(logoBytes);
  const tz = "America/Sao_Paulo";
  const right = PAGE_W - MARGIN;
  const docTitle = "Relatório de gastos";
  const day = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR", { timeZone: tz });
  };
  const fitText = (value: string, font: PDFFont, size: number, width: number) => {
    let text = clean(value).replace(/\s+/g, " ").trim();
    if (font.widthOfTextAtSize(text, size) <= width) return text;
    while (text && font.widthOfTextAtSize(`${text}…`, size) > width) text = text.slice(0, -1);
    return `${text.trimEnd()}…`;
  };

  const pages: PDFPage[] = [];
  let page!: PDFPage;
  let y = 0;
  function newPage(first: boolean) {
    page = pdf.addPage([PAGE_W, PAGE_H]);
    pages.push(page);
    const scale = first ? 1 : 0.7;
    const size = LOGO_SIZE * scale;
    page.drawImage(logo, { x: MARGIN - LOGO_WORD_LEFT * size, y: PAGE_H - (first ? 66 : 52) - (1 - LOGO_WORD_CENTER_Y) * size, width: size, height: size });
    if (first) {
      page.drawText(`${PDF_STORE.legalName} · CNPJ ${PDF_STORE.cnpj}`, { x: MARGIN, y: PAGE_H - 92, size: 8, font: semi, color: ASPHALT });
      page.drawText([PDF_STORE.address, `WhatsApp ${site.whatsappLabel}`, site.email].filter(Boolean).join(" · "), { x: MARGIN, y: PAGE_H - 104, size: 8, font: regular, color: MUTED });
      const t = docTitle.toUpperCase();
      page.drawText(t, { x: right - title.widthOfTextAtSize(t, 15), y: PAGE_H - 58, size: 15, font: title, color: ASPHALT });
      const emitted = `Emitido em ${new Date().toLocaleString("pt-BR", { timeZone: tz, dateStyle: "short", timeStyle: "short" }).replace(",", " às")}`;
      page.drawText(emitted, { x: right - regular.widthOfTextAtSize(emitted, 9), y: PAGE_H - 75, size: 9, font: regular, color: MUTED });
      page.drawRectangle({ x: 0, y: PAGE_H - 122, width: PAGE_W, height: 4, color: BRAND });
      y = PAGE_H - 126;
    } else {
      const t = `${docTitle} · ${fitText(input.vehicle, regular, 9, 260)}`;
      page.drawText(t, { x: right - regular.widthOfTextAtSize(t, 9), y: PAGE_H - 56, size: 9, font: regular, color: MUTED });
      page.drawRectangle({ x: 0, y: PAGE_H - 76, width: PAGE_W, height: 3, color: BRAND });
      y = PAGE_H - 104;
    }
  }
  const ensure = (height: number) => { if (y - height < BOTTOM) newPage(false); };
  function section(label: string, needed = 60) {
    y -= 24;
    ensure(needed);
    page.drawRectangle({ x: MARGIN, y: y - 3, width: 3, height: 13, color: BRAND });
    page.drawText(label.toUpperCase(), { x: MARGIN + 10, y, size: 10, font: title, color: ASPHALT });
    page.drawLine({ start: { x: MARGIN, y: y - 9 }, end: { x: right, y: y - 9 }, thickness: 0.6, color: LINE });
    y -= 28;
  }
  const amountRight = (text: string, font: PDFFont, size: number, color = ASPHALT) =>
    page.drawText(text, { x: right - font.widthOfTextAtSize(text, size), y, size, font, color });

  newPage(true);
  section("Veículo");
  page.drawText(fitText(input.vehicle, semi, 12, CONTENT_W), { x: MARGIN, y, size: 12, font: semi, color: ASPHALT });
  y -= 15;
  if (input.plate) {
    page.drawText(`Placa ${clean(input.plate)}`, { x: MARGIN, y, size: 10, font: regular, color: MUTED });
    y -= 15;
  }

  const groups = groupExpenseCosts(input.costs);
  section("Gastos por categoria");
  if (groups.size === 0) {
    page.drawText("Nenhum gasto lançado para este veículo.", { x: MARGIN, y, size: 10.5, font: regular, color: MUTED });
    y -= 15;
  }
  for (const [kind, items] of groups) {
    ensure(48);
    y -= 6;
    page.drawText(input.kindLabel(kind).toUpperCase(), { x: MARGIN, y, size: 8, font: semi, color: BRAND });
    amountRight(money(moneySum(items.map((item) => item.amount))), semi, 9);
    y -= 16;
    for (const item of items) {
      ensure(16);
      page.drawText(day(item.date), { x: MARGIN, y, size: 10, font: regular, color: MUTED });
      const amountText = money(item.amount);
      const descW = CONTENT_W - 70 - regular.widthOfTextAtSize(amountText, 10) - 12;
      page.drawText(fitText(item.description || "—", regular, 10, descW), { x: MARGIN + 70, y, size: 10, font: regular, color: ASPHALT });
      amountRight(amountText, regular, 10);
      y -= 15;
    }
  }

  // Resumo: compra, gastos, investido, venda e margem (só com dado).
  const extras = extrasTotal(input.costs);
  const rows: [string, string][] = [[input.consigned ? "Histórico de gastos (fora dos totais da loja)" : "Total de gastos", money(extras)]];
  if (!input.consigned) {
    if (input.purchasePrice != null) rows.push(["Preço de compra", money(input.purchasePrice)]);
    if (hasCostBasis(input.purchasePrice, input.costs)) rows.push(["Investimento total (compra + gastos)", money(investedTotal(input.purchasePrice, input.costs))]);
  }
  if (input.salePrice != null) rows.push([input.sold ? "Preço de venda" : "Preço anunciado", money(input.salePrice)]);
  const showMargin = !input.consigned && input.salePrice != null && hasCostBasis(input.purchasePrice, input.costs);
  const boxH = 24 + rows.length * 20 + (showMargin ? 36 : 0);
  section("Resumo", boxH + 40); // título (24 + 28 de respiro) e caixa na mesma página
  const top = y + 8;
  page.drawRectangle({ x: MARGIN, y: top - boxH, width: CONTENT_W, height: boxH, color: ASPHALT });
  y = top - 26;
  for (const [label, value] of rows) {
    page.drawText(label.toUpperCase(), { x: MARGIN + 20, y, size: 7.5, font: semi, color: SOFT });
    amountRight(value, title, 11, WHITE);
    y -= 20;
  }
  if (showMargin) {
    const margin = expectedMargin(input.salePrice!, input.purchasePrice, input.costs);
    page.drawLine({ start: { x: MARGIN + 20, y: y + 10 }, end: { x: right - 20, y: y + 10 }, thickness: 0.5, color: rgb(0.25, 0.25, 0.27) });
    y -= 6;
    page.drawText(`MARGEM${input.sold ? "" : " ESTIMADA"}`.toUpperCase(), { x: MARGIN + 20, y, size: 7.5, font: semi, color: SOFT });
    amountRight(money(margin), title, 14, WHITE);
  }
  y = top - boxH;

  pages.forEach((p, i) => {
    p.drawLine({ start: { x: MARGIN, y: FOOTER_Y + 22 }, end: { x: right, y: FOOTER_Y + 22 }, thickness: 0.6, color: LINE });
    p.drawText(`${PDF_STORE.legalName} · CNPJ ${PDF_STORE.cnpj} · ${PDF_STORE.city}/${PDF_STORE.stateCode} · www.suagaragem.net`, { x: MARGIN, y: FOOTER_Y + 8, size: 8, font: semi, color: ASPHALT });
    p.drawText("Documento interno. Não compartilhe com clientes.", { x: MARGIN, y: FOOTER_Y - 4, size: 8, font: regular, color: MUTED });
    const n = `Página ${i + 1} de ${pages.length}`;
    p.drawText(n, { x: right - regular.widthOfTextAtSize(n, 8), y: FOOTER_Y + 8, size: 8, font: regular, color: MUTED });
  });
  pdf.setTitle(`Garagem — Gastos ${clean(input.vehicle)}`);
  return pdf.save();
}

export type PreparationPdfRow = {
  brand: string;
  model: string;
  color?: string | null;
  year?: number | null;
  km?: number | null;
  plate?: string | null;
  ready: boolean;
  posted: boolean;
  purchasedAt?: string | null;
  purchasePrice?: number | null;
};

/** Colunas da lista de preparação (somam CONTENT_W); larguras comportam data e valor completos. */
export const PREPARATION_COLS = [
  { label: "Marca", w: 65 }, { label: "Modelo/Versão", w: 110 }, { label: "Cor", w: 42 }, { label: "Ano", w: 32 },
  { label: "KM", w: 42 }, { label: "Placa", w: 52 }, { label: "Compra", w: 48 }, { label: "Valor", w: 62 },
  { label: "Pronto", w: 40 }, { label: "Postado", w: 46 },
];
export const PREPARATION_CELL_SIZE = 7;

/** Lista dos carros em preparação (campos vazios ficam em branco, para preencher à mão), no padrão visual do contrato. */
export async function preparationPdf(rows: PreparationPdfRow[], generatedAt = new Date()) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const [titleBytes, regularBytes, semiBytes, logoBytes] = await Promise.all([
    readFile(path.join(process.cwd(), "public/fonts/Sora-Bold.ttf")),
    readFile(path.join(process.cwd(), "public/fonts/Inter-Regular.ttf")),
    readFile(path.join(process.cwd(), "public/fonts/Inter-SemiBold.ttf")),
    readFile(path.join(process.cwd(), "public/logo.png")),
  ]);
  const title = await pdf.embedFont(titleBytes);
  const regular = await pdf.embedFont(regularBytes);
  const semi = await pdf.embedFont(semiBytes);
  const logo = await pdf.embedPng(logoBytes);
  const tz = "America/Sao_Paulo";
  const margin = 28;
  const contentWidth = PAGE_W - margin * 2;
  const right = PAGE_W - margin;
  const rowHeight = 34;
  const day = (iso?: string | null) => {
    const d = iso ? new Date(iso) : null;
    return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString("pt-BR", { timeZone: tz }) : "";
  };
  const wrap = (value: string, font: PDFFont, size: number, width: number) => {
    const words = clean(value).replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      let rest = word;
      while (rest) {
        const candidate = line ? `${line} ${rest}` : rest;
        if (font.widthOfTextAtSize(candidate, size) <= width) { line = candidate; break; }
        if (line) { lines.push(line); line = ""; continue; }
        let cut = 1;
        while (cut < rest.length && font.widthOfTextAtSize(rest.slice(0, cut + 1), size) <= width) cut++;
        lines.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
    }
    if (line) lines.push(line);
    return lines;
  };
  const cols = PREPARATION_COLS;
  const pages: PDFPage[] = [];
  let page!: PDFPage;
  let y = 0;
  const header = () => {
    page.drawRectangle({ x: margin, y: y - 5, width: contentWidth, height: 18, color: ASPHALT });
    let x = margin + 3;
    for (const c of cols) {
      page.drawText(c.label.toUpperCase(), { x, y, size: 7, font: semi, color: WHITE });
      x += c.w;
    }
    y -= 22;
  };
  function newPage(first: boolean) {
    page = pdf.addPage([PAGE_W, PAGE_H]);
    pages.push(page);
    const size = LOGO_SIZE * (first ? 0.72 : 0.7);
    page.drawImage(logo, { x: margin - LOGO_WORD_LEFT * size, y: PAGE_H - (first ? 56 : 52) - (1 - LOGO_WORD_CENTER_Y) * size, width: size, height: size });
    if (first) {
      page.drawText(`${PDF_STORE.legalName} · CNPJ ${PDF_STORE.cnpj}`, { x: margin, y: PAGE_H - 92, size: 8, font: semi, color: ASPHALT });
      page.drawText(`WhatsApp ${site.whatsappLabel} · ${site.email}`, { x: margin, y: PAGE_H - 104, size: 8, font: regular, color: MUTED });
      page.drawText("www.suagaragem.net", { x: margin, y: PAGE_H - 116, size: 8, font: regular, color: MUTED });
      page.drawRectangle({ x: margin, y: PAGE_H - 126, width: contentWidth, height: 3, color: BRAND });
      page.drawText("Carros em preparação", { x: margin, y: PAGE_H - 151, size: 15, font: title, color: ASPHALT });
      const date = generatedAt.toLocaleDateString("pt-BR", { timeZone: tz });
      page.drawText(`Gerado em ${date} · ${rows.length} veículo(s)`, { x: margin, y: PAGE_H - 169, size: 9, font: regular, color: MUTED });
      y = PAGE_H - 190;
    } else {
      page.drawRectangle({ x: margin, y: PAGE_H - 76, width: contentWidth, height: 3, color: BRAND });
      y = PAGE_H - 104;
    }
    header();
  }

  const chunks: (PreparationPdfRow | null)[][] = [];
  const pending = [...rows];
  for (let pageIndex = 0; pending.length || !chunks.length; pageIndex++) {
    let available = (PAGE_H - (pageIndex === 0 ? 212 : 126) + 7) - BOTTOM;
    const chunk: (PreparationPdfRow | null)[] = [];
    while (pending.length) {
      const row = pending[0];
      const values = [row.brand, row.model, row.color ?? "", row.year ? String(row.year) : "", row.km != null ? row.km.toLocaleString("pt-BR") : "", row.plate ?? "", day(row.purchasedAt), row.purchasePrice != null ? money(row.purchasePrice) : ""];
      const height = Math.max(rowHeight, Math.max(...values.map((value, i) => wrap(value, regular, PREPARATION_CELL_SIZE, cols[i].w - 6).length)) * 10 + 16);
      if (height > available && chunk.length) break;
      chunk.push(pending.shift()!);
      available -= height;
      if (available < 0) break;
    }
    while (available >= rowHeight) { chunk.push(null); available -= rowHeight; }
    chunks.push(chunk);
  }
  chunks.forEach((chunk, pageIndex) => {
    newPage(pageIndex === 0);
    for (const row of chunk) {
      const top = y + 7;
      const cells = row ? [row.brand, row.model, row.color ?? "", row.year ? String(row.year) : "", row.km != null ? row.km.toLocaleString("pt-BR") : "", row.plate ?? "", day(row.purchasedAt), row.purchasePrice != null ? money(row.purchasePrice) : ""] : [];
      const wrapped = cells.map((cell, i) => wrap(cell, regular, PREPARATION_CELL_SIZE, cols[i].w - 6));
      const height = row ? Math.max(rowHeight, Math.max(...wrapped.map(lines => lines.length)) * 10 + 16) : rowHeight;
      page.drawRectangle({ x: margin, y: top - height, width: contentWidth, height, borderColor: LINE, borderWidth: 0.65 });
      let x = margin;
      for (const c of cols.slice(1)) { x += cols[cols.indexOf(c) - 1].w; page.drawLine({ start: { x, y: top - height }, end: { x, y: top }, thickness: 0.55, color: LINE }); }
      let cellX = margin;
      wrapped.forEach((lines, i) => {
        lines.forEach((line, lineIndex) => page.drawText(line, { x: cellX + 3, y: top - 13 - lineIndex * 10, size: PREPARATION_CELL_SIZE, font: regular, color: ASPHALT }));
        cellX += cols[i].w;
      });
      for (const [i, checked] of [[8, row?.ready], [9, row?.posted]] as const) {
        const boxSize = 10;
        const boxX = margin + cols.slice(0, i).reduce((sum, c) => sum + c.w, 0) + (cols[i].w - boxSize) / 2;
        const boxY = top - (height + boxSize) / 2;
        page.drawRectangle({ x: boxX, y: boxY, width: boxSize, height: boxSize, borderColor: ASPHALT, borderWidth: 0.8 });
        if (checked) {
          page.drawLine({ start: { x: boxX + 2, y: boxY + 5 }, end: { x: boxX + 4, y: boxY + 2 }, thickness: 1.2, color: ASPHALT });
          page.drawLine({ start: { x: boxX + 4, y: boxY + 2 }, end: { x: boxX + 8, y: boxY + 8 }, thickness: 1.2, color: ASPHALT });
        }
      }
      y -= height;
    }
  });

  pages.forEach((p, i) => {
    p.drawLine({ start: { x: MARGIN, y: FOOTER_Y + 22 }, end: { x: right, y: FOOTER_Y + 22 }, thickness: 0.6, color: LINE });
    p.drawText(`${PDF_STORE.legalName} · CNPJ ${PDF_STORE.cnpj} · ${PDF_STORE.city}/${PDF_STORE.stateCode} · www.suagaragem.net`, { x: MARGIN, y: FOOTER_Y + 8, size: 8, font: semi, color: ASPHALT });
    const n = `Página ${i + 1} de ${pages.length}`;
    p.drawText(n, { x: right - regular.widthOfTextAtSize(n, 8), y: FOOTER_Y + 8, size: 8, font: regular, color: MUTED });
  });
  pdf.setTitle("Garagem — Carros em preparação");
  return pdf.save();
}
