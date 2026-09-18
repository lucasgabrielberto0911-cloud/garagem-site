import assert from "node:assert/strict";
import { test } from "node:test";
import {
  PHONES,
  WHATSAPP_BRAND,
  WHATSAPP_MESSAGES,
  applyWhatsAppUtm,
  fichaWhatsAppTracking,
  formatCustomerVehicleWhatsAppText,
  isVehicleFichaPath,
  pageWhatsAppTracking,
  site,
  whatsappCampaignFromLabel,
  whatsappCampaignFromPath,
  whatsappContentFromVehicle,
  whatsappUrl,
} from "./site";

test("WhatsApp oficial continua no número da loja", () => {
  assert.equal(site.whatsappNumber, "5527996330706");
  assert.equal(PHONES[0].digits, "5527996330706");
  assert.match(whatsappUrl(), /^https:\/\/wa\.me\/5527996330706\?text=/);
});

test("CTA genérico do topo e da home no tom natural", () => {
  assert.equal(
    WHATSAPP_MESSAGES.general,
    "Oi! Vi o site da Garagem e gostaria de mais informações.",
  );
  assert.equal(
    WHATSAPP_MESSAGES.help,
    "Oi! Vi o site da Garagem e quero ajuda pra escolher um seminovo.",
  );
  assert.equal(
    WHATSAPP_MESSAGES.finance,
    "Oi! Vi o site da Garagem e quero simular as parcelas.",
  );
  assert.equal(WHATSAPP_BRAND, "Garagem");
  assert.doesNotMatch(WHATSAPP_MESSAGES.general, /Sua Garagem/);
  assert.doesNotMatch(WHATSAPP_MESSAGES.help, /Sua Garagem/);
});

test("helpers de veículo sem preço caem no fallback sem “por R$”", () => {
  assert.equal(
    WHATSAPP_MESSAGES.vehicle("Hyundai HB20 2022"),
    "Oi! Vi o Hyundai HB20 2022 no site da Garagem e quero saber mais.",
  );
  assert.equal(
    WHATSAPP_MESSAGES.vehicleFinance("Hyundai HB20 2022"),
    "Oi! Vi o Hyundai HB20 2022 no site da Garagem e quero simular as parcelas.",
  );
  assert.equal(
    WHATSAPP_MESSAGES.vehicleTrade("Honda BIZ 125 EX 2023", true),
    "Oi! Vi a Honda BIZ 125 EX 2023 no site da Garagem e quero avaliar uma troca.",
  );
  assert.equal(
    WHATSAPP_MESSAGES.vehicleVideo("Honda BIZ 125 EX 2023", true),
    "Oi! Vi a Honda BIZ 125 EX 2023 no site da Garagem e queria um vídeo dela.",
  );
  assert.equal(
    WHATSAPP_MESSAGES.sameBand("Fiat Pulse 2022"),
    "Oi! Vi o Fiat Pulse 2022 no site da Garagem e queria ver outros na mesma faixa.",
  );
  assert.equal(
    formatCustomerVehicleWhatsAppText({
      intent: "interest",
      label: "",
      priceLabel: "R$ 64.900",
    }),
    "Oi! Vi o site da Garagem e gostaria de mais informações.",
  );
  assert.doesNotMatch(
    formatCustomerVehicleWhatsAppText({
      intent: "interest",
      label: "Hyundai HB20 2022",
      priceLabel: "   ",
    }),
    /por R\$/,
  );
});

