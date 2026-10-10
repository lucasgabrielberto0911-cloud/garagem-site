import assert from "node:assert/strict";
import { test } from "node:test";
import { sniffImageType } from "./image-sniff";

test("reconhece JPEG, PNG e WebP pelos bytes", () => {
  assert.equal(sniffImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0])), "image/jpeg");
  assert.equal(
    sniffImageType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])),
    "image/png",
  );
  assert.equal(
    sniffImageType(Buffer.from("RIFF\0\0\0\0WEBPVP8 ", "latin1")),
    "image/webp",
  );
});

test("recusa HTML, SVG e arquivos vazios mesmo com nome de imagem", () => {
  assert.equal(sniffImageType(Buffer.from("<html><script>alert(1)</script>")), null);
  assert.equal(sniffImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')), null);
  assert.equal(sniffImageType(Buffer.alloc(0)), null);
  assert.equal(sniffImageType(Buffer.from("GIF89a....")), null);
});
