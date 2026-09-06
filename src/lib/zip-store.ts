/**
 * ZIP sem compressão (store). Imagens WebP já vêm compactas —
 * evita dependência extra só para o acervo do admin.
 */

const LOCAL_SIG = 0x04034b50;
const CENTRAL_SIG = 0x02014b50;
const EOCD_SIG = 0x06054b50;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let crc = i;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
    table[i] = crc >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array) {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export type ZipEntry = {
  name: string;
  data: Uint8Array;
};

function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  const dosTime =
    (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const dosDate =
    ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { dosTime, dosDate };
}

function writeU16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true);
}

function writeU32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value, true);
}

function encodeName(name: string) {
  const safe = name.replace(/\\/g, "/").replace(/^\/+/, "");
  return new TextEncoder().encode(safe);
}

/** Monta um .zip com os arquivos na ordem recebida. */
export function buildZipStore(entries: ZipEntry[]): Uint8Array {
  const { dosTime, dosDate } = dosDateTime();
  const prepared = entries.map((entry) => {
    const nameBytes = encodeName(entry.name);
    if (nameBytes.length === 0) {
      throw new Error("Nome de arquivo vazio no ZIP.");
    }
    return {
      nameBytes,
      data: entry.data,
      crc: crc32(entry.data),
      size: entry.data.byteLength,
    };
  });

  let localSize = 0;
  let centralSize = 0;
  for (const item of prepared) {
    localSize += 30 + item.nameBytes.length + item.size;
    centralSize += 46 + item.nameBytes.length;
  }

  const total = localSize + centralSize + 22;
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer, out.byteOffset, out.byteLength);

  let offset = 0;
  const localOffsets: number[] = [];

  for (const item of prepared) {
    localOffsets.push(offset);
    writeU32(view, offset, LOCAL_SIG);
    writeU16(view, offset + 4, 20);
    writeU16(view, offset + 6, 1 << 11);
    writeU16(view, offset + 8, 0);
    writeU16(view, offset + 10, dosTime);
    writeU16(view, offset + 12, dosDate);
    writeU32(view, offset + 14, item.crc);
    writeU32(view, offset + 18, item.size);
    writeU32(view, offset + 22, item.size);
    writeU16(view, offset + 26, item.nameBytes.length);
    writeU16(view, offset + 28, 0);
    out.set(item.nameBytes, offset + 30);
    out.set(item.data, offset + 30 + item.nameBytes.length);
    offset += 30 + item.nameBytes.length + item.size;
  }

  const centralStart = offset;
  for (let i = 0; i < prepared.length; i++) {
    const item = prepared[i];
    writeU32(view, offset, CENTRAL_SIG);
    writeU16(view, offset + 4, 20);
    writeU16(view, offset + 6, 20);
    writeU16(view, offset + 8, 1 << 11);
    writeU16(view, offset + 10, 0);
    writeU16(view, offset + 12, dosTime);
    writeU16(view, offset + 14, dosDate);
    writeU32(view, offset + 16, item.crc);
    writeU32(view, offset + 20, item.size);
    writeU32(view, offset + 24, item.size);
    writeU16(view, offset + 28, item.nameBytes.length);
    writeU16(view, offset + 30, 0);
    writeU16(view, offset + 32, 0);
    writeU16(view, offset + 34, 0);
    writeU16(view, offset + 36, 0);
    writeU32(view, offset + 38, 0);
    writeU32(view, offset + 42, localOffsets[i]);
    out.set(item.nameBytes, offset + 46);
    offset += 46 + item.nameBytes.length;
  }

  writeU32(view, offset, EOCD_SIG);
  writeU16(view, offset + 4, 0);
  writeU16(view, offset + 6, 0);
  writeU16(view, offset + 8, prepared.length);
  writeU16(view, offset + 10, prepared.length);
  writeU32(view, offset + 12, offset - centralStart);
  writeU32(view, offset + 16, centralStart);
  writeU16(view, offset + 20, 0);

  return out;
}
