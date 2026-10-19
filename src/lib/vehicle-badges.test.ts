import assert from "node:assert/strict";
import test from "node:test";
import { hasPriceDrop, isNewListing, priceDropAmount } from "./vehicle-badges";

const now = new Date("2026-10-12T12:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);

test("selo Novo vale até 7 dias", () => {
  assert.equal(isNewListing(daysAgo(0), now), true);
  assert.equal(isNewListing(daysAgo(7), now), true);
  assert.equal(isNewListing(daysAgo(7.1), now), false);
  assert.equal(isNewListing("lixo", now), false);
});

test("Baixou o preço exige histórico real e preço menor", () => {
  assert.equal(hasPriceDrop(50000, []), false);
  assert.equal(hasPriceDrop(50000, [{ price: 50000, createdAt: daysAgo(3) }]), false);
  assert.equal(
    hasPriceDrop(48000, [
      { price: 52000, createdAt: daysAgo(10) },
      { price: 48000, createdAt: daysAgo(1) },
    ]),
    true,
  );
  assert.equal(hasPriceDrop(55000, [{ price: 50000, createdAt: daysAgo(2) }]), false);
});

test("usa o último preço diferente, mesmo fora de ordem", () => {
  assert.equal(
    hasPriceDrop(45000, [
      { price: 45000, createdAt: daysAgo(1) },
      { price: 50000, createdAt: daysAgo(5) },
      { price: 40000, createdAt: daysAgo(20) },
    ]),
    true,
  );
});

test("priceDropAmount devolve o valor da queda ou 0", () => {
  assert.equal(
    priceDropAmount(48000, [
      { price: 50000, createdAt: daysAgo(10) },
      { price: 48000, createdAt: daysAgo(1) },
    ]),
    2000,
  );
  assert.equal(priceDropAmount(55000, [{ price: 50000, createdAt: daysAgo(2) }]), 0);
  assert.equal(priceDropAmount(50000, []), 0);
});
