import assert from "node:assert/strict";
import { test } from "node:test";
import robots from "@/app/robots";

test("robots.txt permite catalog e fotos para agentes Meta sem abrir /api para os demais", () => {
  const result = robots();
  const rules = Array.isArray(result.rules) ? result.rules : [result.rules];

  const metaAgents = ["facebookexternalhit", "meta-externalagent"];
  for (const agent of metaAgents) {
    const rule = rules.find((r) => r.userAgent === agent);
    assert.ok(rule, `Falta regra para ${agent}`);
    const allow = Array.isArray(rule.allow) ? rule.allow : [rule.allow];
    assert.ok(allow.includes("/api/meta/catalog.csv"));
    assert.ok(allow.includes("/api/catalog-jpg/"));
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
