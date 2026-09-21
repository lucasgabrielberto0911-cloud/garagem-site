import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("upload não borra placa sozinho — só reblur com Tem placa", () => {
  const upload = readFileSync(join(root, "app/api/upload/route.ts"), "utf8");
  const direct = readFileSync(join(root, "lib/upload-image-direct.ts"), "utf8");
  const reblur = readFileSync(join(root, "app/api/upload/reblur/route.ts"), "utf8");
  const manager = readFileSync(
    join(root, "components/admin/VehiclePhotoManager.tsx"),
    "utf8",
  );
  const intake = readFileSync(join(root, "../scripts/import-stock-vehicle.ts"), "utf8");

  assert.doesNotMatch(upload, /blurDetectedPlates/);
  assert.doesNotMatch(intake, /blurDetectedPlates/);
  assert.match(upload, /opt-in/);
  assert.doesNotMatch(direct, /enqueuePlateReblur/);
  assert.doesNotMatch(direct, /\/api\/upload\/reblur/);
  assert.match(reblur, /body\.hasPlate !== true/);
  assert.match(manager, /photosMarkedHasPlate/);
  assert.match(manager, /hasPlate: true/);
  assert.match(manager, /photoPlateMarkLabel/);
  assert.match(manager, /Borrar fotos com placa/);
});
