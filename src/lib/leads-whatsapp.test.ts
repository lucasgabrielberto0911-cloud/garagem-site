import assert from "node:assert/strict";
import { test } from "node:test";
import { buildLeadWhatsAppUrl } from "./leads";

test("buildLeadWhatsAppUrl gera abordagem correta para lead do chatbot", () => {
  const url = buildLeadWhatsAppUrl({
    name: "Carlos Eduardo",
    phone: "(27) 99999-1234",
    vehicleInfo: "Honda Civic 2022",
    source: "chatbot-site",
  });

  assert.match(url, /^https:\/\/wa\.me\/5527999991234\?text=/);
  const text = decodeURIComponent(url.split("?text=")[1]);
  assert.match(text, /Olá, Carlos!/);
  assert.match(text, /Você conversou com nosso assistente virtual no site sobre o Honda Civic 2022/);
  assert.match(text, /Como posso te ajudar\?/);
});

test("buildLeadWhatsAppUrl gera abordagem de avaliação para lead do formulário vender", () => {
  const url = buildLeadWhatsAppUrl({
    name: "Ana Paula Souza",
    phone: "27988887777",
    vehicleInfo: "Toyota Corolla 2018",
    plate: "ABC-1D23",
    source: "vender",
  });

  assert.match(url, /^https:\/\/wa\.me\/5527988887777\?text=/);
  const text = decodeURIComponent(url.split("?text=")[1]);
  assert.match(text, /Olá, Ana!/);
  assert.match(text, /Recebemos sua solicitação de avaliação do Toyota Corolla 2018 \(placa ABC1D23\)/);
});

test("buildLeadWhatsAppUrl lida com telefone que já tem 55 e nome simples", () => {
  const url = buildLeadWhatsAppUrl({
    name: "Lucas",
    phone: "5527999990000",
    vehicleInfo: "",
    source: "chatbot-site",
  });

  assert.match(url, /^https:\/\/wa\.me\/5527999990000\?text=/);
  const text = decodeURIComponent(url.split("?text=")[1]);
  assert.match(text, /Olá, Lucas!/);
  assert.match(text, /Você conversou com nosso assistente virtual no site\. Como posso te ajudar\?/);
});
