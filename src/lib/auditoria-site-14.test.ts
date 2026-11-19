import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(rel: string) {
  return readFileSync(join(srcRoot, rel), "utf8");
}

test("VehicleCard não aplica aria-label no link principal e mantém alt vazio na foto", () => {
  const vehicleCardSrc = readSrc("components/site/VehicleCard.tsx");
  const stockLinkBlock = vehicleCardSrc.slice(
    vehicleCardSrc.indexOf("<StockVehicleLink"),
    vehicleCardSrc.indexOf("<div className=\"listing-card-photo"),
  );
  assert.doesNotMatch(stockLinkBlock, /aria-label=/);
  assert.match(vehicleCardSrc, /<VehicleImage[\s\S]*?alt=""/);
});
