import { site } from "@/lib/site";

/**
 * Cidade-foco da busca local: home, /estoque e fichas usam esta região.
 * É o ponto único para trocar a região quando a loja abrir ponto em outra
 * cidade (Vitória, previsto). Não é endereço: a loja é digital (ver
 * `site.address`), e a cidade de cada veículo só aparece no admin (PR #219).
 */
export const SEO_LOCAL_CITY = "Linhares";

/** "Linhares/ES", no formato dos títulos de busca. */
export const SEO_LOCAL_LOCATION = `${SEO_LOCAL_CITY}/${site.stateCode}`;

/** Título da home. O foco é quem compra em Linhares; a região atendida fica na description. */
export const HOME_SEO_TITLE = `${site.name} | Seminovos em ${SEO_LOCAL_LOCATION} com procedência`;

/** Título do /estoque. Sem sufixo extra: o template do root layout é "%s". */
export const ESTOQUE_SEO_TITLE = `Carros e motos seminovos em ${SEO_LOCAL_LOCATION} | ${site.name}`;
