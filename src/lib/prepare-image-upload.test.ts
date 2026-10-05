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

test("HEIF pode usar o decoder nativo de imagem quando createImageBitmap não suporta o formato", async () => {
  const keys = ["document", "createImageBitmap", "Image"] as const;
  const original = keys.map((key) => Object.getOwnPropertyDescriptor(globalThis, key));
  Object.defineProperty(globalThis, "document", { configurable: true, value: {
    createElement: () => ({
      width: 0, height: 0,
      toDataURL: () => "data:image/webp;base64,",
      getContext: () => ({ drawImage() {} }),
      toBlob: (callback: (blob: Blob) => void) => callback(new Blob([new Uint8Array(2048)], { type: "image/webp" })),
    }),
  } });
  Object.defineProperty(globalThis, "createImageBitmap", { configurable: true, value: async () => { throw new Error("unsupported"); } });
  Object.defineProperty(globalThis, "Image", { configurable: true, value: class {
    width = 4032;
    height = 3024;
    onload?: () => void;
    set src(_value: string) { queueMicrotask(() => this.onload?.()); }
  } });
  try {
    const prepared = await prepareImageForUpload(new File([new Uint8Array(16 * 1024 * 1024)], "iphone.heif", { type: "image/heif" }));
    assert.equal(prepared.name, "iphone.webp");
    assert.equal(prepared.size, 2048);
  } finally {
    keys.forEach((key, index) => {
      if (original[index]) Object.defineProperty(globalThis, key, original[index]!);
      else Reflect.deleteProperty(globalThis, key);
    });
  }
});
