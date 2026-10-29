import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";

const db = new PrismaClient();
const email = "promissorias@local.test";
const password = "promissorias-local-123";
const customerId = "ce2epromissoriacustomer";
const cpf = "529.982.247-25";

async function limpar() {
  await db.promissoryNote.deleteMany({ where: { issuerCpf: cpf } });
  await db.customer.deleteMany({ where: { id: customerId } });
}

test.beforeAll(async () => {
  await limpar();
  await db.customer.create({ data: { id: customerId, name: "Cliente Promissória E2E", phone: "27999990000", cpf: "52998224725", rg: "1234567 SSP/ES", address: "Rua de Exemplo, 100, Centro, Linhares/ES" } });
  await db.admin.upsert({ where: { email }, create: { name: "Teste promissórias", email, passwordHash: await bcrypt.hash(password, 4) }, update: {} });
});
test.afterAll(async () => {
  await limpar();
  const admin = await db.admin.findUnique({ where: { email }, select: { id: true } });
  if (admin) {
    await db.adminAudit.deleteMany({ where: { adminId: admin.id } });
    await db.admin.delete({ where: { id: admin.id } });
  }
  await db.$disconnect();
});

test("aba Promissórias: emite várias parcelas, lista, baixa o PDF, marca paga com aviso na agenda e cancela", async ({ page, request, context, baseURL, playwright }) => {
  test.setTimeout(120000);
  const publicRequest = await playwright.request.newContext({ baseURL });
  expect((await publicRequest.get("/api/admin/promissorias/inexistente")).status()).toBe(401);
  await publicRequest.dispose();

  await page.setExtraHTTPHeaders({ "X-Forwarded-For": `198.19.${randomInt(256)}.${randomInt(1, 255)}` });
  await page.addInitScript(() => localStorage.setItem("garagem_consent", "essential"));
  const login = await request.post("/api/auth/login", { data: { email, password }, headers: { "X-Forwarded-For": `198.19.${randomInt(256)}.${randomInt(1, 255)}` } });
  expect(login.ok()).toBeTruthy();
  const cookie = login.headers()["set-cookie"].split(";")[0];
  await context.addCookies([{ name: "session", value: cookie.slice("session=".length), url: baseURL!, httpOnly: true, sameSite: "Lax" }]);

  await page.goto("/admin/promissorias");
  await expect(page.getByRole("heading", { name: "Promissórias", level: 1 })).toBeVisible();
  const itens = page.getByTestId("promissoria").filter({ hasText: "Cliente Promissória E2E" });

  await test.step("nascimento e telefone são obrigatórios", async () => {
    await page.getByRole("button", { name: "Nova promissória" }).click();
    const form = page.getByRole("form", { name: "Nova promissória" });
    await expect(form.locator("input[name=issuePlace]")).toHaveValue("Linhares/ES");
    await expect(form.locator("input[name=paymentPlace]")).toHaveValue("Linhares/ES");
    await form.locator("input[name=name]").fill("Cliente Promissória E2E");
    await form.locator("input[name=cpf]").fill("52998224725");
    await form.locator("input[name=address]").fill("Rua de Exemplo, 100, Centro, Linhares/ES");
    await form.locator("input[name=amount]").fill("1.500,00");
    await form.locator("input[name=firstDueDate]").fill("2027-01-31");
    await form.getByRole("button", { name: "Emitir nota" }).click();
    await expect(form.getByText("Informe a data de nascimento.")).toBeVisible();
    await expect(form.getByText("Informe o telefone com DDD.")).toBeVisible();
    expect(await db.promissoryNote.count({ where: { issuerCpf: cpf } })).toBe(0);
  });

  await test.step("cliente cadastrado preenche o emitente e 3 parcelas saem de uma vez", async () => {
    const form = page.getByRole("form", { name: "Nova promissória" });
    await form.locator("input[name=name]").fill("");
    await form.getByRole("combobox").click();
    await page.getByRole("option", { name: /Cliente Promissória E2E/ }).click();
    await expect(form.locator("input[name=name]")).toHaveValue("Cliente Promissória E2E");
    await expect(form.locator("input[name=cpf]")).toHaveValue(cpf);
    await expect(form.locator("input[name=phone]")).toHaveValue("(27) 99999-0000");
    await expect(form.locator("input[name=rg]")).toHaveValue("1234567 SSP/ES");
    await form.locator("input[name=birthDate]").fill("1985-03-12");
    await form.locator("input[name=count]").fill("3");
    await expect(form.getByRole("status")).toContainText("3 notas de R$ 1.500,00");
    await expect(form.getByRole("status")).toContainText("31/01/2027 a 31/03/2027");
    await form.getByRole("button", { name: "Emitir notas" }).click();
    await expect(itens).toHaveCount(3);
  });

  const notas = await db.promissoryNote.findMany({ where: { issuerCpf: cpf }, orderBy: { number: "asc" } });
  await test.step("banco: números em sequência, vencimentos mensais e dados copiados", async () => {
    expect(notas).toHaveLength(3);
    expect(notas.map((nota) => nota.number - notas[0].number)).toEqual([0, 1, 2]);
    expect(notas.map((nota) => nota.dueDate.toISOString().slice(0, 10))).toEqual(["2027-01-31", "2027-02-28", "2027-03-31"]);
    expect(notas.map((nota) => `${nota.installmentNo}/${nota.installmentCount}`)).toEqual(["1/3", "2/3", "3/3"]);
    for (const nota of notas) {
      expect(nota.status).toBe("emitida");
      expect(nota.amount.toString()).toBe("1500");
      expect(nota.customerId).toBe(customerId);
      expect(nota.issuePlace).toBe("Linhares/ES");
      expect(nota.paymentPlace).toBe("Linhares/ES");
      expect(nota.issuerPhone).toBe("27999990000");
      expect(nota.issuerBirthDate.toISOString().slice(0, 10)).toBe("1985-03-12");
    }
    await expect(itens.first()).toContainText(`Nota nº ${notas[0].number} · parcela 1/3`);
    await expect(itens.first()).toContainText("Vence em 31/01/2027");
  });

  await test.step("PDF exige sessão e sai em application/pdf sem cache", async () => {
    const response = await page.request.get(`/api/admin/promissorias/${notas[0].id}`);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("application/pdf");
    expect(response.headers()["cache-control"]).toContain("no-store");
    expect(response.headers()["x-robots-tag"]).toContain("noindex");
    expect(response.headers()["content-disposition"]).toContain(`garagem-promissoria-${notas[0].number}.pdf`);
    expect((await response.body()).subarray(0, 5).toString()).toBe("%PDF-");
    expect((await page.request.get("/api/admin/promissorias/nao-existe")).status()).toBe(404);
  });

  await test.step("marcar paga pede confirmação, tira da lista em aberto e gera aviso na agenda", async () => {
    await itens.filter({ hasText: `Nota nº ${notas[0].number} ` }).getByRole("button", { name: /Marcar nota .* como paga/ }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Marcar como paga" }).click();
    await expect(itens).toHaveCount(2);
    const paga = await db.promissoryNote.findUniqueOrThrow({ where: { id: notas[0].id } });
    expect(paga.status).toBe("paga");
    expect(paga.paidAt).not.toBeNull();
    expect(paga.paidNoticeDoneAt).toBeNull();
    expect(await db.adminAudit.count({ where: { entityId: notas[0].id, action: "promissory.paid" } })).toBe(1);

    await page.goto("/admin/agenda");
    const aviso = page.getByRole("region", { name: "Promissórias pagas" }).getByRole("article").filter({ hasText: `Nota nº ${notas[0].number} ` });
    await expect(aviso).toContainText("foi baixada como paga");
    await aviso.getByRole("button", { name: "Dar ciência" }).click();
    await expect(aviso).toHaveCount(0);
    expect((await db.promissoryNote.findUniqueOrThrow({ where: { id: notas[0].id } })).paidNoticeDoneAt).not.toBeNull();

    await page.goto("/admin/promissorias?status=pagas");
    await expect(page.getByTestId("promissoria").filter({ hasText: `Nota nº ${notas[0].number} ` })).toContainText("Paga");
  });

  await test.step("cancelar tira o PDF e a nota paga não pode mais ser cancelada", async () => {
    await page.goto("/admin/promissorias");
    await itens.filter({ hasText: `Nota nº ${notas[1].number} ` }).getByRole("button", { name: /Cancelar nota/ }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Cancelar nota" }).click();
    await expect(itens).toHaveCount(1);
    expect((await db.promissoryNote.findUniqueOrThrow({ where: { id: notas[1].id } })).status).toBe("cancelada");
    await page.goto("/admin/promissorias?status=canceladas");
    const cancelada = page.getByTestId("promissoria").filter({ hasText: `Nota nº ${notas[1].number} ` });
    await expect(cancelada).toContainText("Cancelada");
    await expect(cancelada.getByRole("link", { name: /Baixar PDF/ })).toHaveCount(0);
    await page.goto("/admin/promissorias?status=pagas");
    await expect(page.getByTestId("promissoria").filter({ hasText: `Nota nº ${notas[0].number} ` }).getByRole("button")).toHaveCount(0);
  });

  await test.step("busca por número e sem overflow horizontal", async () => {
    await page.goto(`/admin/promissorias?status=todas&q=${notas[2].number}`);
    await expect(page.getByTestId("promissoria")).toHaveCount(1);
    await expect(page.getByTestId("promissoria")).toContainText(`Nota nº ${notas[2].number} `);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
