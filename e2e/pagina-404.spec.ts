import { test, expect } from "@playwright/test";

test.describe("Página 404 (não encontrada)", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("garagem_consent", "essential"));
    await page.route("**/fotos/**", route =>
      route.fulfill({
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900"><rect width="1200" height="900" fill="#17171A"/></svg>',
      })
    );
  });

  test("retorna HTTP 404, mensagem em português, header e footer únicos e links para /estoque, início e WhatsApp", async ({
    page,
    request,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", msg => {
      if (msg.type() === "error" && /hydration|React error|did not match/i.test(msg.text())) {
        errors.push(msg.text());
      }
    });

    // 1. Status HTTP 404 na navegação do browser e na requisição direta
    const response = await page.goto("/pagina-inexistente");
    expect(response?.status()).toBe(404);

    const apiResponse = await request.get("/pagina-inexistente");
    expect(apiResponse.status()).toBe(404);

    // 2. Mensagem em português acolhedora e informativa
    await expect(page.getByText("Erro 404")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Página não encontrada" })
    ).toBeVisible();
    await expect(
      page.getByText(
        "O link que você tentou acessar não existe, foi alterado ou o veículo já foi vendido."
      )
    ).toBeVisible();

    // 3. Header e footer únicos (sem duplicação de layout)
    await expect(page.locator("header")).toHaveCount(1);
    await expect(page.locator("header")).toBeVisible();
    await expect(page.getByRole("banner")).toHaveCount(1);

    await expect(page.locator("footer")).toHaveCount(1);
    await expect(page.locator("footer")).toBeVisible();
    await expect(page.getByRole("contentinfo")).toHaveCount(1);

    // 4. Links de recuperação: /estoque, início (/) e WhatsApp
    const main = page.locator("main");

    const estoqueLink = main.getByRole("link", { name: "Ver estoque" });
    await expect(estoqueLink).toBeVisible();
    await expect(estoqueLink).toHaveAttribute("href", "/estoque");

    const inicioLink = main.getByRole("link", { name: "← Voltar para o Início" });
    await expect(inicioLink).toBeVisible();
    await expect(inicioLink).toHaveAttribute("href", "/");

    const whatsappLink = main.getByRole("link", { name: "Falar no WhatsApp" });
    await expect(whatsappLink).toBeVisible();
    await expect(whatsappLink).toHaveAttribute("href", /wa\.me/);

    // 5. Sem overflow horizontal na viewport
    const viewportWidth = page.viewportSize()?.width ?? 1440;
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(viewportWidth);

    // 6. Sem erros de JS ou de hidratação do React
    expect(errors, "Erros de JS/hidratação na página 404").toEqual([]);
  });

  test("navegação pelos links da página 404 direciona para /estoque e para o início", async ({ page }) => {
    await page.goto("/pagina-inexistente");

    // Clica em "Ver estoque"
    await page.locator("main").getByRole("link", { name: "Ver estoque" }).click();
    await expect(page).toHaveURL(/\/estoque/);

    // Retorna para a 404 e clica em "← Voltar para o Início"
    await page.goto("/pagina-inexistente");
    await page.locator("main").getByRole("link", { name: "← Voltar para o Início" }).click();
    await expect(page).toHaveURL(/\/$/);
  });
});
