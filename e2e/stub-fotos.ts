import type { Page } from "@playwright/test";
import { E2E_PHOTO_FIXTURE, isE2ePhotoStubUrl } from "../src/lib/e2e-photo-stub";

/** Substitui fotos do site, da API e do Storage pela fixture local. */
export async function stubPageFotos(page: Page) {
  await page.route(
    (url) => isE2ePhotoStubUrl(url.href),
    (route) =>
      route.fulfill({
        path: E2E_PHOTO_FIXTURE,
        contentType: "image/png",
      }),
  );
}
