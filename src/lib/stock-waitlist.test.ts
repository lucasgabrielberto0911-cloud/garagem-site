import assert from "node:assert/strict";
import { test } from "node:test";
import { formatStockWaitlistQuery } from "./stock-waitlist";

test("lista de espera prefere a busca livre", () => {
  assert.equal(
    formatStockWaitlistQuery({ q: "  fox automático  ", brand: "Volkswagen" }),
    "fox automático",
  );
});

test("filtros viram frase natural para o WhatsApp", () => {
  assert.match(
    formatStockWaitlistQuery({
      brand: "Hyundai",
      transmission: "Automático",
      maxPrice: "50000",
    }),
    /Hyundai, automático, até R\$\s*50\.000/,
  );
  assert.match(
    formatStockWaitlistQuery({
      category: "moto",
      minPrice: "15000",
      maxPrice: "25000",
    }),
    /moto, de R\$\s*15\.000 a R\$\s*25\.000/,
  );
  assert.equal(formatStockWaitlistQuery({}), "");
});
