import { readFile } from "node:fs/promises";
import path from "node:path";
import { isE2ePhotoFixtureEnabled } from "./e2e-photo-config";

/** Interceptação no browser não cobre fetch do servidor nem APIRequestContext. */
export async function e2ePhotoFixture(): Promise<Buffer | null> {
  if (!isE2ePhotoFixtureEnabled()) return null;
  return readFile(path.join(process.cwd(), "public/branding/placeholder-car.png"));
}
