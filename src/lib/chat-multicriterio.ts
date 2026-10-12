import { findVehicleSpec, specMaxCv, specCityKmL } from "./chat-specs";
import { vehiclePath } from "./vehicle-slug";
import { parseBodyStyleFilter } from "./chat-prompt";
import { parseTransmissionFilter } from "./chat-stock";
import type { ChatVehicleRecord } from "./chat-stock";

export function chatCriteria(message: string) {
  const text = message.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return {
    power: /\b(fortes?|potentes?|potencia)\b/.test(text),
    economy: /economi|gast[ae] pouco|gast[ae] menos|consum[ae] pouco|consum[ae] menos/.test(text),
    space: /espacos|familia|porta.malas/.test(text),
    cheap: /barat|em conta|menor preco/.test(text),
    automatic: /automatic|cvt/.test(text),
  };
}

const fold = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const hash = (text: string) => [...text].reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 0);

/** Dois por padrão; listas e filtros simples podem apresentar três unidades. */
export function chatPickLimit(message: string) {
  const text = fold(message);
  if (/\b(opc(?:ao|oes)|lista|alguns|uns|tres|3)\b/.test(text)) return 3;
  const criteria = chatCriteria(message);
  if (criteria.power || criteria.economy || criteria.space || criteria.cheap) return 2;
  return /automatic|manual|cvt|\bsuv\b|sedan|hatch|picape|perua|ate\s+(?:r\$\s*)?\d|\d+\s*(?:mil|k)\b/.test(text) ? 3 : 2;
}

export function chatBlockName(v: ChatVehicleRecord) {
  const model = v.model.replace(/\s+/g, " ").trim();
  const name = fold(model).startsWith(fold(v.brand)) ? model : `${v.brand} ${model}`;
  const label = `${name} ${v.yearModel}`;
  if (label.length <= 40) return label;
  const compact = `${model} ${v.yearModel}`;
  return compact.length <= 40 ? compact : `${model.slice(0, 33).trimEnd()}… ${v.yearModel}`;
}

