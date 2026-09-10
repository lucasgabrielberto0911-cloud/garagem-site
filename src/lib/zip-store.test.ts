import assert from "node:assert/strict";
import { test } from "node:test";
import { buildZipStore, crc32 } from "./zip-store";

function findBytes(haystack: Uint8Array, needle: Uint8Array) {
  outer: for (let i = 0; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}

test("crc32 conhecido de hello", () => {
  const bytes = new TextEncoder().encode("hello");
  assert.equal(crc32(bytes), 0x3610a686);
});

test("ZIP store guarda o arquivo sem comprimir", () => {
  const payload = new TextEncoder().encode("foto-alta");
  const name = "01-civic.webp";
  const zip = buildZipStore([{ name, data: payload }]);

  assert.deepEqual(zip.subarray(0, 4), new Uint8Array([0x50, 0x4b, 0x03, 0x04]));

  const nameBytes = new TextEncoder().encode(name);
  const headerSize = 30 + nameBytes.length;
  assert.deepEqual(zip.subarray(headerSize, headerSize + payload.length), payload);

  const central = findBytes(zip, new Uint8Array([0x50, 0x4b, 0x01, 0x02]));
  const eocd = findBytes(zip, new Uint8Array([0x50, 0x4b, 0x05, 0x06]));
  assert.ok(central > 0);
  assert.ok(eocd > central);
});

test("ZIP com dois arquivos mantém a ordem dos nomes", () => {
  const zip = buildZipStore([
    { name: "a.txt", data: new TextEncoder().encode("aaa") },
    { name: "b.txt", data: new TextEncoder().encode("bbb") },
  ]);
  const text = new TextDecoder().decode(zip);
  assert.ok(text.indexOf("a.txt") < text.indexOf("b.txt"));
});

test("diretório central aponta para cada arquivo (Windows precisa disso)", () => {
  const payloads = [
    { name: "toyota-etios-xs-2017-01.webp", data: new Uint8Array(8000).fill(1) },
    { name: "toyota-etios-xs-2017-02.webp", data: new Uint8Array(8000).fill(2) },
  ];
  const zip = buildZipStore(payloads);
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const eocd = zip.length - 22;
  assert.equal(view.getUint32(eocd, true), 0x06054b50);
  assert.equal(view.getUint16(eocd + 8, true), 2);
  const central = view.getUint32(eocd + 16, true);
  assert.equal(view.getUint32(central, true), 0x02014b50);
  const nameLen = view.getUint16(central + 28, true);
  const name = new TextDecoder().decode(
    zip.subarray(central + 46, central + 46 + nameLen),
  );
  assert.equal(name, payloads[0].name);
  const localOffset = view.getUint32(central + 42, true);
  assert.equal(view.getUint32(localOffset, true), 0x04034b50);
  const second = central + 46 + nameLen;
  assert.equal(view.getUint32(second, true), 0x02014b50);
});
