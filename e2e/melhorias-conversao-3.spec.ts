import { test, expect } from "@playwright/test";
import samples from "./public-samples.json";
import { vehiclePath } from "../src/lib/vehicle-slug";

const civic = samples[0];
const soldCivic = { ...civic, id: "ce2esold000000000000000001" };

test.beforeEach(async ({ page }) => {
  await page.route("**/fotos/**", (route) =>
    route.fulfill({
      contentType: "image/png",
      path: "public/branding/placeholder-car.png",
    }),
  );
  await page.addInitScript(() => {
    if (!localStorage.getItem("garagem_consent")) {
      localStorage.setItem("garagem_consent", "essential");
    }
  });
});

test("ficha vendida pré-preenche o modelo no pedido sem preço e oferece WhatsApp direto", async ({
  page,
}) => {
  await page.goto(vehiclePath(soldCivic));
  const modelInput = page
    .locator("[data-missing-model-form] form")
    .getByLabel("Carro que deseja");
  await expect(modelInput).toHaveValue("Honda Civic");
  await modelInput.fill("Honda Civic LXR");
  await expect(modelInput).toHaveValue("Honda Civic LXR");

  if (page.viewportSize()!.width >= 1024) {
    const soldWa = page
      .locator("[data-ficha-page] aside")
      .getByRole("link", { name: "Pedir parecido no WhatsApp", exact: true });
    await expect(soldWa).toBeVisible();
    const href = (await soldWa.getAttribute("href"))!;
    expect(href).toMatch(/^https:\/\/wa\.me\/5527996330706\?/);
    const text = new URL(href).searchParams.get("text") ?? "";
    expect(text).toMatch(/já foi vendido.*opções parecidas no estoque/);
    expect(text).not.toMatch(/R\$|74[.,]?900/);
  }
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
});

test("agendamento de visita na ficha e em 1 toque no painel do chat", async ({
  page,
}) => {
  await page.goto(vehiclePath(civic));

  if (page.viewportSize()!.width >= 1024) {
    const desktopVisit = page
      .locator("[data-ficha-page] aside")
      .getByRole("link", {
        name: "Agendar visita: combinar dia e hora pelo WhatsApp",
        exact: true,
      });
    await expect(desktopVisit).toBeVisible();
    const href = (await desktopVisit.getAttribute("href"))!;
    expect(href).toMatch(/^https:\/\/wa\.me\/5527996330706\?/);
    expect(new URL(href).searchParams.get("text")).toMatch(
      /Civic.*quero ver ele de perto/,
    );
  } else {
    await page.getByText("Vídeo e propostas", { exact: true }).click();
    const dossierVisit = page
      .locator("details")
      .filter({ hasText: "Vídeo e propostas" })
      .getByRole("link", {
        name: "Agendar visita: combinar dia e hora pelo WhatsApp",
        exact: true,
      });
    await expect(dossierVisit).toBeVisible();
  }

  await page
    .getByRole("button", { name: "Ajuda para escolher", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog", { name: "Garagem", exact: true });
  await dialog.locator("textarea").fill("quero conhecer o carro");
  await dialog.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(dialog).toHaveAttribute("aria-busy", "false");

  const toolbar = dialog.locator("[data-chat-quick-actions]");
  await toolbar.getByRole("button", { name: "Marcar visita", exact: true }).click();
  const panel = dialog.getByRole("group", { name: "Marcar visita", exact: true });
  await expect(panel.getByLabel("Carro de interesse")).toHaveValue(
    "Honda Civic 2015",
  );
  const sendLink = panel.getByRole("link", { name: "Enviar pelo WhatsApp" });
  await expect(sendLink).toHaveAttribute("aria-disabled", "true");

  await panel
    .getByRole("button", { name: "Sábado de manhã", exact: true })
    .click();
  await expect(panel.getByLabel("Horário desejado")).toHaveValue(
    "Sábado de manhã",
  );
  await expect(sendLink).toHaveAttribute("aria-disabled", "false");
  const visitUrl = new URL((await sendLink.getAttribute("href"))!);
  expect(visitUrl.pathname).toBe("/5527996330706");
  expect(visitUrl.searchParams.get("text")).toMatch(
    /Honda Civic 2015.*Sábado de manhã/,
  );
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
});

test("Avisar quando chegar preserva origem consentida no WhatsApp e leva modelo e faixa ao /pedido", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("garagem_consent", "accepted"),
  );
  await page.goto("/?utm_source=instagram");
  await expect
    .poll(() =>
      page.evaluate(() => sessionStorage.getItem("garagem_primeira_origem")),
    )
    .toBe("instagram");

  const modelInput = page.getByLabel("Modelo que você procura");
  const budgetSelect = page.getByLabel("Faixa de preço");
  await modelInput.fill("Corolla");
  await budgetSelect.selectOption("R$ 50 mil a R$ 80 mil");

  const waLink = page.getByRole("link", {
    name: "Avisar no WhatsApp",
    exact: true,
  });
  await expect(waLink).toBeVisible();
  const text = await waLink.evaluate((el) => {
    el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    return new URL((el as HTMLAnchorElement).href).searchParams.get("text");
  });
  expect(text).toMatch(/Corolla.*Faixa de preço: R\$ 50 mil a R\$ 80 mil/);
  expect(text).toContain("Vim pelo Instagram.");

  const orderLink = page.getByRole("link", {
    name: "Registrar pedido no site",
    exact: true,
  });
  await expect(orderLink).toHaveAttribute(
    "href",
    "/pedido?q=Corolla&minPrice=50000&maxPrice=80000",
  );
  await orderLink.click();
  await expect(page).toHaveURL(
    /\/pedido\?q=Corolla&minPrice=50000&maxPrice=80000/,
  );
  const form = page.locator("[data-missing-model-form] form");
  await expect(form.getByLabel("Carro que deseja")).toHaveValue("Corolla");
  await expect(form.getByLabel("Valor máximo")).toHaveValue("R$ 80.000");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
});
