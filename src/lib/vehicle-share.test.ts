import test from "node:test";
import assert from "node:assert/strict";
import { canonicalVehicleShareUrl, shareVehicleLink } from "./vehicle-share";
const data = { title: "Veículo de teste", url: "https://www.suagaragem.net/estoque/teste" };
test("link público não aceita outra origem ou caminho fora da ficha", () => {
  assert.equal(canonicalVehicleShareUrl("https://www.suagaragem.net", "/estoque/teste"), data.url);
  for (const path of ["https://other.test/estoque/teste", "//other.test/estoque/teste", "/admin"]) assert.throws(() => canonicalVehicleShareUrl("https://www.suagaragem.net", path));
});
test("compartilhamento nativo usa os dados do anúncio, sem copiar", async () => {
  let shared: ShareData | undefined;
  assert.equal(await shareVehicleLink({ share: async value => { shared = value; }, clipboard: { writeText: async () => { throw Error("não deve copiar"); } } }, data), "shared");
  assert.deepEqual(shared, data);
});
test("cancelamento é silencioso e falhas reais não fingem sucesso", async () => {
  assert.equal(await shareVehicleLink({ share: async () => { throw new DOMException("Cancelado", "AbortError"); } }, data), "cancelled");
  await assert.rejects(shareVehicleLink({ share: async () => { throw Error("Falhou"); } }, data));
});
test("sem suporte nativo ou canShare falso, copia somente o link", async () => {
  for (const native of [false, true]) {
    let copied = "";
    const platform = { clipboard: { writeText: async (value: string) => { copied = value; } }, ...(native ? { canShare: () => false, share: async () => { throw Error("não deve compartilhar"); } } : {}) };
    assert.equal(await shareVehicleLink(platform, data), "copied"); assert.equal(copied, data.url);
  }
});
