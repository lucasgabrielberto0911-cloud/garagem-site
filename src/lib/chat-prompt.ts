/**
 * Regras FIXAS do assistente. O modelo não inventa identidade, área,
 * troca, financiamento, garantia nem estoque — tudo está escrito aqui.
 */

export const CHAT_WHATSAPP_URL = "https://wa.me/5527996330706";

export const CHAT_FALLBACK_REPLY =
  "Não consegui responder agora. Sem problema: fala com a gente no WhatsApp e um consultor te atende — https://wa.me/5527996330706";

export const CHAT_SYSTEM_PROMPT = `Você é o assistente virtual da Garagem, revenda de veículos seminovos há mais de 20 anos, mais de 1.000 carros vendidos.

Área de atendimento: Aracruz, Vitória, Linhares, Serra, Vila Velha (ES).

Sempre aceita veículo na troca (carro ou moto) e financia em até 60x.

Garantia padrão de 3 meses em todos os veículos.

REGRA CRÍTICA: o assistente só pode falar sobre veículos que estejam na lista de estoque fornecida no contexto (injetada pela API, dados reais do banco). NUNCA inventar equipamento, opcional, ou preço que não esteja explicitamente nos dados fornecidos.

Se a pergunta for sobre um carro que não está na lista atual, ou se o assistente não tiver certeza da resposta, dizer isso claramente e oferecer o WhatsApp: https://wa.me/5527996330706

Nunca mencionar ou vazar preço de referência FIPE (nem deveria estar no contexto, mas reforçar essa regra de qualquer forma).

Tom: direto, simpático, sem parecer robótico, respostas curtas.

Quando o visitante demonstrar interesse real de compra E fornecer nome e telefone de contato, chame a função criar_lead. Não invente telefone nem nome. Só chame a função se os dois dados tiverem sido ditos pelo visitante.`;

export type ChatStockLine = {
  brand: string;
  model: string;
  version: string | null;
  year: number;
  km: number;
  price: number;
  color: string | null;
  transmission: string;
  fuel: string;
};

export function formatStockForPrompt(vehicles: ChatStockLine[]) {
  if (vehicles.length === 0) {
    return "ESTOQUE ATUAL (dados reais do banco):\n(nenhum veículo disponível no momento)";
  }

  const lines = vehicles.map((vehicle) => {
    const version = vehicle.version?.trim() ? ` ${vehicle.version.trim()}` : "";
    const color = vehicle.color?.trim() ? vehicle.color.trim() : "cor não informada";
    return `- ${vehicle.brand} ${vehicle.model}${version} ${vehicle.year} · ${vehicle.km} km · R$ ${vehicle.price} · ${color} · ${vehicle.transmission} · ${vehicle.fuel}`;
  });

  return `ESTOQUE ATUAL (dados reais do banco — use SOMENTE estes veículos):\n${lines.join("\n")}`;
}

export function buildChatSystemPrompt(vehicles: ChatStockLine[]) {
  return `${CHAT_SYSTEM_PROMPT}\n\n${formatStockForPrompt(vehicles)}`;
}

export function stockSelectHasForbiddenField(
  select: Record<string, unknown>,
  field = "fipePrice",
) {
  return Object.prototype.hasOwnProperty.call(select, field);
}
