import { writeFile, appendFile } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { auditPhotos, parseAuditVehicle, probePhotoHead, type AuditVehicle, type PhotoHead } from "../src/lib/photo-audit";
import { vehicleSlug } from "../src/lib/vehicle-slug";

const site = "https://www.suagaragem.net";
const reportIndex = process.argv.indexOf("--relatorio");
const report = reportIndex < 0 ? resolve(homedir(), "RELATORIO-FOTOS.md") : resolve(process.argv[reportIndex + 1]);
const failures: string[] = [];
const deadline = Date.now() + 10 * 60_000;

async function readPublic(path: string) {
  if (Date.now() > deadline) throw new Error("Tempo máximo de coleta atingido; relatório parcial");
  const url = new URL(path, site);
  if (url.origin !== site || !/^\/(?:sitemap\.xml|api\/estoque|estoque\/[^/]+)$/.test(url.pathname)) throw new Error("Página pública fora do escopo");
  const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(20_000) });
  if (response.status !== 200) throw new Error(`${url}: HTTP ${response.status}`);
  return response.text();
}

async function main() {
  const vehicles: AuditVehicle[] = [];
  const heads = new Map<string, PhotoHead>();
  const cards = new Map<string, { cover?: string }>();
  const pages = new Set<string>();
  try {
    const xml = await readPublic("/sitemap.xml");
    for (const match of xml.matchAll(/<loc>([^<]+\/estoque\/[^<]+)<\/loc>/g)) pages.add(match[1]);
  } catch (error) { failures.push(`Sitemap: ${String(error)}`); }
  // As categorias explícitas mantêm cobertura mesmo se o padrão esconder motos.
  for (const category of ["carro", "moto"]) {
    try {
      for (let page = 1; ; page++) {
        if (page > 100) throw new Error("Paginação excedeu o limite de segurança (100 páginas)");
        const data = JSON.parse(await readPublic(`/api/estoque?category=${category}&pageSize=48&page=${page}`));
        if (data.error || !Array.isArray(data.vehicles) || typeof data.hasMore !== "boolean") throw new Error("API retornou estoque inválido");
        for (const card of data.vehicles) {
          const page = `${site}/estoque/${vehicleSlug(card)}`;
          cards.set(card.id, { cover: card.photos?.[0]?.thumbnailUrl || card.photos?.[0]?.url });
          pages.add(page);
        }
        if (!data.hasMore) break;
      }
    } catch (error) { failures.push(`Listagem ${category}: ${String(error)}`); }
  }
  const seen = new Set<string>();
  for (const page of pages) {
    try {
      const vehicle = parseAuditVehicle(await readPublic(page), page);
      if (seen.has(vehicle.id)) continue;
      seen.add(vehicle.id);
      const card = cards.get(vehicle.id);
      vehicle.cover = card?.cover;
      if (!card) failures.push(`Ficha do sitemap ausente na API do estoque: ${page}`);
      vehicles.push(vehicle);
    } catch (error) { failures.push(`Ficha ${page}: ${String(error)}`); }
  }
  if (!vehicles.length) failures.push("Nenhum veículo pôde ser verificado; não interpretar como estoque sem problemas.");
  photos: for (const vehicle of vehicles) {
    for (const photo of new Set([...vehicle.photos, ...(vehicle.cover ? [vehicle.cover] : [])])) {
      if (Date.now() > deadline) { failures.push("Tempo máximo de coleta atingido; fotos restantes não verificadas."); break photos; }
      let url: URL;
      try { url = new URL(photo, site); } catch { continue; }
      if (heads.has(url.href)) continue;
      heads.set(url.href, await probePhotoHead(url.href, site));
    }
  }
  const issues = auditPhotos(vehicles, heads);
  const lines = ["# Relatório de fotos — Garagem", "", `Gerado em ${new Date().toISOString()}. Fonte: ${site}.`, "",
    `${vehicles.length} veículos; ${heads.size} URLs únicas verificadas por HEAD; ${[...issues.values()].reduce((n, list) => n + list.length, 0)} alertas; ${failures.length} falhas de cobertura.`, "",
    `${[...heads.values()].filter(head => head.width && head.height).length}/${heads.size} URLs com dimensões informadas pelo servidor; as demais exigem verificação em cópia local.`, "",
    "## Limites da verificação", "",
    "Cobertura limitada aos anúncios descobertos no sitemap e na API pública (sem descobrir vendidos/reservados fora desses índices). Somente leitura: GET de sitemap, API e HTML; fotos consultadas exclusivamente com HEAD, sem downloads nem acesso ao banco. Redirecionamentos de fotos são reportados, sem seguir para outro host.", "",
    "Resolução real e conteúdo visual são INCONCLUSIVOS quando o servidor não informa dimensões. Content-Length menor que 10 KB é só indício de arquivo pequeno, não prova de baixa resolução. Dimensões do HTML descrevem o layout, não a imagem original. Duplicidade compara URLs/caminhos, sem detectar cópias renomeadas. Identificação de outro veículo usa pasta de estoque ou ID conhecido no caminho, sem reconhecimento visual. Capa é a primeira foto por contrato; compara-se capa do card com a primeira do JSON-LD, sem inferir a melhor foto visualmente.", "",
    "## Falhas de cobertura", "", ...(failures.length ? failures.map(s => `- ${s}`) : ["Nenhuma."]), "",
    "## Veículos", ""];
  for (const vehicle of vehicles) {
    lines.push(`### ${vehicle.name} — ${vehicle.id}`, "", vehicle.page, "", `${vehicle.photos.length} fotos na galeria.`, "",
      ...(issues.get(vehicle.id)?.length ? issues.get(vehicle.id)!.map(s => `- ${s}`) : ["- Sem alertas nos metadados/HTTP. Resolução e conteúdo visual não certificados."]), "");
  }
  await writeFile(report, lines.join("\n"));
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, lines.join("\n"));
  console.log(`Relatório salvo em ${report}: ${vehicles.length} veículos, ${failures.length} falhas de cobertura.`);
  // Alertas de fotos só reportam; falhas de coleta sinalizam execução incompleta.
  if (failures.length) process.exitCode = 1;
}

main().catch(async error => {
  await writeFile(report, `# Relatório de fotos — Garagem\n\nVerificação incompleta: ${String(error)}\n`);
  console.error("Não foi possível concluir a verificação.");
  process.exitCode = 1;
});
