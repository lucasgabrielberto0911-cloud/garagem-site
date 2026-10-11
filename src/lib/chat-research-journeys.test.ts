import assert from "node:assert/strict";
import test from "node:test";
import { runChatTurn } from "./chat-turn";
import { researchChatVehicles, rankDocumentedResearch, researchDiagnostics } from "./chat-research";
import { technicalReference, CIVIC_2015_CATALOG_SOURCE, CIVIC_2020_CATALOG_SOURCE } from "./chat-technical-reference";
import { safeResearchUrl } from "./chat-research-data";
import type { ChatVehicleRecord } from "./chat-stock";
import type { ChatTurn } from "./chat-gemini";
import {generateGroundedResearch} from "./chat-gemini";

// Local fixtures only. Technical numbers are sourced model data, not ad facts.
const base = {km: 100000, price: 74900, color: "Prata", category: "carro", transmission: "Automático", fuel: "Flex", engine: "2.0"};
const civic: ChatVehicleRecord = {...base, id: "lxr", brand: "Honda", model: "Civic", version: "LXR 2.0 FlexOne", yearModel: 2015};
const newer = {...civic, id: "exl", version: "EXL 2.0 FLEX 16v", yearModel: 2020, price: 126900};
const duster = {...civic, id: "duster", brand: "Renault", model: "Duster", version: "Dynamique 2.0 16V Tech Road 2", yearModel: 2014, price: 54900};
const stock = [civic, newer, duster];
const user = (content: string): ChatTurn => ({role: "user", content});

const noModel = async () => { throw Error("não precisa do modelo de linguagem"); };

for (const [question, id] of [
  ["quantos cvs tem o Civic LXR 2015?", "lxr"],
  ["qual a potencia do Civic EXL 2020?", "exl"],
  ["quantos cavalos tem o Civic 2019/2020?", "exl"],
] as const) test(`resposta direta da ficha: ${question}`, async () => {
  const result = await runChatTurn({mensagem: question, historico: [], stock, vehicleId: duster.id, generate: noModel});
  assert.equal(result.meta?.policy, "spec-direct");
  assert.deepEqual(result.vehicles.map(vehicle => vehicle.id), [id]);
  assert.match(result.reply, /155 cv no etanol e 150 cv na gasolina/);
  assert.doesNotMatch(result.reply, /142 cv|mais potente|Achei|kgfm/);
});

test("novo modelo com erro de digitação não herda o modelo anterior", async () => {
  const result=await runChatTurn({mensagem:"quantos cv tem a Dustter?",historico:[user("quantos cv tem o Civic LXR 2015?")],stock,vehicleId:civic.id});
  assert.deepEqual(result.vehicles.map(vehicle=>vehicle.id),[duster.id]);
  assert.match(result.reply,/142 cv/);assert.doesNotMatch(result.reply,/155 cv|Civic/);
});

for (const choice of ["o 2020", "2020"]) test(`resposta curta com o ano continua a pergunta: ${choice}`, async () => {
  const result = await runChatTurn({mensagem: "e o torque?", historico: [user("quantos cv tem o Civic?"), user(choice)], stock, vehicleId: duster.id, generate: noModel});
  assert.equal(result.meta?.policy, "spec-direct");
  assert.deepEqual(result.vehicles.map(vehicle => vehicle.id), [newer.id]);
  assert.match(result.reply, /19,5 kgfm no etanol e 19,3 kgfm na gasolina/);
  assert.doesNotMatch(result.reply, /142|Achei/);
});

test("seguimento sem repetir o modelo usa o carro da mensagem anterior, não o da ficha aberta", async () => {
  const result = await runChatTurn({mensagem: "e o torque?", historico: [user("quantos cv tem o Civic 2020?")], stock, vehicleId: duster.id, generate: noModel});
  assert.deepEqual(result.vehicles.map(vehicle => vehicle.id), [newer.id]);
  assert.match(result.reply, /19,5 kgfm/);
  assert.doesNotMatch(result.reply, /20,9|142/);
});

