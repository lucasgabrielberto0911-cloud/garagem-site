import { site } from "./site";
import { SEO_LOCAL_CITY } from "./seo-local";

/** Identificação copiada na emissão; reimpressões usam o snapshot. */
export const PDF_STORE = {
  legalName: site.legalName,
  cnpj: site.cnpj,
  address: "",
  registeredAddress: "Avenida Castro Alves, 48, Loja 2, Interlagos, Linhares - ES, CEP 29.903-168",
  city: SEO_LOCAL_CITY,
  stateCode: site.stateCode,
  whatsappLabel: site.whatsappLabel,
  email: site.email,
};
export const commercialStoreSnapshot = (): CommercialStore => ({ version: 1 as const, ...PDF_STORE });
export type CommercialStore = { version: 1 } & { [K in keyof typeof PDF_STORE]: string };

/** Identificação conhecida dos documentos sem snapshot, anterior a novembro/2026. Não atualizar com a loja. */
export const LEGACY_COMMERCIAL_STORE: CommercialStore = {
  version: 1, legalName: "Garagem Motorcycle Ltda", cnpj: "47.740.076/0001-17", address: "",
  registeredAddress: "Avenida Castro Alves, 48, Loja 2, Interlagos, Linhares - ES, CEP 29.903-168",
  city: "Linhares", stateCode: "ES", whatsappLabel: "(27) 99633-0706", email: "suagaragem2@gmail.com",
};
