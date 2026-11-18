import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";
import { PhotoZipFailuresNotice } from "@/components/admin/PhotoZipFailuresNotice";
import {
  buildResilientPhotoZip,
  createAdminPhotoFetchLoader,
  decodeZipCountsHeader,
  decodeZipFailuresHeader,
  encodeZipFailuresHeader,
  PHOTO_ZIP_REPORT_FILENAME,
  sanitizeFailureReason,
} from "./admin-photo-zip";
import { loadAdminJpegDetailed } from "./photo-archive-download";

const R2_TEST_ENV = {
  R2_ACCOUNT_ID: "acc-ficticio-teste",
  R2_BUCKET: "bucket-ficticio-teste",
  R2_PUBLIC_URL: "https://pub-ficticio123.r2.dev",
  R2_API_TOKEN: "token-ficticio-nunca-exposto",
};

function withR2Env(fn: () => Promise<void> | void) {
  return async () => {
    const saved: Record<string, string | undefined> = {};
    for (const key of Object.keys(R2_TEST_ENV) as Array<keyof typeof R2_TEST_ENV>) {
      saved[key] = process.env[key];
      process.env[key] = R2_TEST_ENV[key];
    }
    try {
      await fn();
    } finally {
      for (const key of Object.keys(R2_TEST_ENV)) {
        if (saved[key] === undefined) delete process.env[key];
        else process.env[key] = saved[key];
      }
    }
  };
}

/** Extrai nomes e conteúdos de um ZIP store válido pelo diretório central. */
function readZipEntries(zip: Uint8Array): Array<{ name: string; data: Uint8Array }> {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const eocd = zip.byteLength - 22;
  assert.equal(view.getUint32(eocd, true), 0x06054b50, "EOCD inválido no ZIP");
  const count = view.getUint16(eocd + 8, true);
  let centralOffset = view.getUint32(eocd + 16, true);
  const decoder = new TextDecoder();
  const out: Array<{ name: string; data: Uint8Array }> = [];

  for (let i = 0; i < count; i++) {
    assert.equal(view.getUint32(centralOffset, true), 0x02014b50);
    const size = view.getUint32(centralOffset + 24, true);
    const nameLen = view.getUint16(centralOffset + 28, true);
    const extraLen = view.getUint16(centralOffset + 30, true);
    const commentLen = view.getUint16(centralOffset + 32, true);
    const localOffset = view.getUint32(centralOffset + 42, true);

    const name = decoder.decode(
      zip.subarray(centralOffset + 46, centralOffset + 46 + nameLen),
    );
    assert.equal(view.getUint32(localOffset, true), 0x04034b50);
    const localNameLen = view.getUint16(localOffset + 26, true);
    const localExtraLen = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    const data = zip.subarray(dataStart, dataStart + size);

    out.push({ name, data });
    centralOffset += 46 + nameLen + extraLen + commentLen;
  }

  return out;
}

