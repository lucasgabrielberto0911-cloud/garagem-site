import type { ChatVehicleRecord } from "./chat-stock";
import type { ChatResearch } from "./chat-research-data";

export const DUSTER_CATALOG_SOURCE = "https://ptdocz.com/doc/169501/d-cat%C3%A1logo-duster---renault-do-brasil";
export const DUSTER_VERSION_SOURCE = "https://autopapo.com.br/renault/duster-20-16v-tech-road-ii-aut-flex-2014/";

const fold = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

/** Reviewed manufacturer catalogue, April 2014, ref. 7702265160.
 * Model data only; never writes or supplements the advertised unit's equipment.
 * New references must have an exact identity and a reviewed primary source.
 */
export function technicalReference(vehicle: ChatVehicleRecord, topic: string): ChatResearch | null {
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