test("não mistura combustíveis e não classifica valores conflitantes", () => {
  const source={href:"https://honda.com.br/catalogo-fixture",title:"Fonte sintética local"};
  const one=technicalReference(civic,"potência")!.paragraphs[0]!;
  const changed={...newer,version:"EX 2.0"};
  const mixed=rankDocumentedResearch({paragraphs:[one,{text:"Civic EX 2.0 2020: potência de 170 cv com etanol.",sources:[source]}]},[civic,changed],"potência");
  assert.match(mixed.comparison!.text,/com etanol/);
  const conflicting=rankDocumentedResearch({paragraphs:[one,{text:"Civic LXR 2.0 FlexOne 2015: potência de 180 cv com etanol.",sources:[source]},technicalReference(newer,"potência")!.paragraphs[0]!]},[civic,newer],"potência");
  assert.equal(conflicting.powerOrder,undefined);
  const noCommon=rankDocumentedResearch({paragraphs:[{text:"Civic LXR 2.0 FlexOne 2015: potência de 150 cv com gasolina.",sources:[source]},{text:"Civic EX 2.0 2020: potência de 170 cv com etanol.",sources:[source]}]},[civic,changed],"potência");
  assert.equal(noCommon.powerOrder,undefined);
  const ambiguous=rankDocumentedResearch({paragraphs:[{text:"Civic LXR 2.0 FlexOne 2015: potência 150/155 cv com etanol.",sources:[source]}]},[civic],"potência");
  assert.equal(ambiguous.powerOrder,undefined);
});

test("comparação entre dois modelos sem o modelo de linguagem fala o vencedor com os cv da ficha", async () => {
  const result = await runChatTurn({mensagem: "entre Civic e Duster, qual é o mais potente com etanol?", historico: [], stock: [civic, duster], generate: noModel});
  assert.equal(result.meta?.policy, "expert");
  assert.match(result.reply, /Civic.*155 cv.*mais forte/);
  assert.match(result.reply, /Duster.*142 cv/);
  assert.doesNotMatch(result.reply, /Achei|No estoque:/);
});