test("falha parcial via fetch: faz 1 retry, recupera falha transitória, continua nas demais e gera FALHAS.txt", async () => {
  const attemptsByUrl = new Map<string, number>();
  const requestedUrls: string[] = [];

  const photos = [
    { id: "p1", url: "https://pub-ficticio123.r2.dev/1710000000001-aaaaaaaa-bbbb-4ccc-8ddd-000000000001.webp" },
    { id: "p2", url: "https://pub-ficticio123.r2.dev/1710000000002-aaaaaaaa-bbbb-4ccc-8ddd-000000000002.webp" },
    { id: "p3", url: "https://pub-ficticio123.r2.dev/1710000000003-aaaaaaaa-bbbb-4ccc-8ddd-000000000003.webp" },
    { id: "p4", url: "https://pub-ficticio123.r2.dev/1710000000004-aaaaaaaa-bbbb-4ccc-8ddd-000000000004.webp" },
  ];

  const payload1 = new TextEncoder().encode("jpeg-original-01");
  const payload2 = new TextEncoder().encode("jpeg-original-02");
  const payload4 = new TextEncoder().encode("jpeg-original-04");

  const mockFetch: typeof fetch = async (input) => {
    const parsed = new URL(String(input), "https://painel.local");
    const targetUrl = parsed.searchParams.get("url") ?? "";
    requestedUrls.push(targetUrl);
    const count = (attemptsByUrl.get(targetUrl) ?? 0) + 1;
    attemptsByUrl.set(targetUrl, count);

    if (targetUrl === photos[0].url) {
      return new Response(payload1, { status: 200, headers: { "Content-Type": "image/jpeg" } });
    }
    if (targetUrl === photos[1].url) {
      // Falha na 1ª tentativa, recupera no 1º retry
      if (count === 1) {
        return new Response(JSON.stringify({ reason: "Falha temporária" }), { status: 502 });
      }
      return new Response(payload2, { status: 200, headers: { "Content-Type": "image/jpeg" } });
    }
    if (targetUrl === photos[2].url) {
      // Falha permanente nas 2 tentativas (original + 1 retry)
      return new Response(JSON.stringify({ reason: "Foto não encontrada" }), { status: 404 });
    }
    return new Response(payload4, { status: 200, headers: { "Content-Type": "image/jpeg" } });
  };

  const result = await buildResilientPhotoZip({
    vehicle: { brand: "Hyundai", model: "Creta", year: 2022 },
    photos,
    loadPhoto: createAdminPhotoFetchLoader(mockFetch),
    retries: 1,
    timeoutMs: 500,
    retryDelayMs: 0,
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.zipFilename, "garagem-hyundai-creta-2022-fotos.zip");
  assert.equal(result.totalCount, 4);
  assert.equal(result.downloadedCount, 3);

  // Confere tentativas: foto 1 (1x), foto 2 (2x), foto 3 (2x), foto 4 (1x)
  assert.equal(attemptsByUrl.get(photos[0].url), 1);
  assert.equal(attemptsByUrl.get(photos[1].url), 2);
  assert.equal(attemptsByUrl.get(photos[2].url), 2);
  assert.equal(attemptsByUrl.get(photos[3].url), 1);

  assert.deepEqual(result.failures, [
    {
      index: 3,
      filename: "hyundai-creta-2022-03.jpg",
      reason: "Foto não encontrada",
    },
  ]);

  // Ordem e numeração originais preservadas (01, 02, 04) + FALHAS.txt no fim
  const entries = readZipEntries(result.zip);
  assert.deepEqual(
    entries.map((entry) => entry.name),
    [
      "hyundai-creta-2022-01.jpg",
      "hyundai-creta-2022-02.jpg",
      "hyundai-creta-2022-04.jpg",
      PHOTO_ZIP_REPORT_FILENAME,
    ],
  );
  assert.deepEqual(entries[0].data, payload1);
  assert.deepEqual(entries[1].data, payload2);
  assert.deepEqual(entries[2].data, payload4);

  const reportText = new TextDecoder().decode(entries[3].data);
  assert.match(reportText, /Fotos incluídas no ZIP: 3 de 4/);
  assert.match(reportText, /Foto 03 \(hyundai-creta-2022-03\.jpg\): Foto não encontrada/);
});

test("timeout numa foto não trava o ZIP: aborta com motivo curto após 1 retry e baixa as outras", async () => {
  let slowAttempts = 0;
  const okBytes = new TextEncoder().encode("jpeg-rapida");

  const mockFetch: typeof fetch = async (input, init) => {
    const parsed = new URL(String(input), "https://painel.local");
    const targetUrl = parsed.searchParams.get("url") ?? "";
    if (targetUrl.includes("lenta")) {
      slowAttempts++;
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      });
    }
    return new Response(okBytes, { status: 200, headers: { "Content-Type": "image/jpeg" } });
  };

  const result = await buildResilientPhotoZip({
    vehicle: { brand: "Fiat", model: "Fastback", year: 2024 },
    photos: [
      { id: "a", url: "https://pub-ficticio123.r2.dev/foto-lenta.webp" },
      { id: "b", url: "https://pub-ficticio123.r2.dev/foto-ok.webp" },
    ],
    loadPhoto: createAdminPhotoFetchLoader(mockFetch),
    retries: 1,
    timeoutMs: 40,
    retryDelayMs: 0,
  });

  assert.equal(slowAttempts, 2);
  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.downloadedCount, 1);
  assert.deepEqual(result.failures, [
    {
      index: 1,
      filename: "fiat-fastback-2024-01.jpg",
      reason: "Tempo esgotado",
    },
  ]);

  const entries = readZipEntries(result.zip);
  assert.deepEqual(
    entries.map((e) => e.name),
    ["fiat-fastback-2024-02.jpg", PHOTO_ZIP_REPORT_FILENAME],
  );
});

