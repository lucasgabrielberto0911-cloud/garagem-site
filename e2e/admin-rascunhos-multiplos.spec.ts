import { test as base, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { randomInt, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";

async function guardarAgora(page: Page) {
  const guardar = page.getByRole("button", { name: "Guardar agora", exact: true });
  if (!(await guardar.isVisible())) {
    await page.locator("button[aria-expanded]").filter({ hasText: /Rascunho automático|Salvo às|Salvando|Sem conexão|Outra aba/ }).click();
  }
  await guardar.click();
}

const database = new URL(process.env.DATABASE_URL ?? "postgresql://invalid/");
const localDatabase =
  process.env.E2E_TEST === "1" &&
  ["localhost", "127.0.0.1", "[::1]"].includes(database.hostname) &&
  ["/ci", "/garagem_e2e"].includes(database.pathname);
const prisma = new PrismaClient();
const test = base.extend<{ adminId: string }>({
  adminId: async ({ page, context, baseURL }, executar) => {
    const email = `rascunho-${randomUUID()}@local.test`;
    const password = "rascunho-local-123";
    const admin = await prisma.admin.create({
      data: {
        name: "Teste de rascunhos",
        email,
        passwordHash: await bcrypt.hash(password, 4),
      },
    });
    try {
      await page.route("**/fotos/**", (route) => route.abort());
      await page.route("https://*.supabase.co/**", (route) => route.abort());
      await page.setExtraHTTPHeaders({
        "X-Forwarded-For": `198.18.${randomInt(256)}.${randomInt(1, 255)}`,
      });
      const login = await page.request.post("/api/auth/login", {
        data: { email, password },
      });
      expect(login.ok()).toBeTruthy();
      const cookie = login.headers()["set-cookie"].split(";")[0];
      await context.addCookies([
        {
          name: "session",
          value: cookie.slice("session=".length),
          url: baseURL!,
          httpOnly: true,
          sameSite: "Lax",
          secure: false,
        },
      ]);
      await executar(admin.id);
    } finally {
      await prisma.adminDraft.deleteMany({ where: { adminId: admin.id } });
      await prisma.adminAudit.deleteMany({ where: { adminId: admin.id } });
      await prisma.admin.delete({ where: { id: admin.id } });
    }
  },
});
test.skip(!localDatabase, "Requer banco local dedicado e E2E_TEST=1.");
test.afterAll(async () => prisma.$disconnect());

for (const draft of [undefined, "new", "new-a", "new-b"]) {
  test(`retoma e salva apenas o rascunho ${draft ?? "legado sem parâmetro"}`, async ({
    page,
    adminId,
    baseURL,
  }) => {
    const scopes = ["new", "new-a", "new-b"];
    for (const scope of scopes) {
      const response = await page.request.post("/api/admin/drafts", {
        headers: { Origin: baseURL! },
        data: {
          key: `vehicle:${scope}`,
          payload: { fields: {}, model: `Modelo ${scope}`, step: 2 },
          photoUrls: [],
          expectedUpdatedAt: null,
        },
      });
      expect(response.ok()).toBeTruthy();
    }

    const scope = draft ?? "new";
    const url = `/admin/veiculos/novo${draft ? `?draft=${draft}` : ""}`;
    if (scope !== "new") {
      await page.goto("/admin/veiculos/rascunhos");
      await page.getByRole("listitem").filter({ hasText: `Modelo ${scope}` })
        .getByRole("link", { name: "Continuar", exact: true }).click();
      await expect(page).toHaveURL(url);
    } else {
      await page.goto(url);
    }
    await page.getByRole("button", { name: "Continuar", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Retomar", exact: true }).click();
    await expect(page.locator('[name="model"]')).toHaveValue(`Modelo ${scope}`);
    await page.locator('[name="model"]').fill(`Alterado ${scope}`);
    const saved = page.waitForResponse((response) =>
      response.url().endsWith("/api/admin/drafts") &&
      response.request().method() === "POST" &&
      response.request().postDataJSON().payload?.model === `Alterado ${scope}`,
    );
    await guardarAgora(page);
    const response = await saved;
    expect(response.ok()).toBeTruthy();
    expect(response.request().postDataJSON().key).toBe(`vehicle:${scope}`);
    await expect(page.getByRole("button", { name: "Guardar agora", exact: true })).toBeEnabled();

    await page.reload();
    await page.getByRole("button", { name: "Continuar", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Retomar", exact: true }).click();
    await expect(page.locator('[name="model"]')).toHaveValue(`Alterado ${scope}`);
    for (const other of scopes.filter((item) => item !== scope)) {
      const stored = await prisma.adminDraft.findUniqueOrThrow({
        where: { adminId_key: { adminId, key: `vehicle:${other}` } },
      });
      expect(stored.payload).toEqual({ fields: {}, model: `Modelo ${other}`, step: 2 });
    }
  });
}

test("substituir o rascunho usa o diálogo do painel e cancelar preserva a versão salva", async ({
  page,
  adminId,
  baseURL,
}) => {
  const key = "vehicle:new";
  const payload = {
    fields: {},
    brand: "Marca fictícia",
    model: "Preservar",
    step: 2,
  };
  expect(
    (
      await page.request.post("/api/admin/drafts", {
        headers: { Origin: baseURL! },
        data: { key, payload, photoUrls: [], expectedUpdatedAt: null },
      })
    ).ok(),
  ).toBeTruthy();
  await page.goto("/admin/veiculos/novo?draft=new");
  await expect(
    page.getByRole("button", { name: "Continuar", exact: true }),
  ).toBeVisible();
  await guardarAgora(page);
  await expect(
    page.getByRole("dialog", { name: "Substituir o rascunho anterior?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  const stored = await prisma.adminDraft.findUniqueOrThrow({
    where: { adminId_key: { adminId, key } },
  });
  expect(stored.payload).toEqual(payload);
  await page
    .getByRole("button", { name: "Continuar", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Retomar", exact: true })
    .click();
  await expect(page.locator('[name="model"]')).toHaveValue("Preservar");
});

test("dois rascunhos coexistem, listagem é privada e descarte pede confirmação", async ({
  page,
  adminId,
  baseURL,
  playwright,
}) => {
  const keys = ["vehicle:new-a", "vehicle:new-b"];
  for (const [index, key] of keys.entries()) {
    const saved = await page.request.post("/api/admin/drafts", {
      headers: { Origin: baseURL! },
      data: {
        key,
        payload: {
          fields: {},
          brand: "Marca fictícia",
          model: `Modelo ${index}`,
          year: "2020",
        },
        photoUrls: [],
        expectedUpdatedAt: null,
      },
    });
    expect(saved.ok()).toBeTruthy();
  }
  const foreignAdmin = await prisma.admin.create({
    data: {
      name: "Outro teste",
      email: `outro-${randomUUID()}@local.test`,
      passwordHash: "sem-login",
    },
  });
  try {
    await prisma.adminDraft.createMany({
      data: [
        {
          adminId: foreignAdmin.id,
          key: "vehicle:new-outro",
          payload: { fields: {}, model: "Rascunho alheio" },
          photoUrls: [],
          expiresAt: new Date(Date.now() + 86400000),
        },
        {
          adminId,
          key: "vehicle:new-expirado",
          payload: { fields: {} },
          photoUrls: [],
          expiresAt: new Date(0),
        },
        {
          adminId,
          key: "vehicle:new-so-fotos",
          payload: {},
          photoUrls: [],
          expiresAt: new Date(Date.now() + 86400000),
        },
        {
          adminId,
          key: "vehicle:edicao",
          payload: { fields: {} },
          photoUrls: [],
          expiresAt: new Date(Date.now() + 86400000),
        },
      ],
    });
    const response = await page.request.get(
      "/api/admin/drafts?prefix=vehicle:new",
    );
    expect(response.headers()["cache-control"]).toContain("no-store");
    const { drafts } = await response.json();
    expect(drafts.map((draft: { key: string }) => draft.key).sort()).toEqual(
      keys,
    );
    expect(drafts.every((draft: object) => !("payload" in draft))).toBeTruthy();
    const anonymous = await playwright.request.newContext({ baseURL });
    try {
      expect(
        (await anonymous.get("/api/admin/drafts?prefix=vehicle:new")).status(),
      ).toBe(401);
    } finally {
      await anonymous.dispose();
    }
    expect(
      (await page.request.get("/api/admin/drafts?prefix=vehicle:")).status(),
    ).toBe(400);
    await page.goto("/admin/veiculos/rascunhos");
    await expect(
      page.getByRole("heading", { name: "Rascunhos", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Marca fictícia Modelo 0 2020", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Marca fictícia Modelo 1 2020", { exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await expect(
      page.getByRole("link", { name: "Continuar" }).first(),
    ).toHaveAttribute("href", /draft=new-[ab]/);
    await page
      .getByRole("button", { name: "Descartar", exact: true })
      .first()
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Cancelar", exact: true })
      .click();
    await expect(page.getByRole("link", { name: "Continuar" })).toHaveCount(2);
    await page
      .getByRole("button", { name: "Descartar", exact: true })
      .first()
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Descartar", exact: true })
      .click();
    await expect(page.getByRole("link", { name: "Continuar" })).toHaveCount(1);
    expect(
      await prisma.adminDraft.count({ where: { adminId, key: { in: keys } } }),
    ).toBe(1);
  } finally {
    await prisma.adminDraft.deleteMany({ where: { adminId: foreignAdmin.id } });
    await prisma.admin.delete({ where: { id: foreignAdmin.id } });
  }
});
