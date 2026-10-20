import assert from "node:assert/strict";
import { test } from "node:test";
import robots from "@/app/robots";

test("robots.txt permite catalog e fotos para agentes Meta sem abrir /api para os demais", () => {
  const result = robots();
  const rules = Array.isArray(result.rules) ? result.rules : [result.rules];

  const metaAgents = ["facebookexternalhit", "Facebot", "meta-externalagent"];
  for (const agent of metaAgents) {
    const rule = rules.find((r) => r.userAgent === agent);
    assert.ok(rule, `Falta regra para ${agent}`);
    const allow = Array.isArray(rule.allow) ? rule.allow : [rule.allow];
    assert.deepEqual(allow, ["/", "/api/meta/catalog.csv$", "/api/catalog-jpg/"]);
    const disallow = Array.isArray(rule.disallow) ? rule.disallow : [rule.disallow];
    assert.ok(disallow.includes("/api"));
  }

  const defaultRule = rules.find((r) => r.userAgent === "*");
  assert.ok(defaultRule);
  const defaultDisallow = Array.isArray(defaultRule.disallow)
    ? defaultRule.disallow
    : [defaultRule.disallow];
  assert.ok(defaultDisallow.includes("/api"));
  assert.equal(defaultRule.allow, "/");
});

test("regra mais específica libera só o feed exato e as fotos para Meta", () => {
  const rules = robots().rules;
  assert.ok(Array.isArray(rules));
  for (const rule of rules) {
    const meta = ["facebookexternalhit", "Facebot", "meta-externalagent"].includes(String(rule.userAgent));
    const allows = [rule.allow ?? []].flat();
    const blocks = [rule.disallow ?? []].flat();
    for (const [path, expected] of [
      ["/estoque/exemplo", true],
      ["/api/meta/catalog.csv", meta],
      ["/api/catalog-jpg/veiculo/foto.jpg", meta],
      ["/api/meta/catalog.csv/privado", false],
      ["/api/meta/catalog.csv.bak", false],
      ["/api/meta/outro", false],
      ["/api/catalog-jpg-privado/foto.jpg", false],
      ["/api/estoque", false],
      ["/api/admin", false],
      ["/admin/veiculos", false],
    ] as const) {
      const matches = [...allows.map(value => ({ value, allow: true })), ...blocks.map(value => ({ value, allow: false }))]
        .filter(({ value }) => value.endsWith("$") ? path === value.slice(0, -1) : path.startsWith(value))
        .sort((a, b) => b.value.length - a.value.length || Number(b.allow) - Number(a.allow));
      assert.equal(matches[0]?.allow ?? true, expected, `${rule.userAgent}: ${path}`);
    }
  }
});