test("wa.me dos CTAs leva UTM de origem sem alterar o pré-preenchido", () => {
  const href = whatsappUrl(WHATSAPP_MESSAGES.help, {
    campaign: "ficha",
    content: "fiat-pulse-2022-abc",
  });
  assert.match(href, /utm_source=site/);
  assert.match(href, /utm_medium=whatsapp/);
  assert.match(href, /utm_campaign=ficha/);
  assert.match(href, /utm_content=fiat-pulse-2022-abc/);
  assert.match(
    decodeURIComponent(href),
    /Oi! Vi o site da Garagem e quero ajuda pra escolher um seminovo\./,
  );
  const generic = whatsappUrl();
  assert.match(generic, /utm_campaign=home/);
  assert.equal(whatsappCampaignFromPath("/estoque/fiat-pulse-2022-x"), "ficha");
  assert.equal(whatsappCampaignFromPath("/estoque"), "estoque");
  assert.equal(whatsappCampaignFromPath("/"), "home");
  assert.equal(whatsappCampaignFromLabel("ficha-mobile"), "ficha");
  assert.equal(whatsappCampaignFromLabel("chat-card"), "chat");
  assert.equal(whatsappCampaignFromLabel("estoque-bar-whatsapp"), "estoque");
  assert.equal(
    whatsappContentFromVehicle({
      id: "cuid123",
      path: "/estoque/fiat-pulse-2022-abc",
    }),
    "fiat-pulse-2022-abc",
  );
  const already = applyWhatsAppUtm(href, { campaign: "chat" });
  assert.equal(already, href);
});

test("ficha path e tracking centralizam campanha ficha + utm_content", () => {
  assert.equal(isVehicleFichaPath("/estoque/honda-civic-exl-2020-abc"), true);
  assert.equal(isVehicleFichaPath("/estoque/honda-civic-exl-2020-abc/"), true);
  assert.equal(isVehicleFichaPath("/estoque"), false);
  assert.equal(isVehicleFichaPath("/estoque/"), false);
  assert.equal(isVehicleFichaPath("/"), false);

  const fromVehicle = fichaWhatsAppTracking({
    id: "cuid123",
    path: "/estoque/honda-civic-exl-2020-abc",
  });
  assert.equal(fromVehicle.campaign, "ficha");
  assert.equal(fromVehicle.content, "honda-civic-exl-2020-abc");

  const href = whatsappUrl(WHATSAPP_MESSAGES.vehicle("Honda Civic EXL 2020"), fromVehicle);
  assert.match(href, /utm_campaign=ficha/);
  assert.match(href, /utm_content=honda-civic-exl-2020-abc/);
  assert.match(decodeURIComponent(href), /Honda Civic EXL 2020/);

  const finance = whatsappUrl(WHATSAPP_MESSAGES.vehicleFinance("Honda Civic EXL 2020"), fromVehicle);
  assert.match(finance, /utm_campaign=ficha/);
  assert.match(finance, /utm_content=honda-civic-exl-2020-abc/);
  assert.match(decodeURIComponent(finance), /simular as parcelas/);
});

test("header/float na ficha herdam ficha+slug mesmo sem contexto hidratado", () => {
  const fromPath = pageWhatsAppTracking({
    pathname: "/estoque/honda-civic-exl-2020-abc?ref=ad",
  });
  assert.equal(fromPath.campaign, "ficha");
  assert.equal(fromPath.content, "honda-civic-exl-2020-abc");

  const fromVehicle = pageWhatsAppTracking({
    pathname: "/estoque/honda-civic-exl-2020-abc",
    vehicle: { id: "cuidCivic", path: "/estoque/honda-civic-exl-2020-abc" },
  });
  assert.equal(fromVehicle.campaign, "ficha");
  assert.equal(fromVehicle.content, "honda-civic-exl-2020-abc");

  const home = pageWhatsAppTracking({ pathname: "/" });
  assert.equal(home.campaign, "home");
  assert.equal(home.content, undefined);

  const estoque = pageWhatsAppTracking({ pathname: "/estoque" });
  assert.equal(estoque.campaign, "estoque");

  const leakedOnHome = pageWhatsAppTracking({
    pathname: "/",
    vehicle: { id: "cuidCivic", path: "/estoque/honda-civic-exl-2020-abc" },
  });
  assert.equal(leakedOnHome.campaign, "home");
  assert.equal(leakedOnHome.content, undefined);

  const footerGeneric = whatsappUrl();
  assert.match(footerGeneric, /utm_campaign=home/);
  assert.doesNotMatch(footerGeneric, /utm_content=/);
});
