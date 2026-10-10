import {test,expect} from "@playwright/test";
import {readFileSync} from "node:fs";
import samples from "./public-samples.json";
import {vehiclePath,vehicleSlug} from "../src/lib/vehicle-slug";

const available=samples[0];
const sold={...available,id:"ce2esold000000000000000001"};

test("ficha vendida: WhatsApp convida para similares sem o preço antigo",async({page,request})=>{
  await page.addInitScript(()=>localStorage.setItem("garagem_consent","essential"));
  await page.route("**/fotos/**",route=>route.fulfill({contentType:"image/png",body:readFileSync("public/branding/placeholder-car.png")}));
  const response=await request.get(vehiclePath(sold));
  expect(response.status()).toBe(200);
  await page.goto(vehiclePath(sold));
  await expect(page).toHaveTitle(/\(vendido\)/);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content",/noindex.*follow/);
  const similar=page.locator('[data-similar-vehicles]').getByRole("link",{name:"Pedir outros nesta faixa",exact:true});
  await expect(similar).toHaveAttribute("href",/^https:\/\/wa\.me\/5527996330706\?/);
  const links=await page.locator('a[href^="https://wa.me/"]').evaluateAll(elements=>elements.map(element=>(element as HTMLAnchorElement).href));
  const messages=links.map(href=>new URL(href)).filter(url=>url.searchParams.get("utm_content")===vehicleSlug(sold));
  expect(messages.length).toBeGreaterThan(0);
  for(const url of messages){
    expect(url.pathname).toBe("/5527996330706");
    expect(url.searchParams.get("text")).not.toMatch(/R\$|74[.,]?900|simular|vídeo/);
  }
  expect(new URL((await similar.getAttribute("href"))!).searchParams.get("text")).toMatch(/opções parecidas no estoque/);
  await page.getByRole("button",{name:"Ajuda para escolher",exact:true}).first().click();
  const chat=page.getByRole("dialog",{name:"Sua Garagem",exact:true});
  const chatContact=chat.getByRole("link",{name:"Falar com um vendedor no WhatsApp",exact:true});
  const chatMessage=new URL((await chatContact.getAttribute("href"))!).searchParams.get("text");
  expect(chatMessage).toMatch(/já foi vendido.*opções parecidas no estoque/);
  expect(chatMessage).not.toMatch(/R\$|74[.,]?900/);
  await chat.getByRole("button",{name:"Fechar chat",exact:true}).click();
  await page.goto(vehiclePath(available));
  const interest=page.locator('[data-ficha-page] aside').getByRole("link",{name:"Tenho interesse",exact:true,includeHidden:true});
  expect(new URL((await interest.getAttribute("href"))!).searchParams.get("text")).toMatch(/por R\$\s*74\.900/);
});

test("home e estoque entregam fotos visíveis mesmo com JavaScript desligado",async({browser,page})=>{
  const context=await browser.newContext({javaScriptEnabled:false,viewport:page.viewportSize()!,baseURL:"http://127.0.0.1:3362"});
  try{
    await context.route("**/fotos/**",route=>route.fulfill({contentType:"image/png",body:readFileSync("public/branding/placeholder-car.png")}));
    const staticPage=await context.newPage();
    for(const path of ["/","/estoque"]){
      await staticPage.goto(path);
      const photo=staticPage.locator("article.listing-card img").first();
      await expect(photo).toBeVisible();
      await expect(staticPage.locator("article.listing-card")).toHaveCount(3);
    }
  }finally{await context.close();}
});

test("capas visíveis antes de baixar o JavaScript e sem mudar de tamanho na hidratação",async({page})=>{
  await page.addInitScript(()=>localStorage.setItem("garagem_consent","essential"));
  await page.route("**/fotos/**",route=>route.fulfill({contentType:"image/png",body:readFileSync("public/branding/placeholder-car.png")}));
  for(const path of ["/","/estoque",vehiclePath(available)]){
    let release!:()=>void;
    const gate=new Promise<void>(resolve=>{release=resolve;});
    const pattern="**/_next/static/**/*.js";
    await page.route(pattern,async route=>{await gate;await route.continue().catch(()=>{});});
    try{
      await page.goto(path,{waitUntil:"commit"});
      const photo=page.locator(path===vehiclePath(available)?".gallery-frame img":"article.listing-card img").first();
      await expect(photo).toBeVisible();
      await expect.poll(()=>photo.evaluate(image=>(image as HTMLImageElement).complete&&(image as HTMLImageElement).naturalWidth>0)).toBe(true);
      const before=await photo.boundingBox();
      const initialPhoto=await photo.elementHandle();
      expect(before!.width).toBeGreaterThan(100);expect(before!.height).toBeGreaterThan(100);
      release();
      await page.waitForLoadState("load");
      await expect.poll(()=>initialPhoto!.evaluate(image=>image.isConnected)).toBe(true);
      await expect.poll(async()=>{
        const after=await photo.boundingBox();
        return after?Math.abs(after.height-before!.height):Infinity;
      }).toBeLessThan(2);
    }finally{release();await page.unroute(pattern);}
  }
});
