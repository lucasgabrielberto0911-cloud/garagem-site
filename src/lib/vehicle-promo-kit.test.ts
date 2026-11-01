import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildWhatsAppPromo,
  buildInstagramPromo,
  type PromoVehicle,
} from "./vehicle-promo-kit";

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

const mockVehicle: PromoVehicle = {
  id: "cmshv22g9000fl204fk6qz9l2",
  brand: "Toyota",
  model: "Corolla",
  version: "XEi 2.0",
  year: 2021,
  yearModel: 2022,
  km: 42000,
  transmission: "Automático",
  fuel: "Flex",
  color: "Prata",
  price: 119900,
  status: "disponivel",
  accessories: ["Ar-condicionado", "Direção elétrica", "Câmera de ré"],
};

test("buildWhatsAppPromo: carro disponível inclui preço, detalhes e marca Garagem", () => {
  const text = buildWhatsAppPromo(mockVehicle);
  assert.match(text, /🚗 \*Toyota Corolla XEi 2.0\*/);
  assert.match(text, /2021\/2022/);
  assert.match(text, /42\.000 km/);
  assert.match(text, /Automático · Flex/);
  assert.match(text, /Cor: Prata/);
  assert.match(text, /Destaques: Ar-condicionado · Direção elétrica · Câmera de ré/);
  assert.match(text, /R\$\s*119\.900/);
  assert.match(text, /Garagem · Linhares\/ES/);
  assert.doesNotMatch(text, /Sua Garagem/);
});

test("buildWhatsAppPromo: carro vendido NUNCA mostra preço", () => {
  const soldVehicle = { ...mockVehicle, status: "vendido" };
  const text = buildWhatsAppPromo(soldVehicle);
  assert.match(text, /🏷️ Veículo vendido/);
  assert.doesNotMatch(text, /119\.900/);
  assert.doesNotMatch(text, /💰 Valor:/);
});

test("buildInstagramPromo: gera legenda com hashtags e respeita veículo vendido", () => {
  const text = buildInstagramPromo(mockVehicle);
  assert.match(text, /Toyota Corolla XEi 2.0 — 2021\/2022/);
  assert.match(text, /🏷️ R\$\s*119\.900/);
  assert.match(text, /#toyota #corolla/);
  assert.match(text, /Garagem/);
  assert.doesNotMatch(text, /Sua Garagem/);

  const soldText = buildInstagramPromo({ ...mockVehicle, status: "vendido" });
  assert.match(soldText, /🏷️ Vendido/);
  assert.doesNotMatch(soldText, /119\.900/);
});

test("VehiclePromoKitModal: botão fechar tem alvo de toque mínimo de 44x44px", () => {
  const code = readFileSync(join(srcRoot, "components/admin/VehiclePromoKitModal.tsx"), "utf8");
  assert.match(code, /h-11 w-11 items-center justify-center[\s\S]*aria-label="Fechar"/);
});