test("quando TODAS as fotos falham, retorna erro claro e lista todas as falhas sem gerar ZIP vazio", async () => {
  const mockFetch: typeof fetch = async (input) => {
    const parsed = new URL(String(input), "https://painel.local");
    const targetUrl = parsed.searchParams.get("url") ?? "";
    if (targetUrl.endsWith("1.webp")) {
      return new Response(JSON.stringify({ reason: "Foto não encontrada" }), { status: 404 });
    }
    return new Response(JSON.stringify({ reason: "Tempo esgotado" }), { status: 504 });
  };

  const result = await buildResilientPhotoZip({
    vehicle: { brand: "Toyota", model: "Corolla", year: 2023 },
    photos: [
      { id: "1", url: "https://pub-ficticio123.r2.dev/1.webp" },
      { id: "2", url: "https://pub-ficticio123.r2.dev/2.webp" },
    ],
    loadPhoto: createAdminPhotoFetchLoader(mockFetch),
    retries: 1,
    timeoutMs: 200,
    retryDelayMs: 0,
  });

  assert.equal(result.ok, false);
  if (result.ok) return;

  assert.equal(result.totalCount, 2);
  assert.match(result.error, /todas as 2 fotos falharam/i);
  assert.match(result.error, /foto 01: Foto não encontrada/i);
  assert.match(result.error, /foto 02: Tempo esgotado/i);
  assert.equal(result.failures.length, 2);
});

test(
  "servidor + R2/master sem downgrade: preserva bytes originais do master e do R2 sem recomprimir nem redimensionar na falha parcial",
  withR2Env(async () => {
    const id1 = "1710000000010-11111111-2222-4333-8444-555555555551";
    const id2 = "1710000000020-11111111-2222-4333-8444-555555555552";
    const id3 = "1710000000030-11111111-2222-4333-8444-555555555553";

    const masterJpeg2400 = new Uint8Array(
      await sharp({
        create: { width: 2400, height: 1800, channels: 3, background: "#113355" },
      })
        .jpeg({ quality: 93 })
        .toBuffer(),
    );

    const r2OriginalJpeg1920 = new Uint8Array(
      await sharp({
        create: { width: 1920, height: 1440, channels: 3, background: "#442211" },
      })
        .jpeg({ quality: 94 })
        .toBuffer(),
    );

    const mockR2Fetch: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes(id2)) {
        return new Response(null, { status: 404 });
      }
      if (url.includes(id3)) {
        return new Response(r2OriginalJpeg1920, {
          status: 200,
          headers: { "Content-Type": "image/jpeg" },
        });
      }
      return new Response(null, { status: 404 });
    };

    const result = await buildResilientPhotoZip({
      vehicle: { brand: "Honda", model: "HR-V", year: 2021 },
      photos: [
        { id: "m1", url: `https://pub-ficticio123.r2.dev/${id1}-g800.webp` },
        { id: "m2", url: `https://pub-ficticio123.r2.dev/${id2}-g800.webp` },
        { id: "m3", url: `https://pub-ficticio123.r2.dev/${id3}.jpg` },
      ],
      loadPhoto: ({ photo, signal }) =>
        loadAdminJpegDetailed(photo.url, {
          signal,
          timeoutMs: 500,
          fetcher: mockR2Fetch,
          downloadMaster: async (masterPath) =>
            masterPath === `foto-master/${id1}.jpg` ? masterJpeg2400 : null,
        }),
      retries: 1,
      timeoutMs: 600,
      retryDelayMs: 0,
      concurrency: 3,
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;

    assert.equal(result.downloadedCount, 2);
    assert.deepEqual(result.failures, [
      {
        index: 2,
        filename: "honda-hr-v-2021-02.jpg",
        reason: "Foto não encontrada",
      },
    ]);

    const entries = readZipEntries(result.zip);
    assert.deepEqual(
      entries.map((e) => e.name),
      [
        "honda-hr-v-2021-01.jpg",
        "honda-hr-v-2021-03.jpg",
        PHOTO_ZIP_REPORT_FILENAME,
      ],
    );

    // Byte a byte idêntico: zero recompressão e zero redimensionamento
    assert.deepEqual(entries[0].data, masterJpeg2400);
    assert.deepEqual(entries[1].data, r2OriginalJpeg1920);

    const meta1 = await sharp(Buffer.from(entries[0].data)).metadata();
    const meta3 = await sharp(Buffer.from(entries[1].data)).metadata();
    assert.equal(meta1.width, 2400);
    assert.equal(meta1.height, 1800);
    assert.equal(meta3.width, 1920);
    assert.equal(meta3.height, 1440);
  }),
);