test("falha externa repetida tem cache curto, sem uma segunda chamada", async () => {
  const before=globalThis.fetch,key=process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY="fixture-local";
  let calls=0;
  try{
    globalThis.fetch=(async()=>{calls++;return Response.json({error:{}},{status:429});}) as typeof fetch;
    const unknown={...civic,id:"not-reviewed-cache",yearModel:2021};
    assert.equal((await researchChatVehicles([unknown],undefined,"torque")).unavailable,true);
    assert.equal((await researchChatVehicles([unknown],undefined,"torque")).unavailable,true);
    assert.equal(calls,1);
  }finally{globalThis.fetch=before;if(key===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=key;}
});

test("grounding tenta o Gemini 3.5 primeiro e só cai no 2.5 se o endpoint for rejeitado", async () => {
  const before=globalThis.fetch,key=process.env.GEMINI_API_KEY,model=process.env.GEMINI_MODEL;
  process.env.GEMINI_API_KEY="fixture-local";delete process.env.GEMINI_MODEL;
  try{
    for(const status of [400,404,401,403,429,500]){
      const urls:string[]=[];let firstBody: {generationConfig: {thinkingConfig: unknown}} = {generationConfig: {thinkingConfig: null}};
      globalThis.fetch=(async(url,opts)=>{
        urls.push(String(url));const body=JSON.parse(String(opts?.body));
        if(urls.length===1) firstBody=body;
        assert.deepEqual(body.tools,[{google_search:{}}]);
        return urls.length===1?Response.json({error:{}},{status}):Response.json({candidates:[]});
      }) as typeof fetch;
      if(status===400||status===404){await generateGroundedResearch("identidade pública");assert.equal(urls.length,2);assert.match(urls[0]!,/gemini-3\.5-flash-lite:/);assert.match(urls[1]!,/gemini-2\.5-flash-lite:/);}
      else{await assert.rejects(generateGroundedResearch("identidade pública"));assert.equal(urls.length,1);}
      // Gemini 3.x: thinkingLevel e sem temperature.
      assert.deepEqual(firstBody.generationConfig.thinkingConfig,{thinkingLevel:"minimal"});
      assert.equal("temperature" in firstBody.generationConfig,false);
    }
    const controller=new AbortController();controller.abort();
    await assert.rejects(generateGroundedResearch("identidade pública",controller.signal));
  }finally{globalThis.fetch=before;if(key===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=key;if(model===undefined)delete process.env.GEMINI_MODEL;else process.env.GEMINI_MODEL=model;}
});

test("assunto e ano escolhidos continuam no torque e no consumo sem virar potência", async () => {
  const history = [user("quantos cv tem o Civic?"), user("o 2020")];
  const torque = await runChatTurn({mensagem: "e o torque?", historico: history, stock, vehicleId: civic.id, generate: noModel});
  assert.deepEqual(torque.vehicles.map(vehicle => vehicle.id), [newer.id]);
  assert.match(torque.reply, /19,5 kgfm.*19,3 kgfm/);
  assert.doesNotMatch(torque.reply, /cv|2015/);
  const consumption = await runChatTurn({mensagem: "e o consumo?", historico: history, stock, generate: noModel});
  assert.equal(consumption.meta?.policy, "spec-direct");
  assert.match(consumption.reply, /7,2 km\/l na cidade e 8,9 km\/l na estrada com etanol/);
  assert.match(consumption.reply, /10,5 km\/l na cidade e 13 km\/l na estrada/);
  assert.doesNotMatch(consumption.reply, /155 cv|2015/);
});

test("qual desses é o mais potente? compara os carros da conversa pelas fichas", async () => {
  const streamed: string[] = [];
  let prompt = "";
  const result = await runChatTurn({mensagem: "qual desses é o mais potente?", historico: [user("compare Civic e Duster")], stock,
    onToken: text => streamed.push(text), generate: async ({systemPrompt}) => { prompt = systemPrompt; return {text: "O Civic é o mais forte: cerca de 155 cv no etanol, contra 142 cv da Duster.", functionCall: null}; }});
  assert.equal(result.meta?.policy, "expert");
  assert.match(prompt, /FICHAS TÉCNICAS DE REFERÊNCIA/);
  assert.match(prompt, /155 cv/);
  assert.match(prompt, /142 cv/);
  assert.match(result.reply, /^O Civic é o mais forte/);
  assert.ok(result.vehicles.length > 0 && result.vehicles.every(vehicle => ["lxr", "exl", "duster"].includes(vehicle.id)));
});

test("e o consumo? preserva a dupla da conversa mesmo sem repetir 'desses dois'", async () => {
  const result = await runChatTurn({mensagem: "e o consumo?", historico: [user("compare Civic e Duster")], stock: [civic,duster], generate: noModel});
  assert.match(result.reply, /Civic 2\.0 tem|Civic.*km\/l/);
  assert.match(result.reply, /Duster.*5,8 km\/l na cidade/);
  assert.deepEqual(result.vehicles.map(vehicle => vehicle.id).sort(), [civic.id, duster.id].sort());
});

test("potência e torque pedidos juntos chegam juntos na resposta", async () => {
  const result = await runChatTurn({mensagem: "potência e torque do Civic LXR 2015", historico: [], stock});
  assert.match(result.reply, /155 cv.*150 cv/); assert.match(result.reply, /19,5 kgfm.*19,3 kgfm/);
});

test("catálogos não são extrapolados a outra versão, combustível, motor ou ano", () => {
  for (const changed of [{yearModel:2016}, {version:"LXS 1.8"}, {engine:"1.8"}, {transmission:"Manual"}, {fuel:"Diesel"}, {brand:"Toyota"}])
    assert.equal(technicalReference({...civic,...changed}, "potência"), null);
  assert.equal(technicalReference(civic, "consumo"), null);
  assert.equal(safeResearchUrl(CIVIC_2015_CATALOG_SOURCE), CIVIC_2015_CATALOG_SOURCE);
  assert.equal(safeResearchUrl(CIVIC_2020_CATALOG_SOURCE), CIVIC_2020_CATALOG_SOURCE);
  assert.equal(safeResearchUrl("https://ptdocz.com/doc/46419/outro"), null);
});

test("referências revisadas não fazem chamada externa e recortes incompletos não elegem vencedor", async () => {
  const before=globalThis.fetch;
  try {
    globalThis.fetch = (async()=>{throw Error("unexpected network");}) as typeof fetch;
    const result=await researchChatVehicles(stock, undefined, "potência");
    assert.deepEqual(result.powerOrder,[civic.id,newer.id,duster.id]);
    const partial=rankDocumentedResearch(result,[...stock,{...civic,id:"unknown",yearModel:2021}],"potência");
    assert.equal(partial.powerOrder,undefined); assert.match(partial.comparison!.text,/não consigo apontar/);
    const limited=rankDocumentedResearch(result,stock,"potência",17);
    assert.equal(limited.powerOrder,undefined);
  } finally {globalThis.fetch=before;}
});

test("nova busca de preço/câmbio não herda intenção técnica nem o Civic", async () => {
  const result=await runChatTurn({mensagem:"agora automático até 60 mil",historico:[user("quantos cv tem o Civic 2020?")],stock});
  assert.deepEqual(result.vehicles.map(vehicle=>vehicle.id),[duster.id]); assert.equal(result.research,undefined);
});

test("diagnóstico não publica texto, URL, chave nem pergunta", () => {
  const result=researchDiagnostics({candidates:[{finishReason:"STOP",content:{parts:[{text:"secret"}]},groundingMetadata:{groundingChunks:[{web:{uri:"https://secret"}}],groundingSupports:[{segment:{text:"secret"}}],searchEntryPoint:{renderedContent:"secret"}}}]});
  assert.deepEqual(result,{chunks:1,supports:1,suggestions:true,finishReason:"STOP"});
  assert.equal(JSON.stringify(result).includes("secret"),false);
});
