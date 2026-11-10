import { test, expect } from "@playwright/test";

// Só leitura: não cria veículos nem mexe no estoque (o cache da vitrine fica intacto).
test("/links mostra o hub com os 5 links padrão, sem o cromo do site", async ({ page }) => {
  const response = await page.goto("/links");
  expect(response?.status()).toBe(200);

  await expect(page.getByRole("heading", { level: 1, name: "Garagem" })).toBeVisible();

  const hrefs: Record<string, RegExp | string> = {
    "Ver estoque": "/estoque",
    WhatsApp: /^https:\/\/wa\.me\/5527996330706(\?|$)/,
    "Marketplace da loja": "https://www.facebook.com/marketplace/profile/100088276301643/",
    OLX: "https://www.olx.com.br/perfil/garagem-motors-0b087f65",
    Instagram: "https://instagram.com/suagaragem1",
  };
  const hub = page.locator("main ul");
  await expect(hub.getByRole("link")).toHaveCount(5);
  const names = Object.keys(hrefs);
  for (const [index, name] of names.entries()) {
    const link = hub.getByRole("link").nth(index);
    await expect(link).toHaveAccessibleName(name);
    await expect(link).toHaveAttribute("href", hrefs[name] as string | RegExp);
    await expect(link).toBeVisible();
    const box = await link.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(48);
  }

  // Interno na mesma aba; externos em nova aba, sem opener.
  await expect(hub.getByRole("link", { name: "Ver estoque" })).not.toHaveAttribute("target", /.+/);
  for (const name of names.slice(1)) {
    const link = hub.getByRole("link", { name });
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  }

  // Sem menu, barra inferior, WhatsApp flutuante nem chat; logo e "Ir ao site" levam à home.
  await expect(page.locator("header nav, nav")).toHaveCount(0);
  await expect(page.locator(".whatsapp-float")).toHaveCount(0);
  await expect(page.getByRole("link", { name: /ir para o início/i })).toHaveAttribute("href", "/");
  await expect(page.getByRole("link", { name: "Ir ao site" })).toHaveAttribute("href", "/");

  // Nada de parcela/financiamento na página.
  await expect(page.locator("body")).not.toContainText(/parcela|financiamento|simulador/i);

  // Sem rolagem horizontal em nenhuma largura.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("/links tem título próprio, canonical e entra no sitemap; rodapé do site linka para ela", async ({ page, request }) => {
  await page.goto("/links");
  await expect(page).toHaveTitle(/Links da Garagem/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/links$/);

  const xml = await (await request.get("/sitemap.xml")).text();
  expect(xml).toMatch(/<loc>[^<]*\/links<\/loc>/);

  await page.goto("/contato");
  await expect(page.locator("footer").getByRole("link", { name: "Links", exact: true }).first()).toHaveAttribute("href", "/links");
});
