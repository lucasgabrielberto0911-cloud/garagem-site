import assert from "node:assert/strict";
import { test } from "node:test";
import type { Prisma } from "@prisma/client";
import { adminFileReferences } from "./admin-file-references";

const url = "https://example.supabase.co/storage/v1/object/public/veiculos/1720000000000-12345678-1234-4234-8234-123456789012.webp";
function fixture(
  photos: { url: string; thumbnailUrl: string | null }[],
  drafts: { photoUrls: string[] }[] = [],
  overrides: Partial<Record<string, unknown>> = {},
) {
  const empty = { findMany: async () => [] };
  return {
    photo: { findMany: async () => photos },
    vehicleCost: empty,
    vehicleDocument: empty,
    testimonial: empty,
    siteSettings: empty,
    leadVenda: empty,
    adminDraft: { findMany: async () => drafts },
    ...overrides,
  } as unknown as Prisma.TransactionClient;
}

test("foto salva e rascunho protegem a versão anterior privada contra limpeza", async () => {
  for (const tx of [fixture([{ url, thumbnailUrl: null }]), fixture([], [{ photoUrls: [url] }])]) {
    const refs = await adminFileReferences(tx);
    assert.ok(refs.publicPaths.has("1720000000000-12345678-1234-4234-8234-123456789012.webp"));
    assert.ok(refs.privatePaths.has("foto-master/1720000000000-12345678-1234-4234-8234-123456789012.jpg"));
    assert.ok(refs.privatePaths.has("foto-master/1720000000000-12345678-1234-4234-8234-123456789012-previous.jpg"));
  }
  assert.equal((await adminFileReferences(fixture([]))).privatePaths.size, 0);
});

test("falha de consulta não trata os arquivos como órfãos", async () => {
  const tx = fixture([]);
  (tx.photo as { findMany: () => Promise<unknown> }).findMany = async () => {
    throw new Error("banco indisponível");
  };
  await assert.rejects(adminFileReferences(tx), /banco indisponível/);
});

test("capa enquadrada com par 960 protege o par contra a limpeza de órfãos", async () => {
  const stem = "1720000000000-12345678-1234-4234-8234-123456789012";
  const base = "https://example.supabase.co/storage/v1/object/public/veiculos";
  const withHd = await adminFileReferences(fixture([{ url: `${base}/${stem}.webp`, thumbnailUrl: `${base}/${stem}-card-x10y20z130-hd.webp` }]));
  assert.ok(withHd.publicPaths.has(`${stem}-card-x10y20z130-hd.webp`));
  assert.ok(withHd.publicPaths.has(`${stem}-card-x10y20z130-hd960.webp`));
  const legacy = await adminFileReferences(fixture([{ url: `${base}/${stem}.webp`, thumbnailUrl: `${base}/${stem}-card-x10y20z130.webp` }]));
  assert.ok(legacy.publicPaths.has(`${stem}-card-x10y20z130.webp`));
  assert.ok(!legacy.publicPaths.has(`${stem}-card-x10y20z130-hd960.webp`));
});

test("fotos de pedidos LeadVenda são protegidas contra exclusão de órfãos", async () => {
  const leadPhoto1 = "https://example.supabase.co/storage/v1/object/public/veiculos/lead-carro-frente.webp";
  const leadPhoto2 = "https://example.supabase.co/storage/v1/object/public/veiculos/lead-carro-traseira.webp";

  const tx = fixture([], [], {
    leadVenda: {
      findMany: async () => [
        { photoUrls: [leadPhoto1, leadPhoto2] },
        { photoUrls: [] },
      ],
    },
  });

  const refs = await adminFileReferences(tx);
  assert.ok(refs.publicPaths.has("lead-carro-frente.webp"));
  assert.ok(refs.publicPaths.has("lead-carro-traseira.webp"));
});

test("rascunhos ativos consultam com filtro de data futura e protegem suas fotos", async () => {
  const draftPhoto = "https://example.supabase.co/storage/v1/object/public/veiculos/draft-temp-123.webp";
  let capturedWhere: unknown = null;

  const tx = fixture([], [], {
    adminDraft: {
      findMany: async (args: { where: unknown }) => {
        capturedWhere = args?.where;
        return [{ photoUrls: [draftPhoto] }];
      },
    },
  });

  const refs = await adminFileReferences(tx);

  // Confere que filtrou por expiração no futuro
  assert.ok(capturedWhere && typeof capturedWhere === "object");
  const expiresAt = (capturedWhere as { expiresAt?: { gt?: Date } }).expiresAt;
  assert.ok(expiresAt?.gt instanceof Date);
  assert.ok(expiresAt.gt.getTime() <= Date.now());

  // Confere que a foto do rascunho está protegida
  assert.ok(refs.publicPaths.has("draft-temp-123.webp"));
});

test("documentos e custos privados entram em privatePaths", async () => {
  const docPrivado = "private://documentos/veiculo-123/crlv-2026.pdf";
  const reciboPrivado = "private://documentos/custos/recibo-oficina.pdf";
  const reciboPublico = "https://example.supabase.co/storage/v1/object/public/veiculos/recibo-foto.webp";

  const tx = fixture([], [], {
    vehicleDocument: {
      findMany: async () => [{ fileUrl: docPrivado }],
    },
    vehicleCost: {
      findMany: async () => [
        { receiptUrl: reciboPrivado },
        { receiptUrl: reciboPublico },
      ],
    },
    testimonial: {
      findMany: async () => [{ photoUrl: "https://example.supabase.co/storage/v1/object/public/veiculos/cliente-foto.webp" }],
    },
    siteSettings: {
      findMany: async () => [{ founderPhotoUrl: "https://example.supabase.co/storage/v1/object/public/veiculos/fundador.webp" }],
    },
  });

  const refs = await adminFileReferences(tx);

  assert.ok(refs.privatePaths.has("veiculo-123/crlv-2026.pdf"));
  assert.ok(refs.privatePaths.has("custos/recibo-oficina.pdf"));
  assert.ok(refs.publicPaths.has("recibo-foto.webp"));
  assert.ok(refs.publicPaths.has("cliente-foto.webp"));
  assert.ok(refs.publicPaths.has("fundador.webp"));
});

test("URLs com query strings ou fragmentos têm seus sufixos limpos", async () => {
  const photoWithQuery = "https://example.supabase.co/storage/v1/object/public/veiculos/foto-com-query.webp?v=2&w=800#preview";

  const tx = fixture([{ url: photoWithQuery, thumbnailUrl: null }]);
  const refs = await adminFileReferences(tx);

  assert.ok(refs.publicPaths.has("foto-com-query.webp"));
});

test("falha em qualquer consulta do lote rejeita a execução inteira", async () => {
  const tabelas = ["leadVenda", "adminDraft", "vehicleCost", "vehicleDocument", "testimonial", "siteSettings"] as const;

  for (const tabela of tabelas) {
    const tx = fixture([], [], {
      [tabela]: {
        findMany: async () => {
          throw new Error(`falha na tabela ${tabela}`);
        },
      },
    });

    await assert.rejects(
      adminFileReferences(tx),
      new RegExp(`falha na tabela ${tabela}`),
    );
  }
});
