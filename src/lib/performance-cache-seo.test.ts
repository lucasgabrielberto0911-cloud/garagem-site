import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = process.cwd();
const readSrc = (rel: string) => readFileSync(join(root, "src", rel), "utf8");
const SCRIPT = join(root, "scripts", "vercel-ignore.sh");

/**
 * Roda o Ignored Build Step com env limpo e determinístico.
 * O `GITHUB_API_URL` aponta para uma porta fechada, provando que os casos
 * que não usam a API do GitHub não dependem de rede.
 */
function runIgnore(env: Record<string, string>) {
  const base = {
    PATH: process.env.PATH ?? "",
    HOME: process.env.HOME ?? "",
    GITHUB_API_URL: "http://127.0.0.1:1",
  };
  try {
    const out = execFileSync("bash", [SCRIPT], {
      env: { ...base, ...env },
      encoding: "utf8",
    });
    return { code: 0, out };
  } catch (error) {
    const failure = error as { status?: number | null; stdout?: string };
    return { code: failure.status ?? 1, out: failure.stdout ?? "" };
  }
}

test("/pedido alinha o ISR público em 3600 s", () => {
  assert.match(
    readSrc("app/(site)/pedido/page.tsx"),
    /export const revalidate = 3600;/,
  );
});

test("a rota do chat é dinâmica e não é pré-renderizada no build", () => {
  const src = readSrc("app/api/chat/route.ts");
  assert.match(src, /export const dynamic = "force-dynamic";/);
  assert.match(src, /export const runtime = "nodejs";/);
  assert.match(src, /export const maxDuration = 45;/);
});

test("salvar as configurações do site invalida a tag site-settings na hora", () => {
  const src = readSrc("app/admin/site/actions.ts");
  assert.match(src, /^"use server";/m);
  assert.match(src, /updateTag\("site-settings"\)/);
  assert.doesNotMatch(src, /revalidateTag\(/);
});

test("vercel-ignore: [preview] no commit builda sem tocar na API do GitHub", () => {
  const { code, out } = runIgnore({
    VERCEL_ENV: "preview",
    VERCEL_GIT_COMMIT_REF: "reserva/10221601abce-8-performance-cache-seo-alinhar",
    VERCEL_GIT_COMMIT_MESSAGE: "Performance, cache e SEO [preview]",
    VERCEL_GIT_PULL_REQUEST_ID: "999",
  });
  assert.equal(code, 1);
  assert.match(out, /\[preview\]/);
});

test("vercel-ignore: produção e branch main sempre buildam", () => {
  assert.equal(
    runIgnore({
      VERCEL_ENV: "production",
      VERCEL_GIT_COMMIT_REF: "main",
      VERCEL_GIT_COMMIT_MESSAGE: "deploy",
    }).code,
    1,
  );
  assert.equal(
    runIgnore({
      VERCEL_ENV: "preview",
      VERCEL_GIT_COMMIT_REF: "main",
      VERCEL_GIT_COMMIT_MESSAGE: "merge",
    }).code,
    1,
  );
});

test("vercel-ignore: preview sem [preview] e sem PR é pulado", () => {
  const { code } = runIgnore({
    VERCEL_ENV: "preview",
    VERCEL_GIT_COMMIT_REF: "reserva/x",
    VERCEL_GIT_COMMIT_MESSAGE: "wip",
    VERCEL_GIT_PULL_REQUEST_ID: "",
  });
  assert.equal(code, 0);
});
