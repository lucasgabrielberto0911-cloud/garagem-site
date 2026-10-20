import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { formatAdminMoney } from "./admin-money";

export type DocumentSnapshot = { customer: string; cpf: string; phone: string; vehicle: string; plate: string; amount: number; payment: string; conditions: string; seller: string; date: string };

export async function commercialPdf(kind: string, data: DocumentSnapshot, id: string, number?: number) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const [titleBytes, textBytes] = await Promise.all([
    readFile(path.join(process.cwd(), "public/fonts/Sora.ttf")),
    readFile(path.join(process.cwd(), "public/fonts/Inter.ttf")),
  ]);
  const titleFont = await pdf.embedFont(titleBytes, { subset: true });
  const font = await pdf.embedFont(textBytes, { subset: true });
  let page = pdf.addPage([595.28, 841.89]);
  let y = 790;
  function line(value: string, title = false) {
    const selectedFont = title ? titleFont : font, size = title ? 17 : 11;
    // Quebra também palavras longas e remove controles sem glifos nas fontes.
    for (const paragraph of value.replace(/[\x00-\x08\x0B-\x1F\x7F]/g, "").split("\n")) {
      let current = "";
      for (const char of paragraph) {
        if (selectedFont.widthOfTextAtSize(current + char, size) > 490) { draw(current); current = ""; }
        current += char;
      }
      draw(current);
    }
    function draw(text: string) {
      if (y < 55) { page = pdf.addPage([595.28, 841.89]); y = 790; }
      page.drawText(text, { x: 50, y, size, font: selectedFont, color: rgb(0.05, 0.05, 0.06) });
      y -= title ? 28 : 18;
    }
  }
  line("Garagem", true);
  line(`${kind === "recibo" ? "Recibo" : "Proposta comercial"}${number ? ` nº ${number}` : ""}`, true);
  line(`Registro: ${id}`);
  line(`Emissão: ${new Date(data.date).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`);
  line(`Cliente: ${data.customer}`);
  line(`CPF: ${data.cpf || "Não informado"} | Telefone: ${data.phone}`);
  line(`Veículo: ${data.vehicle} | Placa: ${data.plate || "Não informada"}`);
  line(`${kind === "recibo" ? "Valor recebido" : "Valor proposto"}: ${formatAdminMoney(data.amount)}`);
  line(`Forma de pagamento: ${data.payment}`);
  line("Condições", true);
  line(data.conditions);
  line(`Responsável pelo registro: ${data.seller}`);
  line("Documento de apoio à negociação. Confira os dados antes de assinar.");
  line("Cliente: __________________________________________");
  line("Garagem: __________________________________________");
  pdf.setTitle(`Garagem — ${kind === "recibo" ? "Recibo" : "Proposta"}${number ? ` nº ${number}` : ""}`);
  return pdf.save();
}
