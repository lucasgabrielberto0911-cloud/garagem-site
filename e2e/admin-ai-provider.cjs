// Carregado apenas pelo servidor Playwright: nenhum modo de teste entra na aplicação.
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = String(input instanceof Request ? input.url : input);
  if (!url.startsWith("https://integrate.api.nvidia.com/")) return originalFetch(input, init);
  if (new Headers(init?.headers).get("authorization") !== "Bearer e2e-admin-ia-sem-valor") throw new Error("Chave real proibida no E2E de IA.");
  const body = JSON.parse(init.body);
  const payload = JSON.parse(body.messages[1].content);
  let result;
  if (payload.blocks) {
    result = { blocks: [...payload.blocks].reverse().map(block => ({ id: block.id, text: block.choices[block.choices.length - 1] })) };
    if (payload.blocks.some(block => block.choices.some(text => text.includes("Teste de equipamento inventado")))) result.blocks[0].text += "\nTeto solar. Ano: 2024.";
  }
  else if (typeof payload.text === "string") {
    const start = payload.text.indexOf("Otmo");
    result = { suggestions: start < 0 ? [] : [{ start, end: start + 4, original: "Otmo", replacement: "Ótimo", category: "ortografia", reason: "Correção de grafia." }] };
  } else result = { answer: "Abra Veículos, escolha Novo veículo e confira os dados e a legenda antes de salvar. A ajuda não executa ações." };
  return Response.json({ choices: [{ message: { content: JSON.stringify(result) } }] });
};
