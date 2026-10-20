import assert from "node:assert/strict";
import { test } from "node:test";
import { leadWhatsAppTemplates } from "./lead-whatsapp-templates";

const textOf = (href: string) => decodeURIComponent(href.split("?text=")[1]);

test("modelos de compra trazem primeiro nome e carro, sem preço", () => {
  const templates = leadWhatsAppTemplates({
    name: "Carlos Eduardo",
    phone: "(27) 99999-1234",
    vehicleInfo: "Honda Civic 2022",
    source: "chatbot-site",
  });

  assert.deepEqual(
    templates.map((t) => t.id),
    ["disponivel", "fotos", "visita", "retorno", "financiamento", "troca", "vendido", "obrigado"],
  );
  for (const t of templates) {
    assert.match(t.href, /^https:\/\/wa\.me\/5527999991234\?text=/);
    const text = textOf(t.href);
    assert.match(text, /Carlos/);
    assert.doesNotMatch(text, /Eduardo|R\$/);
    assert.match(text, /Honda Civic 2022/);
  }
});

test("lead de venda do usado só recebe modelos de avaliação", () => {
  const templates = leadWhatsAppTemplates({
    name: "Ana Paula",
    phone: "5527988887777",
    vehicleInfo: "Toyota Corolla 2018",
    source: "vender",
  });

  assert.deepEqual(
    templates.map((t) => t.id),
    ["avaliacao-dados", "avaliacao-visita"],
  );
  assert.match(textOf(templates[0].href), /avaliar o seu Toyota Corolla 2018/);
  assert.match(templates[0].href, /^https:\/\/wa\.me\/5527988887777\?text=/);
});

test("sem carro nem nome os modelos continuam legíveis", () => {
  const [disponivel] = leadWhatsAppTemplates({ name: "  ", phone: "27999990000", vehicleInfo: null });
  assert.match(textOf(disponivel.href), /Olá, cliente! Aqui é da Garagem\. O carro que você viu ainda está disponível/);
});
