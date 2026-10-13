#!/usr/bin/env node
// E2E de conversa do chat via HTTP (multi-turno, mantendo histórico).
// Uso: BASE_URL=http://localhost:3000 node scripts/chat-conversa-e2e.mjs
// Endpoint: POST /api/chat { mensagem, historico, previousVehicleIds } -> { reply, vehicles[] }.

const BASE_URL = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const TIMEOUT_MS = 60_000;

const MOTO_MARCAS = /^(honda cg|cg|cb|xre|bros|pcx|biz|pop|fazer|factor|lander|tenere|ninja|z400|mt-?0\d|titan|fan|start)\b/i;
const PROIBIDOS = [
  [/simulador|simula(r|ção|cao)\s+(de\s+)?financiamento|simule\s+(o\s+)?financiamento/i, "simulador de financiamento"],
  [/endere[çc]o|localiza[çc][ãa]o|\b(rua|avenida|rodovia)\s+[A-ZÀ-Ú0-9]/i, "endereço/localização"],
  [/consignad/i, "consignado"],
];

const cookies = new Map();

function cookieHeader() {
  return [...cookies].map(([k, v]) => `${k}=${v}`).join("; ");
}

function guardarCookies(res) {
  const lista = res.headers.getSetCookie?.() ?? [];
  for (const linha of lista) {
    const [par] = linha.split(";");
    const i = par.indexOf("=");
    if (i > 0) cookies.set(par.slice(0, i).trim(), par.slice(i + 1).trim());
  }
}

async function enviar(mensagem, historico, previousVehicleIds) {
  const res = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", Cookie: cookieHeader() },
    body: JSON.stringify({ mensagem, historico, previousVehicleIds }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  guardarCookies(res);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || typeof data.reply !== "string") {
    throw new Error(`HTTP ${res.status} em "${mensagem}": ${JSON.stringify(data).slice(0, 200)}`);
  }
  return { reply: data.reply, vehicles: Array.isArray(data.vehicles) ? data.vehicles : [] };
}

const ehMoto = (v) =>
  /moto/i.test(v.category ?? "") || MOTO_MARCAS.test(`${v.model ?? ""}`) || MOTO_MARCAS.test(`${v.title ?? ""}`.replace(/^honda\s+|^yamaha\s+/i, ""));
const ehManual = (v) => /manual/i.test(v.transmission ?? "");
const ehAutomatico = (v) => /autom|cvt|dct|dsg/i.test(v.transmission ?? "");
const nome = (v) => `${v.title} (${v.id}, R$ ${Math.round(v.price).toLocaleString("pt-BR")}, ${v.transmission ?? "?"})`;
const trecho = (t) => t.replace(/\s+/g, " ").slice(0, 220);

function terminaComPergunta(reply) {
  const limpo = reply.trim().replace(/[\s\p{Extended_Pictographic}‍️.!]+$/u, "");
  return limpo.endsWith("?");
}

async function conversa(turnos) {
  const historico = [];
  let anteriores = [];
  const respostas = [];
  for (const mensagem of turnos) {
    const r = await enviar(mensagem, historico.slice(-12), anteriores);
    respostas.push({ mensagem, ...r });
    historico.push({ role: "user", content: mensagem }, { role: "assistant", content: r.reply });
    if (r.vehicles.length) anteriores = r.vehicles.map((v) => v.id).slice(0, 3);
  }
  return respostas;
}

function checagensComuns(respostas, falhas) {
  for (const r of respostas) {
    if (!terminaComPergunta(r.reply)) falhas.push(`"${r.mensagem}": não termina com pergunta/convite`);
    for (const [re, rotulo] of PROIBIDOS) {
      if (re.test(r.reply)) falhas.push(`"${r.mensagem}": menciona ${rotulo}`);
    }
  }
}

function semRepeticao(respostas, falhas) {
  const vistos = new Map();
  for (const r of respostas) {
    for (const v of r.vehicles) {
      if (vistos.has(v.id)) falhas.push(`"${r.mensagem}": repete ${nome(v)} já mostrado em "${vistos.get(v.id)}"`);
      else vistos.set(v.id, r.mensagem);
    }
  }
}

