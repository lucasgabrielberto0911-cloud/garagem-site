import type { ChatVehicleRecord } from "./chat-stock";
import type { ChatResearch } from "./chat-research-data";

export const DUSTER_CATALOG_SOURCE = "https://ptdocz.com/doc/169501/d-cat%C3%A1logo-duster---renault-do-brasil";
export const DUSTER_VERSION_SOURCE = "https://autopapo.com.br/renault/duster-20-16v-tech-road-ii-aut-flex-2014/";
export const CIVIC_2015_CATALOG_SOURCE = "https://ptdocz.com/doc/46418/arquivo-em-pdf";
export const CIVIC_2020_CATALOG_SOURCE = "https://www.honda.com.br/automoveis/sites/hab/files/2019-10/%5BHONDA%5DCAMPANHA%20CIVIC%202020_FOLHETO%20COMPLETO_440x310mm_R21-WhatsApp.pdf";

const fold = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

/** Reviewed manufacturer catalogue, April 2014, ref. 7702265160.
 * Model data only; never writes or supplements the advertised unit's equipment.
 * New references must have an exact identity and a reviewed primary source.
 */
export function technicalReference(vehicle: ChatVehicleRecord, topic: string): ChatResearch | null {
  const civic = civicReference(vehicle, topic);
  if (civic) return civic;
  if (!["potência", "torque", "potência e torque", "ficha técnica"].includes(topic) ||
    fold(vehicle.brand) !== "renault" || fold(vehicle.model) !== "duster" || vehicle.yearModel !== 2014 ||
    !["dynamique 2 0 16v tech road 2", "2 0 16v tech road ii aut flex"].includes(fold(vehicle.version ?? "")) ||
    !/autom/i.test(vehicle.transmission) ||
    (vehicle.engine && !/\b2[.,]0\b/.test(vehicle.engine)) ||
    (vehicle.fuel && !/flex/i.test(vehicle.fuel))) return null;
  const sources = [
    { title: "Renault — catálogo brasileiro de abril/2014 (cópia arquivada)", href: DUSTER_CATALOG_SOURCE },
    { title: "AutoPapo — Duster Tech Road II 2.0 automática 2014", href: DUSTER_VERSION_SOURCE },
  ];
  return {
    paragraphs: [ ...(topic !== "torque" ? [{
      text: `Essa Duster 2.0 automática ${vehicle.yearModel} tem 142 cv com etanol e 138 cv com gasolina. São valores do catálogo da Renault.`,
      sources,
    }] : []), ...(topic !== "potência" ? [{
      text: `O torque de catálogo dessa Duster 2.0 2014 é de 20,9 kgfm com etanol e 19,7 kgfm com gasolina, a 3.750 rpm.`,
      sources,
    }] : []) ],
  };
}

/** Manufacturer catalogues, reviewed against the exact Brazilian trim/year.
 * No inference to other model years, transmissions, engines or equipment.
 */
function civicReference(vehicle: ChatVehicleRecord, topic: string): ChatResearch | null {
  if (!["potência", "torque", "potência e torque", "ficha técnica"].includes(topic) ||
    fold(vehicle.brand) !== "honda" || fold(vehicle.model) !== "civic" ||
    !/autom|cvt/i.test(vehicle.transmission) ||
    (vehicle.engine && !/\b2[.,]0\b/.test(vehicle.engine)) ||
    (vehicle.fuel && !/flex/i.test(vehicle.fuel))) return null;
  const version = fold(vehicle.version ?? "");
  const lxr = vehicle.yearModel === 2015 && ["lxr 2 0 flexone", "lxr 2 0 16v flexone"].includes(version);
  const exl = vehicle.yearModel === 2020 && ["exl 2 0 flex 16v", "exl 2 0 flexone", "exl 2 0 16v flexone"].includes(version);
  if (!lxr && !exl) return null;
  const label = `Civic ${lxr ? "LXR" : "EXL"} 2.0 automático ${vehicle.yearModel}`;
  const sources = [{title: lxr ? "Honda — catálogo Civic 2015 (cópia arquivada)" : "Honda — catálogo oficial Civic 2020, especificações da EXL", href: lxr ? CIVIC_2015_CATALOG_SOURCE : CIVIC_2020_CATALOG_SOURCE}];
  return {paragraphs: [
    ...(topic !== "torque" ? [{text: `O ${label} tem potência de 155 cv com etanol e 150 cv com gasolina, a 6.300 rpm, segundo o catálogo da Honda.`, sources}] : []),
    ...(topic !== "potência" ? [{text: `O torque de catálogo do ${label} é de 19,5 kgfm com etanol e 19,3 kgfm com gasolina.`, sources}] : []),
  ]};
}
