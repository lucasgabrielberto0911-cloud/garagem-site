import {test,expect} from "@playwright/test";
import {readFileSync} from "node:fs";

test("resposta técnica curta, mensagem visível e viewport de teclado",async({page},info)=>{
  await page.addInitScript(()=>localStorage.setItem("garagem_consent","essential"));
  await page.route("**/fotos/**",route=>route.fulfill({contentType:"image/png",body:readFileSync("public/branding/placeholder-car.png")}));
  await page.goto("/estoque");
  await page.getByRole("button",{name:"Ajuda para escolher",exact:true}).first().click();
  const dialog=page.getByRole("dialog",{name:"Garagem",exact:true});
  await dialog.locator("textarea").fill("quantos cv tem a Duster?");
  await dialog.getByRole("button",{name:"Enviar",exact:true}).click();
  await expect(dialog).toHaveAttribute("aria-busy","false");
  const answer=dialog.locator('[data-chat-latest="1"]');
  await expect(answer).toContainText("142 cv no etanol e 138 cv na gasolina");
  await dialog.locator("textarea").focus();
  if(info.project.name.startsWith("mobile")){
    // Chromium does not open an OS keyboard. Simulate only its visual viewport
    // boundary, preserving innerHeight, as the real iOS/Android hook expects.
    await page.evaluate(()=>{
      const viewport=window.visualViewport!;
      Object.defineProperty(viewport,"height",{configurable:true,get:()=>window.innerHeight-280});
      viewport.dispatchEvent(new Event("resize"));
    });
    await expect(page.locator("body")).toHaveAttribute("data-chat-keyboard","");
    await expect.poll(async()=>{
      const box=await dialog.locator("textarea").boundingBox();
      return box!.y>=0&&box!.y+box!.height<=page.viewportSize()!.height-280;
    }).toBe(true);
    await page.evaluate(()=>{
      Object.defineProperty(window.visualViewport!,"height",{configurable:true,get:()=>window.innerHeight});
      window.visualViewport!.dispatchEvent(new Event("resize"));
    });
    await expect(page.locator("body")).not.toHaveAttribute("data-chat-keyboard","");
  }
  await expect.poll(async()=>{
    const box=await dialog.locator("textarea").boundingBox();
    return box!.y>=0&&box!.y+box!.height<=page.viewportSize()!.height;
  }).toBe(true);
  expect(await dialog.evaluate(element=>element.scrollWidth<=element.clientWidth)).toBe(true);
});


test("fontes ficam em uma linha recolhida sem painel ou sugestões abaixo da resposta", async ({page}) => {
  await page.addInitScript(() => localStorage.setItem("garagem_consent", "essential"));
  await page.route("**/api/chat", route => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({
      reply: "O Civic LXR 2.0 2015 tem 155 cv com etanol e 150 cv com gasolina.",
      vehicles: [],
      research: {
        paragraphs: [{ text: "Texto de evidência para o contexto, sem repetir na tela.", sources: [{ title: "Honda — catálogo", href: "https://www.honda.com.br/automoveis" }] }],
        suggestionsHtml: "<div>Sugestões da pesquisa</div>",
      },
    }),
  }));
  await page.goto("/estoque");
  await page.getByRole("button", {name: "Ajuda para escolher", exact: true}).first().click();
  const dialog = page.getByRole("dialog", {name: "Garagem", exact: true});
  await dialog.locator("textarea").fill("pesquise a potência do Civic");
  await dialog.getByRole("button", {name: "Enviar", exact: true}).click();
  const answer = dialog.locator('[data-chat-latest="1"]');
  await expect(answer).toContainText("155 cv");
  await expect(answer.getByText("Fontes dos dados do modelo", {exact: true})).toBeVisible();
  await expect(answer.locator("details")).not.toHaveAttribute("open");
  await expect(answer.locator("iframe")).toHaveCount(0);
  await expect(answer).not.toContainText("Texto de evidência");
  await answer.locator("summary").click();
  await expect(answer.getByRole("link", {name: /Honda — catálogo/})).toBeVisible();
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
});