/** Frases variam por unidade, sem inventar detalhes ausentes na ficha. */
export function formatChatCarBlocks(picks: ChatVehicleRecord[], message: string) {
  const criteria = chatCriteria(message);
  const used = new Map<string, Set<number>>();
  let consumptionUsed = false;
  let previousDetail = "";
  const choose = (v: ChatVehicleRecord, key: string, templates: string[]) => {
    const taken = used.get(key) ?? new Set<number>();
    let index = hash(v.id + key) % templates.length;
    while (taken.has(index) && taken.size < templates.length) index = (index + 1) % templates.length;
    taken.add(index); used.set(key, taken);
    return templates[index]!;
  };
  const minPrice = Math.min(...picks.map(v => v.price));
  const lines = picks.map(v => {
    const spec = findVehicleSpec(v);
    const reasons: string[] = [];
    if (criteria.economy && spec) {
      const kml = specCityKmL(spec);
      if (kml != null) {
        const amount = `${spec.aprox ? "cerca de " : ""}${kml.toLocaleString("pt-BR")}`;
        reasons.push(choose(v, "economy", [
          `Pra economizar no dia a dia, faz ${amount} km/l na cidade com gasolina.`,
          `Bebe pouco: ${amount} km/l na cidade, rodando com gasolina.`,
          `No gasto é uma boa pedida, com ${amount} km/l na cidade com gasolina.`,
          `Pra quem roda muito, são ${amount} km/l na cidade com gasolina.`,
        ]));
        consumptionUsed = true;
      }
    }
    if (criteria.power && spec) {
      const motor = spec.motor.match(/\b\d[.,]\d\b/)?.[0]?.replace(".", ",");
      if (motor) {
        const turbo = /turbo|tsi|t-?jet|t-?gdi/i.test(spec.motor) ? " turbo" : "";
        const cv = specMaxCv(spec);
        reasons.push(choose(v, "power", /\b1[.,]0\b/.test(spec.motor) || cv < 90 ? [
          `Motor ${motor}${turbo}, leve e ágil no dia a dia.`,
          `O motor ${motor}${turbo} combina com a rotina de todos os dias.`,
          `Motor ${motor}${turbo} pra acompanhar seus trajetos.`,
          `Com motor ${motor}${turbo}, é uma opção pro dia a dia.`,
        ] : [
          `Motor ${motor}${turbo} com ${cv} cv, dá fôlego na estrada.`,
          `${motor}${turbo} com ${cv} cv, anda bem com a família a bordo.`,
          `São ${cv} cv no motor ${motor}${turbo}, pra acompanhar suas viagens.`,
          `Com ${cv} cv, o motor ${motor}${turbo} dá fôlego pros seus trajetos.`,
        ]));
      }
    }
    if (criteria.space) {
      const n = spec?.portaMalas;
      if (n != null) reasons.push(choose(v, "space", [
        `O porta-malas tem ${n} litros pra levar a bagagem da família.`,
        `São ${n} litros de porta-malas pra organizar malas e compras.`,
        `Pra viajar em família, tem ${n} litros de porta-malas.`,
        `Com ${n} litros no porta-malas, dá pra organizar as malas.`,
      ]));
      else if ((v.doors ?? 0) >= 4) reasons.push(choose(v, "space", [
        `${v.doors} portas pra facilitar o acesso da família.`,
        `Com ${v.doors} portas, fica mais fácil embarcar todo mundo.`,
        `São ${v.doors} portas pra acompanhar a rotina em família.`,
        `As ${v.doors} portas facilitam o acesso aos bancos.`,
      ]));
    }
    if (criteria.cheap && v.price === minPrice && picks.filter(p => p.price === minPrice).length === 1) reasons.push(choose(v, "cheap", [
      "Está entre os mais em conta da lista.", "É o mais em conta entre estas opções.",
      "Entre os que aparecem aqui, tem o menor preço.", "Pra gastar menos, tem o preço mais baixo desta lista.",
    ]));
    if (criteria.automatic && /autom|cvt/i.test(v.transmission)) reasons.push(choose(v, "automatic", [
      "Câmbio automático, tranquilo no trânsito.", "Automático, deixa o dia a dia bem mais leve.",
      "Com câmbio automático, facilita a rotina ao volante.", "O automático dá conforto nos trajetos do dia a dia.",
    ]));
    if (/turbo|\bmotor\b|\b1[.,]0\b|\bcarro mil\b/.test(fold(message))) {
      const registeredMotor = `${v.engine ?? ""} ${v.version ?? ""}`;
      const displacement = registeredMotor.match(/\b\d[.,]\d\b/)?.[0]?.replace(".", ",");
      const turbo = /turbo|tsi|\btb\b|tgdi|t-gdi|t200|t270|tfsi|thp|t-jet|ecoboost/i.test(registeredMotor);
      if (displacement || turbo) reasons.unshift(`Motor${displacement ? ` ${displacement}` : ""}${turbo ? " turbo" : ""} na ficha, pra acompanhar sua rotina.`);
    }
    const items = [...new Set((v.accessories ?? []).map(item => item.replace(/\s+/g, " ").trim()).filter(item => item && item.length < 55))].slice(0, 2);
    const details = [
      !criteria.cheap && Number.isFinite(v.km) ? { key: "km", text: `Está com ${v.km.toLocaleString("pt-BR")} km rodados.` } : null,
      items.length ? { key: "items", text: `Vem com ${items.join(" e ")} na ficha.` } : null,
      { key: "gear", text: `Câmbio ${v.transmission.toLowerCase()}, pra acompanhar sua rotina.` },
      v.color ? { key: "year", text: `É uma unidade ${v.yearModel}, na cor ${v.color.toLowerCase()}.` } : null,
    ].filter((d): d is { key: string; text: string } => d != null);
    const first = reasons[0] ?? choose(v, "fallback", [
      `É uma unidade ${v.yearModel} com câmbio ${v.transmission.toLowerCase()}.`,
      `Câmbio ${v.transmission.toLowerCase()} em uma unidade ${v.yearModel}.`,
      `A unidade é de ${v.yearModel} e tem ${v.km.toLocaleString("pt-BR")} km rodados.`,
      `Com ${v.km.toLocaleString("pt-BR")} km rodados, é uma unidade ${v.yearModel}.`,
    ]);
    const repeats = (d: { key: string; text: string }) =>
      (d.key === "km" && first.includes(v.km.toLocaleString("pt-BR"))) ||
      (d.key === "gear" && first.toLowerCase().includes(v.transmission.toLowerCase())) || d.text === first;
    const detail = details.find(d => d.key !== previousDetail && !repeats(d)) ?? details.find(d => !repeats(d));
    // Um segundo critério documentado tem prioridade sobre um detalhe genérico.
    const second = reasons[1] ?? detail?.text;
    if (!reasons[1] && detail) previousDetail = detail.key;
    const prose = second ? `${first} ${second}` : first;
    return `• **[${chatBlockName(v)}](${vehiclePath(v)})** — ${prose.length <= 230 ? prose : first}`;
  });
  const labels = [criteria.power && "mais fôlego", criteria.economy && "economia de combustível", criteria.space && "bastante espaço", criteria.cheap && "preço em conta", criteria.automatic && "câmbio automático"].filter((label): label is string => Boolean(label));
  const human = labels.length > 1 ? `${labels.slice(0, -1).join(", ")} e ${labels.at(-1)}` : labels[0] ?? "o que você procura";
  const count = picks.length === 3 ? "três" : "dois";
  const intros = [`Pra quem quer ${human}, estes ${count} entregam bem.`, `Olha só, estes ${count} combinam com ${human}.`, `Estes ${count} combinam com ${human}.`];
  const body = parseBodyStyleFilter(message);
  const bodyLabel = body ? { suv: "SUVs", sedan: "sedãs", hatch: "hatches", pickup: "picapes", wagon: "peruas" }[body] : null;
  const gear = parseTransmissionFilter(message);
  const gearLabel = gear === "automatico" ? body === "pickup" || body === "wagon" ? "automáticas" : "automáticos" : gear === "manual" ? "manuais" : "";
  const intro = bodyLabel ? `Olha o que tenho de ${bodyLabel}${gearLabel ? ` ${gearLabel}` : ""} pro seu pedido:` : picks.length === 1 ? "Esse aqui combina bem com o seu pedido:" : intros[hash(message) % intros.length];
  const missing = criteria.economy ? picks.filter(v => { const spec = findVehicleSpec(v); return !spec || specCityKmL(spec) == null; }) : [];
  const source = consumptionUsed ? "O consumo é uma referência do Inmetro e varia conforme o uso." : "";
  const closing = [missing.length ? `Do ${missing.map(v => v.model).join(" e do ")} ainda não tenho o consumo na ficha, mas o consultor confirma pra você.` : "", source].filter(Boolean).join(" ");
  return `${intro}\n\n${lines.join("\n\n")}${closing ? `\n\n${closing}` : ""}`;
}

