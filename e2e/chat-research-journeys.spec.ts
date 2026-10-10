import {test,expect} from "@playwright/test";
import {readFileSync} from "node:fs";

test("Civic: pergunta técnica, continuidade do torque e nova busca", async ({page})=>{
  await page.addInitScript(()=>localStorage.setItem("garagem_consent","essential"));
  await page.route("**/fotos/**", route=>route.fulfill({contentType:"image/png",body:readFileSync("public/branding/placeholder-car.png")}));
  await page.goto("/estoque");
  await page.getByRole("button",{name:"Ajuda para escolher",exact:true}).first().click();
  const dialog=page.getByRole("dialog",{name:"Garagem",exact:true});
  async function send(question:string){
    await dialog.locator("textarea").fill(question);
    await dialog.getByRole("button",{name:"Enviar",exact:true}).click();
    await expect(dialog).toHaveAttribute("aria-busy","false");
    return dialog.locator('[data-chat-latest="1"]');
  }
  let answer=await send("quantos cvs tem o Civic LXR 2015?");
  await expect(answer).toContainText("155 cv com etanol e 150 cv com gasolina");
  await expect(answer).not.toContainText("142 cv");
  await expect(answer.locator("[data-chat-vehicle]")).toHaveCount(1);
  await expect(answer.getByRole("link",{name:/^Tenho interesse/})).toHaveAttribute("href",/^https:\/\/wa\.me\/5527996330706\?/);
  answer=await send("e o torque?");
  await expect(answer).toContainText("19,5 kgfm com etanol e 19,3 kgfm com gasolina");
  await expect(answer).not.toContainText("155 cv");
  await dialog.getByRole("button",{name:"Nova conversa",exact:true}).click();
  answer=await send("automático até 60 mil");
  await expect(answer).toContainText("Duster");
  await expect(answer).not.toContainText("Civic");
});

test("Civic e Duster: comparação por combustível com resposta antes dos cards",async({page})=>{
  await page.addInitScript(()=>localStorage.setItem("garagem_consent","essential"));
  await page.route("**/fotos/**",route=>route.fulfill({contentType:"image/png",body:readFileSync("public/branding/placeholder-car.png")}));
  await page.goto("/estoque");
  await page.getByRole("button",{name:"Ajuda para escolher",exact:true}).first().click();
  const dialog=page.getByRole("dialog",{name:"Garagem",exact:true});
  await dialog.locator("textarea").fill("entre Civic e Duster, qual é o mais potente?");
  await dialog.getByRole("button",{name:"Enviar",exact:true}).click();
  await expect(dialog).toHaveAttribute("aria-busy","false");
  const answer=dialog.locator('[data-chat-latest="1"]');
  await expect(answer).toContainText("Comparando todos com gasolina");
  await expect(answer).toContainText("Civic LXR 2.0 FlexOne 2015 tem a maior potência");
  await expect(answer.locator("[data-chat-vehicle]")).toHaveCount(2);
  expect(await answer.evaluate(element=>element.textContent!.indexOf("Comparando")<element.textContent!.indexOf("R$"))).toBe(true);
});
