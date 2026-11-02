import { test as base, expect } from "@playwright/test";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";

const source = readFileSync("public/sw.js", "utf8");

// O SW de produção roda sem mocks; só o HTML e a versão do deploy são fixtures.
const test = base.extend<{ origem: { url: string; atualizar: () => void; conectar: (ativa: boolean) => void } }>({
  origem: async ({ context }, usar) => {
    let versao = "teste-v1";
    let conectado = true;
    const server = createServer((request, response) => {
      if (!conectado) { request.socket.destroy(); return; }
      const path = new URL(request.url!, "http://localhost").pathname;
      response.setHeader("Cache-Control", "no-store");
      if (path === "/sw.js") {
        response.setHeader("Content-Type", "application/javascript");
        response.end(source.replace(/const VERSION = "[^"]+";/, `const VERSION = "${versao}";`));
        return;
      }
      response.setHeader("Content-Type", "text/html; charset=utf-8");
      response.end(`<!doctype html><html lang="pt-BR"><title>Fixture PWA</title><body>
        <h1>${path === "/offline" ? "Sem conexão" : `Página ${versao}`}</h1>
        <label>Observação fictícia <input name="observacao"></label>
        <a href="/estoque">Estoque</a></body></html>`);
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    await context.route("**/*", (route) => new URL(route.request().url()).origin === url ? route.continue() : route.abort());
    try { await usar({ url, atualizar: () => { versao = "teste-v2"; }, conectar: (ativa) => { conectado = ativa; } }); }
    finally {
      await context.setOffline(false);
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  },
});

test.beforeEach(async ({ page, origem }) => {
  await page.goto(origem.url);
  await page.evaluate(async () => {
    await navigator.serviceWorker.register("/sw.js?versao=1");
    await navigator.serviceWorker.ready;
  });
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await expect.poll(() => page.evaluate(async () => {
    const key = (await caches.keys()).find((key) => key.endsWith("-pages"));
    return key ? Boolean(await (await caches.open(key)).match("/estoque")) : false;
  })).toBe(true);
});

test("atualização preserva formulário e a próxima navegação recebe a versão nova", async ({ page, origem }) => {
  await page.getByRole("textbox").fill("Texto fictício ainda não salvo");
  origem.atualizar();
  await page.evaluate(async () => { await navigator.serviceWorker.register("/sw.js?versao=2"); });
  await expect.poll(() => page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.active?.scriptURL)).toContain("versao=2");
  await expect(page.getByRole("textbox")).toHaveValue("Texto fictício ainda não salvo");
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL)).toContain("versao=2");
  await page.reload();
  await expect(page.getByRole("heading")).toHaveText("Página teste-v2");
  expect(await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL)).toContain("versao=2");
  expect(await page.evaluate(() => caches.keys())).not.toContain("teste-v1-pages");
});

test("navegação offline usa cache, ficha exige rede e reconexão recupera conteúdo", async ({ page, context, origem }) => {
  await page.evaluate(async () => { await fetch("/api/dados-ficticios"); });
  const admin = await page.goto(`${origem.url}/admin`);
  expect(admin?.fromServiceWorker()).toBe(false);
  // A origem também corta a rede: o fetch do SW deve falhar, inclusive com rotas do Playwright.
  origem.conectar(false);
  await context.setOffline(true);
  const estoque = await page.goto(`${origem.url}/estoque`);
  expect(estoque?.fromServiceWorker()).toBe(true);
  await expect(page.getByRole("heading")).toHaveText("Página teste-v1");
  await page.goto(`${origem.url}/estoque/veiculo-ficticio`);
  await expect(page.getByRole("heading")).toHaveText("Sem conexão");
  origem.conectar(true);
  await context.setOffline(false);
  await page.reload();
  await expect(page.getByRole("heading")).toHaveText("Página teste-v1");
  const privadas = await page.evaluate(async () => {
    const urls = await Promise.all((await caches.keys()).map(async (key) => (await (await caches.open(key)).keys()).map((request) => request.url)));
    return urls.flat().filter((url) => /\/admin|\/api\/|\/estoque\/veiculo-ficticio/.test(url));
  });
  expect(privadas).toEqual([]);
});
