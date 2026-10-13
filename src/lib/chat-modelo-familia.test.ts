import test from "node:test";
import assert from "node:assert/strict";
import { runChatTurn } from "./chat-turn";
import { mentionedModelPools, type ChatVehicleRecord } from "./chat-stock";
import { expertSubject, outsideModelCandidates } from "./chat-expert";

const carro = (id: string, brand: string, model: string): ChatVehicleRecord => ({
  id, brand, model, version: "SE 1.5", yearModel: 2019, price: 49990,
  km: 60000, transmission: "Manual", fuel: "Flex", color: "Prata", category: "carro",
  accessories: ["Câmera de ré", "Airbag duplo", "ABS"],
});
const estoque = [
  carro("ka-sedan", "Ford", "KA SEDAN"),
  carro("civic", "Honda", "Civic"),
  carro("hb20", "Hyundai", "HB20"),
  carro("onix", "Chevrolet", "Onix"),
];
const negacao = /não (?:temos|tem|possui|está|consta)|não achei|nenhum/i;
const perguntar = (mensagem: string) => runChatTurn({
  mensagem, stock: estoque, historico: [], readIntent: async () => null,
  generate: async () => { throw new Error("A ficha deve responder sem gerar texto"); },
});

test("nome do modelo e marca reconhecem a unidade e mantêm resposta e card coerentes", async () => {
  for (const [nome, id] of [["Ka", "ka-sedan"], ["Ford Ka", "ka-sedan"], ["Civic", "civic"], ["HB20", "hb20"], ["Onix", "onix"]]) {
    for (const mensagem of [nome!, nome!.toLowerCase(), `tem ${nome}?`, `mostra o ${nome}`]) {
      assert.deepEqual(mentionedModelPools(estoque, mensagem).flat().map(v => v.id), [id], mensagem);
      const resposta = await perguntar(mensagem);
      assert.deepEqual(resposta.vehicles.map(v => v.id), [id], mensagem);
      assert.doesNotMatch(resposta.reply, negacao, mensagem);
    }
  }
});

test("pergunta técnica com marca não classifica Ka Sedan como fora do estoque", () => {
  for (const mensagem of ["qual o consumo do Ka?", "qual o consumo do Ford Ka?", "e o Ford Ka?", "sobre o Ka Sedan"]) {
    assert.deepEqual(outsideModelCandidates(mensagem, estoque), [], mensagem);
    const sujeito = expertSubject({ mensagem, stock: estoque, historico: [] });
    assert.deepEqual(sujeito.vehicles.map(v => v.id), ["ka-sedan"], mensagem);
    assert.equal(sujeito.outside, undefined);
  }
  assert.deepEqual(outsideModelCandidates("qual o consumo do Ford Mustang?", estoque), ["mustang"]);
});

test("nome da família reconhece variantes quando só elas estão no estoque", async () => {
  for (const [brand, model, nome] of [["Ford", "Ka", "Ford Ka"], ["Hyundai", "HB20S", "HB20"], ["Chevrolet", "Onix Plus", "Onix"]]) {
    const stock = [carro("variante", brand!, model!)];
    const resposta = await runChatTurn({
      mensagem: nome!, stock, historico: [], readIntent: async () => null,
      generate: async () => { throw new Error("A variante deve ser reconhecida"); },
    });
    assert.deepEqual(resposta.vehicles.map(v => v.id), ["variante"], nome);
    assert.doesNotMatch(resposta.reply, negacao, nome);
  }
});

test("nome curto nunca nega equipamento cadastrado e dúvida remete ao vendedor", async () => {
  for (const nome of ["Ka", "Ford Ka", "Civic", "HB20", "Onix"]) {
    for (const item of ["câmera de ré", "airbag", "ABS", "teto solar"]) {
      const resposta = await perguntar(`o ${nome} tem ${item}?`);
      if (item !== "teto solar") assert.doesNotMatch(resposta.reply, negacao, `${nome}: ${resposta.reply}`);
      else assert.doesNotMatch(resposta.reply, /não (?:tem|possui)/i);
      if (item === "teto solar") assert.match(resposta.reply, /vendedor confirma|consultor/i);
    }
  }
});

test("palavras comuns e carroceria isolada não citam Ka nem CG", () => {
  const motos = [...estoque, { ...carro("cg", "Honda", "CG 160 Start"), category: "moto" }];
  for (const mensagem of ["quero um sedan", "Kawasaki", "troca", "carga", "qual a manutenção?"]) {
    assert.equal(mentionedModelPools(motos, mensagem).flat().some(v => v.id === "ka-sedan" || v.id === "cg"), false, mensagem);
  }
});