test("cabeçalhos HTTP do ZIP preservam acentos em ASCII puro e sanitizam segredos", () => {
  const reason = sanitizeFailureReason(
    "Erro em https://interno.local/x?token=segredo123 Authorization: Bearer abcdef",
  );
  assert.equal(reason.includes("segredo123"), false);
  assert.equal(reason.includes("abcdef"), false);
  assert.equal(reason.includes("https://"), false);

  const encoded = encodeZipFailuresHeader([
    {
      index: 2,
      filename: "vw-nivus-2023-02.jpg",
      reason: "Foto não encontrada",
    },
  ]);
  // Deve ser estritamente ASCII imprimível para caber em header HTTP do NextResponse
  assert.match(encoded, /^[\x20-\x7E]+$/);

  assert.deepEqual(decodeZipFailuresHeader(encoded), [
    {
      index: 2,
      filename: "vw-nivus-2023-02.jpg",
      reason: "Foto não encontrada",
    },
  ]);
  assert.deepEqual(decodeZipCountsHeader("3/4"), {
    downloadedCount: 3,
    totalCount: 4,
  });
});

test("aviso visual PhotoZipFailuresNotice exibe número, arquivo e motivo curto na tela do admin", () => {
  const partialHtml = renderToStaticMarkup(
    createElement(PhotoZipFailuresNotice, {
      notice: {
        downloadedCount: 2,
        totalCount: 3,
        failures: [
          {
            index: 2,
            filename: "chevrolet-onix-2022-02.jpg",
            reason: "Tempo esgotado",
          },
        ],
      },
      onDismiss: () => {},
    }),
  );

  assert.match(partialHtml, /ZIP baixado com 2 de 3 fotos/);
  assert.match(partialHtml, /FALHAS\.txt/);
  assert.match(partialHtml, /Foto 02/);
  assert.match(partialHtml, /chevrolet-onix-2022-02\.jpg/);
  assert.match(partialHtml, /Tempo esgotado/);

  const allFailedHtml = renderToStaticMarkup(
    createElement(PhotoZipFailuresNotice, {
      notice: {
        downloadedCount: 0,
        totalCount: 2,
        failures: [
          {
            index: 1,
            filename: "chevrolet-onix-2022-01.jpg",
            reason: "Foto não encontrada",
          },
          {
            index: 2,
            filename: "chevrolet-onix-2022-02.jpg",
            reason: "Tempo esgotado",
          },
        ],
        errorMessage:
          "Não foi possível gerar o ZIP: todas as 2 fotos falharam.",
      },
      onDismiss: () => {},
    }),
  );

  assert.match(allFailedHtml, /todas as 2 fotos falharam/);
  assert.match(allFailedHtml, /chevrolet-onix-2022-01\.jpg/);
  assert.match(allFailedHtml, /Foto não encontrada/);
});
