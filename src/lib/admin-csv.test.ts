import assert from "node:assert/strict";
import { test } from "node:test";
import { csvCell, csvDocument, csvMoney } from "./admin-csv";

test("csvCell: protege contra injeção de fórmulas iniciadas por =, +, - e @", () => {
  // Fórmulas diretas no início
  assert.equal(csvCell("=1+1"), `"'=1+1"`);
  assert.equal(csvCell("=SUM(A1:B10)"), `"'=SUM(A1:B10)"`);
  assert.equal(csvCell("=cmd|' /C calc'!A0"), `"'=cmd|' /C calc'!A0"`);
  assert.equal(csvCell("+12345"), ` "'+12345"`.trim());
  assert.equal(csvCell("-500"), ` "'-500"`.trim());
  assert.equal(csvCell("@SUM(A1)"), ` "'@SUM(A1)"`.trim());

  // Fórmulas precedidas de espaços e caracteres de controle
  assert.equal(csvCell("   =1+1"), `"'   =1+1"`);
  assert.equal(csvCell("\t+123"), `"'\t+123"`);
  assert.equal(csvCell("\n-alerta"), `"'\n-alerta"`);
  assert.equal(csvCell("\r@comando"), `"'\r@comando"`);
  assert.equal(csvCell("\0=1"), `"'\0=1"`);

  // Caracteres no meio do texto não são prefixados com apóstrofo
  assert.equal(csvCell("contato@suagaragem.net"), '"contato@suagaragem.net"');
  assert.equal(csvCell("Civic 2.0 - 2021"), '"Civic 2.0 - 2021"');
  assert.equal(csvCell("Valor = 50000"), '"Valor = 50000"');
  assert.equal(csvCell("10 + 20"), '"10 + 20"');
});

test("csvCell: escapa aspas duplas dobrando-as", () => {
  assert.equal(csvCell('Roda 17" liga leve'), '"Roda 17"" liga leve"');
  assert.equal(csvCell('"Destaque"'), '"""Destaque"""');
  assert.equal(csvCell('a"b"c'), '"a""b""c"');
  assert.equal(csvCell('""'), '""""""');
});

test("csvCell: preserva quebras de linha e multilinhas entre aspas", () => {
  assert.equal(csvCell("Linha 1\nLinha 2"), '"Linha 1\nLinha 2"');
  assert.equal(
    csvCell("Observações:\r\n- Revisado\r\n- Único dono"),
    '"Observações:\r\n- Revisado\r\n- Único dono"',
  );
});

test("csvCell: trata valores nulos, indefinidos, vazios e primitivos", () => {
  assert.equal(csvCell(null), '""');
  assert.equal(csvCell(undefined), '""');
  assert.equal(csvCell(""), '""');
  assert.equal(csvCell(123), '"123"');
  assert.equal(csvCell(true), '"true"');
  assert.equal(csvCell(false), '"false"');
});

test("csvMoney: formata valores monetários no padrão pt-BR com vírgula", () => {
  assert.equal(csvCell(csvMoney(0)), '"0,00"');
  assert.equal(csvCell(csvMoney(1234.56)), '"1234,56"');
  assert.equal(csvCell(csvMoney(85900)), '"85900,00"');
  assert.equal(csvCell(csvMoney(99.9)), '"99,90"');
  assert.equal(csvCell(csvMoney(-1234.56)), '"-1234,56"');
  assert.equal(csvCell(csvMoney(0.004)), '"0,00"');
  assert.equal(csvCell(csvMoney(10.556)), '"10,56"');
});

test("csvMoney: recusa valores não finitos com exceção", () => {
  assert.throws(() => csvMoney(NaN), /Valor financeiro inválido/);
  assert.throws(() => csvMoney(Infinity), /Valor financeiro inválido/);
  assert.throws(() => csvMoney(-Infinity), /Valor financeiro inválido/);
});

test("csvDocument: gera documento com BOM UTF-8, separador ponto-e-vírgula e quebras CRLF", () => {
  const rows = [
    ["Veículo", "Preço", "Observações"],
    ["Corolla XEi", csvMoney(115000), "Sem retoques;\nIPVA pago"],
    ['Focus 2.0 "Titanium"', csvMoney(58900.5), "=1+1 fórmula"],
  ];

  const doc = csvDocument(rows);

  // Inicia com BOM UTF-8 (\uFEFF) para compatibilidade com Excel no Windows
  assert.ok(doc.startsWith("\uFEFF"));

  // Separa colunas por ponto-e-vírgula e linhas por CRLF
  const lines = doc.slice(1).split("\r\n");
  assert.equal(lines.length, 3);

  // Cabeçalho
  assert.equal(lines[0], '"Veículo";"Preço";"Observações"');

  // Linha 1 com valor financeiro em pt-BR e texto com quebra
  assert.equal(lines[1], '"Corolla XEi";"115000,00";"Sem retoques;\nIPVA pago"');

  // Linha 2 com aspas escapadas e fórmula prevenida
  assert.equal(lines[2], '"Focus 2.0 ""Titanium""";"58900,50";"\'=1+1 fórmula"');
});