// Confere o estoque pela API, independente da resposta do assistente.
const estoque = [];
for (let pagina = 1; ; pagina++) {
  const res = await fetch(`${BASE_URL}/api/estoque?page=${pagina}&pageSize=60`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  const data = await res.json();
  if (!res.ok || !Array.isArray(data.vehicles)) throw new Error(`Estoque indisponível: HTTP ${res.status}`);
  estoque.push(...data.vehicles);
  if (!data.hasMore) break;
}
const motosDisponiveis = estoque.filter(ehMoto);
console.log(`Estoque conferido: ${estoque.length} veículos, ${motosDisponiveis.length} motos.`);

const cenarios = [
  {
    nome: "A) manual de 45 a 50 mil -> outro -> outros",
    turnos: ["Manual de 45 a 50 mil", "outro", "outros"],
    verificar(respostas, falhas) {
      semRepeticao(respostas, falhas);
      for (const r of respostas) {
        for (const v of r.vehicles) {
          if (ehMoto(v)) falhas.push(`"${r.mensagem}": moto ${nome(v)}`);
          const fora = v.price < 45000 || v.price > 50000;
          if (fora) falhas.push(`"${r.mensagem}": ${nome(v)} fora de R$45-50 mil`);
          if (ehAutomatico(v) && !/autom[áa]tic/i.test(r.reply)) {
            falhas.push(`"${r.mensagem}": ${nome(v)} automático sem dizer que é automático`);
          }
        }
      }
      const manuais = estoque.filter(v => ehManual(v) && !ehMoto(v) && v.price >= 45000 && v.price <= 50000);
      if (manuais.length && !respostas[0].vehicles.some(v => manuais.some(m => m.id === v.id))) falhas.push("primeira resposta não mostra o manual disponível na faixa");
    },
  },
  {
    nome: "B) automático até 70 mil -> mais",
    turnos: ["automático até 70 mil", "mais"],
    verificar(respostas, falhas) {
      semRepeticao(respostas, falhas);
      for (const r of respostas) {
        for (const v of r.vehicles) {
          if (ehMoto(v)) falhas.push(`"${r.mensagem}": moto ${nome(v)}`);
          if (v.price > 70000) falhas.push(`"${r.mensagem}": ${nome(v)} acima de R$70 mil`);
          if (ehManual(v)) falhas.push(`"${r.mensagem}": manual ${nome(v)} em busca de automático`);
        }
      }
    },
  },
  {
    nome: "C) tem moto?",
    turnos: ["tem moto?"],
    verificar(respostas, falhas) {
      const r = respostas[0];
      if (motosDisponiveis.length && !r.vehicles.some(ehMoto)) {
        falhas.push(`nenhuma moto nos cards (${r.vehicles.map((v) => v.title).join(", ") || "sem cards"})`);
      }
      if (r.vehicles.some(v => !ehMoto(v))) falhas.push("busca de moto mostrou carro");
      if (!motosDisponiveis.length && (r.vehicles.length || !/n[ãa]o (?:tenho|temos|tem)|ainda n[ãa]o tem/i.test(r.reply))) falhas.push("ausência de motos no estoque não foi informada honestamente");
    },
  },
];

let reprovados = 0;
for (const c of cenarios) {
  const falhas = [];
  let respostas = [];
  try {
    respostas = await conversa(c.turnos);
    checagensComuns(respostas, falhas);
    c.verificar(respostas, falhas);
  } catch (e) {
    falhas.push(`erro: ${e instanceof Error ? e.message : e}`);
  }
  const ok = falhas.length === 0;
  if (!ok) reprovados++;
  console.log(`\n${ok ? "PASS" : "FAIL"}  ${c.nome}`);
  for (const r of respostas) {
    console.log(`  > ${r.mensagem}`);
    console.log(`    resposta: ${trecho(r.reply)}`);
    if (r.vehicles.length) console.log(`    cards: ${r.vehicles.map(nome).join(" | ")}`);
  }
  for (const f of falhas) console.log(`  ✗ ${f}`);
}

console.log(`\n${reprovados === 0 ? "TODOS OS CENÁRIOS PASSARAM" : `${reprovados} cenário(s) reprovado(s)`} (${BASE_URL})`);
process.exit(reprovados === 0 ? 0 : 1);
