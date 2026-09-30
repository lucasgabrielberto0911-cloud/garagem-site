import assert from "node:assert/strict";
import { test } from "node:test";
import { publicDossierChips, publicPurchaseFacts } from "./vehicle-dossier";

test("chips do dossiê só aparecem quando o item é verdadeiro", () => {
  assert.deepEqual(publicDossierChips({}), []);
  assert.deepEqual(
    publicDossierChips({
      hasSpareKey: false,
      hasManual: false,
      hasVideo: false,
    }),
    [],
  );
  assert.deepEqual(
    publicDossierChips({
      hasSpareKey: true,
      hasManual: null,
      hasVideo: false,
    }),
    ["Chave reserva"],
  );
  assert.deepEqual(
    publicDossierChips({
      hasSpareKey: true,
      hasManual: true,
      hasVideo: true,
    }),
    ["Chave reserva", "Manual do proprietário", "Vídeo sob pedido"],
  );
});

test("dossiê de compra só lista o que o anúncio tem", () => {
  assert.deepEqual(publicPurchaseFacts({}), []);
  assert.deepEqual(
    publicPurchaseFacts({
      inspection: "   ",
      warranty: "",
      accessories: ["", "  "],
    }),
    [],
  );

  const facts = publicPurchaseFacts({
    inspection: "Lataria revisada na loja.",
    warranty: "3 meses",
    accessories: ["Pneus novos", "Ar-condicionado", "ABS", "Bluetooth", "Alarme"],
  });
  assert.deepEqual(
    facts.map((fact) => fact.label),
    ["Vistoria da loja", "Garantia", "Pneus novos", "Equipamentos"],
  );
  assert.equal(facts[0]?.detail, "Lataria revisada na loja.");
  assert.equal(facts[1]?.detail, "3 meses");
  assert.match(facts[3]?.detail ?? "", /Ar-condicionado, ABS, Bluetooth e mais 1/);
  assert.doesNotMatch(facts[3]?.detail ?? "", /Pneus novos/);
});

test("vistoria mostra o texto do anúncio e tira o aviso de documento oficial", () => {
  const facts = publicPurchaseFacts({
    inspection: "Cautelar aprovado. Não é documento oficial de inspeção.",
  });
  assert.equal(facts.length, 1);
  assert.equal(facts[0]?.label, "Vistoria da loja");
  assert.equal(facts[0]?.detail, "Cautelar aprovado.");
  assert.doesNotMatch(facts[0]?.detail ?? "", /documento oficial/i);
  assert.deepEqual(publicPurchaseFacts({ inspection: "   " }), []);
  assert.deepEqual(publicPurchaseFacts({ inspection: null }), []);
});