/** Cada dimensão pesa igualmente; dado ausente não recebe vantagem. */
export function combinedChatRanking(stock: ChatVehicleRecord[], message: string) {
  const criteria = chatCriteria(message);
  if ([criteria.power, criteria.economy, criteria.space, criteria.cheap].filter(Boolean).length < 2 && !(criteria.automatic && criteria.economy) && !(/\bsuv\b/.test(fold(message)) && criteria.space)) return null;
  const pool = criteria.automatic ? stock.filter(v => /autom|cvt/i.test(v.transmission)) : stock;
  const dimensions: Array<(v: ChatVehicleRecord) => number | undefined> = [];
  if (criteria.power) dimensions.push(v => { const spec = findVehicleSpec(v); return spec ? specMaxCv(spec) : undefined; });
  if (criteria.economy) dimensions.push(v => { const spec = findVehicleSpec(v); return spec ? specCityKmL(spec) ?? undefined : undefined; });
  if (criteria.space) dimensions.push(v => findVehicleSpec(v)?.portaMalas);
  if (criteria.cheap) dimensions.push(v => -v.price);
  const ranges = dimensions.map(get => {
    const values = pool.map(get).filter((n): n is number => n != null);
    return { min: Math.min(...values), max: Math.max(...values) };
  });
  const score = (v: ChatVehicleRecord) => dimensions.reduce((sum, get, index) => {
    const value = get(v); const { min, max } = ranges[index]!;
    return sum + (value == null ? 0 : max === min ? 1 : (value - min) / (max - min));
  }, 0);
  const ranked = [...pool].sort((a, b) => score(b) - score(a) || a.price - b.price || a.id.localeCompare(b.id));
  const picks = ranked.slice(0, chatPickLimit(message));
  return picks.length ? { picks, candidates: ranked, reply: formatChatCarBlocks(picks, message) } : null;
}
