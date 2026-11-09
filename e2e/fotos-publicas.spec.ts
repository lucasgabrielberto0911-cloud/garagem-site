import { test, expect } from "@playwright/test";
import samples from "./public-samples.json";
import { publicPhotoSrc } from "../src/lib/public-photo-url";
import { vehiclePath } from "../src/lib/vehicle-slug";

test("fotos públicas usam o domínio do site sem baixar imagens direto do Storage", async ({ page }) => {
  const storageRequests: string[] = [];
  page.on("request", request => {
    if (/supabase\.co\/storage\//.test(request.url())) storageRequests.push(request.url());
  });
  for (const pattern of ["**/fotos/v1/**", "https://*.public.blob.vercel-storage.com/**", "https://*.supabase.co/storage/**"]) {
    await page.route(pattern, route => route.fulfill({ contentType: "image/png", path: "public/branding/placeholder-car.png" }));
  }
  await page.addInitScript(() => localStorage.setItem("garagem_consent", "essential"));

  for (const path of ["/", "/estoque", vehiclePath(samples[0]), "/sobre"]) {
    await page.goto(path);
    await expect(page.locator('img[src^="/fotos/v1/"]').first()).toBeAttached();
    await expect(page.locator('img[src*="supabase.co/storage"], source[srcset*="supabase.co/storage"], img[srcset*="supabase.co/storage"]')).toHaveCount(0);
    if (path === "/") {
      const avatar = page.getByRole("img", { name: "Camila R.", exact: true });
      await avatar.scrollIntoViewIfNeeded();
      await expect(avatar).toHaveAttribute("src", publicPhotoSrc(samples[0].photos[0].url));
      await expect(avatar).toHaveJSProperty("complete", true);
      expect(await avatar.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    }
    if (path === "/sobre") {
      const portrait = page.getByRole("img", { name: /Elias Clovis/ });
      await portrait.scrollIntoViewIfNeeded();
      await expect(portrait).toHaveAttribute("src", publicPhotoSrc(samples[0].photos[0].url));
      await expect(portrait).not.toHaveAttribute("srcset");
      await expect(portrait).toHaveJSProperty("complete", true);
      expect(await portrait.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    }
  }
  expect(storageRequests).toEqual([]);
});

// APIRequestContext não passa pelo page.route: o servidor deve usar a fixture local.
test("rotas de fotos e catálogo funcionam no E2E sem baixar o Storage", async ({ request }) => {
  const source = publicPhotoSrc(samples[0].photos[0].url);
  const original = await request.get(source);
  expect(original.status()).toBe(200);
  expect(original.headers()["content-type"]).toBe("image/png");
  expect(original.headers()["vercel-cdn-cache-control"]).toContain("s-maxage=");
  const reduced = await request.get(source.replace("/original/", "/1280-contain-q78/"));
  expect(reduced.status()).toBe(200);
  expect(reduced.headers()["content-type"]).toBe("image/webp");
  const feed = await (await request.get("/api/meta/catalog.csv")).text();
  expect(feed).not.toContain("supabase.co/storage/");
  const jpgUrl = feed.match(/https?:[^,"\r\n]+\/api\/catalog-jpg\/[^,"\r\n]+/)?.[0];
  expect(jpgUrl).toBeTruthy();
  const jpg = await request.get(new URL(jpgUrl!).pathname);
  expect(jpg.status()).toBe(200);
  expect(jpg.headers()["content-type"]).toBe("image/jpeg");
});
