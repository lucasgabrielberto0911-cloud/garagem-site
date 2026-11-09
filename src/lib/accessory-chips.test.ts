import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { VehicleAccessoryChips } from "@/components/site/VehicleAccessoryChips";
import {
  CAR_ACCESSORY_PRESETS,
  MOTO_ACCESSORY_PRESETS,
} from "./vehicle-accessories";
import { readFileSync } from "node:fs";
import { accessoryGroup, parseLegend } from "./legend-parser";
import { accessoryChipSpan, accessoryIconKey } from "./accessory-chips";

/** Um item de exemplo por ícone (menos o fallback). */
const ALL_KEYS_SAMPLE = {
  screen: "Multimídia", phone: "CarPlay", speaker: "Som premium", gps: "GPS", bluetooth: "Bluetooth",
  usb: "USB", plug: "Tomada 12V", snow: "Ar digital", rain: "Sensor de chuva", twilight: "Crepuscular",
  sunroof: "Teto solar", camera: "Câmera de ré", sensor: "Sensor de ré", mirror: "Retrovisores", fog: "Neblina",
  light: "Farol LED", window: "Vidros", windshield: "Para-brisa", hill: "Rampa", key: "Keyless",
  alarm: "Alarme", lock: "Travas", isofix: "ISOFIX", airbag: "Airbag", cruise: "Piloto automático",
  stability: "Estabilidade", brake: "ABS", steering: "Direção", handlebar: "Guidão", leather: "Couro",
  seat: "Bancos", wheel: "Rodas", tire: "Pneus", dash: "Painel digital", bag: "Bauleto", spring: "Suspensão",
  engine: "Escape", shield: "Protetor", swap: "Troca", card: "Financiamos", check: "Item qualquer",
};

test("ícone casa com o item e cai no check quando não conhece", () => {
  const casos: Array<[string, string]> = [
    ["Bluetooth", "bluetooth"],
    ["Ar-condicionado", "snow"],
    ["Ar digital", "snow"],
    ["Ar-condicionado digital automático", "snow"],
    ["Câmera de ré", "camera"],
    ["Sensor de estacionamento", "sensor"],
    ["Sensor de ré", "sensor"],
    ["Sensor de chuva", "rain"],
    ["Sensor crepuscular", "twilight"],
    ["Direção hidráulica", "steering"],
    ["Volante multifuncional", "steering"],
    ["Vidros elétricos", "window"],
    ["Vidros, travas e retrovisores elétricos", "window"],
    ["Travas elétricas", "lock"],
    ["Para-brisa", "windshield"],
    ["Bolha / carenagem", "windshield"],
    ["Assistente de partida em rampa", "hill"],
    ["6 Airbags", "airbag"],
    ["6 Air Bags", "airbag"],
    ["Airbag duplo", "airbag"],
    ["Partida elétrica", "key"],
    ["Chave presencial com partida por botão", "key"],
    ["Central multimídia de 10,1\" com Apple CarPlay e Android Auto sem fio", "screen"],
    ["Apple CarPlay / Android Auto", "phone"],
    ["Media Nav 7", "screen"],
    ["Painel de instrumentos digital de 7\"", "dash"],
    ["Painel digital TFT", "dash"],
    ["Computador de bordo", "dash"],
    ["Bancos de couro", "leather"],
    ["Bancos elétricos", "seat"],
    ["Teto solar", "sunroof"],
    ["Faróis full LED", "light"],
    ["Farol de neblina", "fog"],
    ["Rodas de liga leve aro 18\"", "wheel"],
    ["Pneus novos", "tire"],
    ["Controle de tração e de estabilidade", "stability"],
    ["Freios ABS com EBD", "brake"],
    ["ABS", "brake"],
    ["Piloto automático", "cruise"],
    ["ISOFIX", "isofix"],
    ["Alarme", "alarm"],
    ["Imobilizador", "lock"],
    ["Entrada USB", "usb"],
    ["Guidão alto", "handlebar"],
    ["Cavalete central", "engine"],
    ["Amortecedor a gás", "spring"],
    ["Aceitamos seu carro na troca", "swap"],
    ["Financiamos em até 60x", "card"],
    ["Item inventado qualquer", "check"],
  ];
  for (const [item, key] of casos) assert.equal(accessoryIconKey(item), key, item);
});

test("os presets conhecidos e a legenda do Fastback têm ícone próprio, sem check", () => {
  const all = [...CAR_ACCESSORY_PRESETS, ...MOTO_ACCESSORY_PRESETS];
  const generic = all.filter((item) => accessoryIconKey(item) === "check");
  assert.deepEqual(generic, []);

  const legend = parseLegend(readFileSync("src/lib/__fixtures__/legend-fastback.txt", "utf8"));
  const itens = legend.accessories.map((item) => accessoryGroup(item).text);
  assert.equal(itens.length, 17);
  assert.deepEqual(
    itens.filter((item) => accessoryIconKey(item) === "check"),
    [],
  );
});

test("todo ícone tem um desenho SVG", () => {
  const html = renderToStaticMarkup(
    createElement(VehicleAccessoryChips, {
      items: Object.values(ALL_KEYS_SAMPLE),
    }),
  );
  assert.equal((html.match(/<svg/g) ?? []).length, Object.keys(ALL_KEYS_SAMPLE).length);
  assert.equal((html.match(/<svg[^>]*><\/svg>/g) ?? []).length, 0);
});

test("último chip fecha a linha sem esconder item", () => {
  for (let total = 1; total <= 12; total += 1) {
    for (let i = 0; i < total - 1; i += 1) {
      assert.deepEqual(accessoryChipSpan(i, total), { base: 1, lg: 1 });
    }
    const last = accessoryChipSpan(total - 1, total);
    // 2 colunas: ímpar ocupa a linha inteira. 3 colunas: completa o que falta.
    assert.equal((total - 1 + last.base) % 2, 0, `base ${total}`);
    assert.equal((total - 1 + last.lg) % 3 === 0 || (total - 1) % 3 + last.lg === 3, true, `lg ${total}`);
  }
});

test("chips renderizam todos os itens com ícone decorativo", () => {
  const items = ["Bluetooth", "ABS", "Ar digital", "Alarme", "Pneus novos"];
  const html = renderToStaticMarkup(createElement(VehicleAccessoryChips, { items }));
  assert.equal((html.match(/data-accessory-chip(?!s)/g) ?? []).length, 5);
  assert.equal((html.match(/aria-hidden="true"/g) ?? []).length, 5);
  for (const item of items) assert.ok(html.includes(item));
  assert.match(html, /text-brand-light/);
  assert.match(html, /first-letter:uppercase/);
  assert.match(html, /grid-cols-2/);
  assert.match(html, /lg:grid-cols-3/);
  assert.match(html, /col-span-2 lg:col-span-2/);
});
