import { site } from "@/lib/site";

/**
 * Cidade-foco da busca local: /estoque e fichas usam esta região.
 * É o ponto único para trocar a região quando a loja abrir ponto em outra
 * cidade (Vitória, previsto). Não é endereço: a loja é digital (ver
 * `site.address`), e a cidade de cada veículo só aparece no admin (PR #219).
 */
export const SEO_LOCAL_CITY = "Linhares";

/** "Linhares/ES", no formato dos títulos de busca. */
export const SEO_LOCAL_LOCATION = `${SEO_LOCAL_CITY}/${site.stateCode}`;

/** Título da home para a busca regional no norte do Espírito Santo. */
export const HOME_SEO_TITLE = `${site.name} | Seminovos com procedência no norte do ES`;

/** Título do /estoque. Sem sufixo extra: o template do root layout é "%s". */
export const ESTOQUE_SEO_TITLE = `Carros e motos seminovos em ${SEO_LOCAL_LOCATION} | ${site.name}`;

/** Descrição regional da home e dos metadados gerais de compartilhamento. */
export const HOME_SEO_DESCRIPTION = "Seminovos com procedência para todo o norte do ES: Linhares, Colatina, São Mateus, Aracruz e Sooretama. Troca e financiamento na Garagem.";
