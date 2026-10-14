import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { VehicleAccessoryChips } from "@/components/site/VehicleAccessoryChips";
import {
  CAR_ACCESSORY_PRESETS,
  MOTO_ACCESSORY_PRESETS,
} from "./vehicle-accessories";
import { accessoryChipSpan, accessoryIconKey } from "./accessory-chips";

test("ícone casa com o item e cai no check quando não conhece", () => {
  assert.equal(accessoryIconKey("Bluetooth"), "bluetooth");
  assert.equal(accessoryIconKey("Ar-condicionado"), "snow");
  assert.equal(accessoryIconKey("Câmera de ré"), "camera");
  assert.equal(accessoryIconKey("Sensor de estacionamento"), "sensor");
  assert.equal(accessoryIconKey("Direção hidráulica"), "steering");
  assert.equal(accessoryIconKey("Vidros elétricos"), "window");
  assert.equal(accessoryIconKey("Item inventado qualquer"), "check");
});

test("os presets conhecidos têm ícone próprio na maioria", () => {
  const all = [...CAR_ACCESSORY_PRESETS, ...MOTO_ACCESSORY_PRESETS];
  const generic = all.filter((item) => accessoryIconKey(item) === "check");
  assert.ok(generic.length / all.length < 0.2, generic.join(", "));
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
  assert.match(html, /grid-cols-2/);
  assert.match(html, /lg:grid-cols-3/);
  assert.match(html, /col-span-2 lg:col-span-2/);
});
