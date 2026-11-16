import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import postcss from "postcss";
import tailwindcss from "tailwindcss";

// Incidente de 16/11/2026: no deploy de 0c1851a a ficha perdeu a grade de duas
// colunas, o aside e o botão do WhatsApp no computador. O plugin do Tailwind 3
// guarda o caminho do último `@config` visto (lib/plugin.js); quando o build
// processava o admin.css antes do globals.css, o site herdava o `content` do
// painel. Cada CSS com `@tailwind` precisa declarar o próprio `@config`.

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const globalsPath = join(root, "src/app/globals.css");
const adminPath = join(root, "src/app/admin/admin.css");

function cssFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return cssFiles(path);
    return entry.name.endsWith(".css") ? [path] : [];
  });
}

test("todo CSS com @tailwind declara @config antes das diretivas", () => {
  const files = cssFiles(join(root, "src")).filter((file) =>
    /@tailwind\s/.test(readFileSync(file, "utf8")),
  );
  assert.ok(files.includes(globalsPath));
  for (const file of files) {
    const css = readFileSync(file, "utf8");
    const config = css.search(/^@config\s+["'][^"']+["'];/m);
    assert.ok(config >= 0, `${relative(root, file)} precisa de @config explícito`);
    assert.ok(config < css.search(/^@tailwind\s/m), `${relative(root, file)}: @config vem antes de @tailwind`);
  }
  assert.match(readFileSync(globalsPath, "utf8"), /^@config "\.\.\/\.\.\/tailwind\.config\.ts";$/m);
});

test("globals.css gera os utilitários do site mesmo depois do admin.css", async () => {
  // Uma instância só do plugin, como num worker do Turbopack, na ordem que quebrou.
  const plugin = tailwindcss();
  const run = (path: string) =>
    postcss([plugin]).process(readFileSync(path, "utf8"), { from: path }).then((result) => result.css);

  const admin = await run(adminPath);
  const site = await run(globalsPath);

  // Utilitários da ficha e do layout público (tema e arbitrários).
  for (const rule of [
    "grid-template-columns:1.1fr 1fr",
    ".lg\\:inline-flex",
    ".min-h-app-screen",
    ".pt-site-header",
    ".h-14",
  ]) {
    assert.ok(site.replace(/\s+/g, "").includes(rule.replace(/\s+/g, "")), `globals.css sem ${rule}`);
  }
  // Classe que só o painel usa não pode vazar para o CSS do site.
  assert.ok(admin.includes(".h-dvh"));
  assert.ok(!site.includes(".h-dvh"), "globals.css herdou o content do admin");
});
