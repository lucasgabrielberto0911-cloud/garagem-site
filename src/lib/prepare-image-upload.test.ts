import assert from "node:assert/strict";
import { test } from "node:test";
import { prepareImageForUpload } from "./prepare-image-upload";

test("JPG e HEIC grandes são preparados sem recusar pelo tamanho do original", async () => {
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const originalBitmap = Object.getOwnPropertyDescriptor(globalThis, "createImageBitmap");
  Object.defineProperty(globalThis, "document", { configurable: true, value: {
    createElement: () => ({
      width: 0, height: 0,
      toDataURL: () => "data:image/webp;base64,",
      getContext: () => ({ drawImage() {} }),
      toBlob: (callback: (blob: Blob) => void) => callback(new Blob([new Uint8Array(1024)], { type: "image/webp" })),
    }),
  } });
  Object.defineProperty(globalThis, "createImageBitmap", { configurable: true, value: async () => ({ width: 4000, height: 3000, close() {} }) });
  try {
    for (const [name, type] of [["foto.jpg", "image/jpeg"], ["foto.heic", "image/heic"]]) {
      const file = new File([new Uint8Array(16 * 1024 * 1024)], name, { type });
      const prepared = await prepareImageForUpload(file);
      assert.equal(prepared.type, "image/webp");
      assert.equal(prepared.size, 1024);
      assert.equal(prepared.name, "foto.webp");
    }
  } finally {
    if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument);
    else Reflect.deleteProperty(globalThis, "document");
    if (originalBitmap) Object.defineProperty(globalThis, "createImageBitmap", originalBitmap);
    else Reflect.deleteProperty(globalThis, "createImageBitmap");
  }
});
