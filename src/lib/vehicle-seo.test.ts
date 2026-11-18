import assert from "node:assert/strict";
import { test } from "node:test";
import { vehiclePhotoAlt, vehicleSeoDescription } from "./format";
import {
  VEHICLE_SEO_TITLE_MAX,
  buildVehicleFichaMetadata,
  vehicleOpenGraphImage,
  vehicleSeoTitle,
} from "./vehicle-seo";

const civic = {
  brand: "Honda",
  model: "Civic",
  version: "LXR",
  yearModel: 2015,
  year: 2015,
  price: 74900,
  km: 106000,
  transmission: "Automático",
};

test("título e descrição incluem marca, modelo, versão, ano, preço e Linhares/ES", () => {
  for (const text of [vehicleSeoTitle(civic), vehicleSeoDescription(civic)]) {
    assert.match(text, /Honda Civic LXR 2015/);
    assert.match(text, /R\$\s*74\.900/);
    assert.match(text, /Linhares\/ES/);
    assert.match(text, /Garagem/);
  }
  assert.match(vehicleSeoDescription(civic), /seminovo/);
  assert.ok(vehicleSeoTitle(civic).length <= VEHICLE_SEO_TITLE_MAX);
  assert.ok(vehicleSeoDescription(civic).length <= 160);
});

test("versão, ano e preço diferenciam os metadados de cada anúncio", () => {
  for (const variant of [{ version: "EXR" }, { year: 2016, yearModel: 2016 }, { price: 79900 }]) {
    assert.notEqual(vehicleSeoTitle(civic), vehicleSeoTitle({ ...civic, ...variant }));
    assert.notEqual(vehicleSeoDescription(civic), vehicleSeoDescription({ ...civic, ...variant }));
  }
});

test("versão longa corta palavras antes do sufixo para caber no limite de 60 caracteres sem perder a marca", () => {
  const input = {
    ...civic,
    brand: "Volkswagen",
    model: "Gol",
    version: "1.6 MSI Highline Total Flex Automatizado Plus",
    yearModel: 2020,
    price: 54900,
  };
  const title = vehicleSeoTitle(input);
  assert.ok(title.length <= VEHICLE_SEO_TITLE_MAX, `título excedeu ${VEHICLE_SEO_TITLE_MAX}: ${title} (${title.length})`);
  assert.match(title, /Garagem$/);
  assert.doesNotMatch(title, /Plus/);
});

test("versão longa em vendido respeita o teto de 60 caracteres e mantém (vendido)", () => {
  const input = {
    ...civic,
    brand: "Volkswagen",
    model: "Gol",
    version: "1.6 MSI Highline Total Flex Automatizado Plus",
    yearModel: 2020,
    sold: true,
  };
  const title = vehicleSeoTitle(input);
  assert.ok(title.length <= VEHICLE_SEO_TITLE_MAX, `título excedeu ${VEHICLE_SEO_TITLE_MAX}: ${title} (${title.length})`);
  assert.match(title, /\(vendido\)/);
  assert.match(title, /Garagem$/);
  assert.doesNotMatch(title, /Plus|R\$/);
});

test("sem versão ou preço publicável não há espaços duplicados nem preço fictício", () => {
  for (const price of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    const input = { ...civic, version: null, price };
    for (const text of [vehicleSeoTitle(input), vehicleSeoDescription(input)]) {
      assert.match(text, /Honda Civic 2015/);
      assert.doesNotMatch(text, /  |R\$|NaN|Infinity/);
    }
  }
});

test("vendido preserva identificação e busca regional, sem divulgar preço antigo", () => {
  const sold = { ...civic, sold: true };
  for (const text of [vehicleSeoTitle(sold), vehicleSeoDescription(sold)]) {
    assert.match(text, /Honda Civic LXR 2015 \(vendido\)/);
    assert.match(text, /Linhares\/ES/);
    assert.doesNotMatch(text, /R\$|74[.,]?900/);
  }
  assert.match(vehicleSeoDescription(sold), /seminovo/);
  assert.ok(vehicleSeoTitle(sold).length <= VEHICLE_SEO_TITLE_MAX);
  assert.match(vehicleSeoDescription(sold), /similares disponíveis/);
});

test("alt identifica o veículo e a posição real da foto sem inventar ângulo", () => {
  assert.equal(vehiclePhotoAlt("Honda Civic LXR 2015 · Prata", 0, 3), "Honda Civic LXR 2015 · Prata - foto 1 de 3");
});

test("vehicleOpenGraphImage declara dimensões 1200x800 e tipo image/webp", () => {
  const og = vehicleOpenGraphImage({ url: "https://exemplo.net/foto.webp", alt: "Civic 2015" });
  assert.equal(og.width, 1200);
  assert.equal(og.height, 800);
  assert.equal(og.type, "image/webp");
  assert.equal(og.alt, "Civic 2015");
  assert.equal(og.url, "https://exemplo.net/foto.webp");
});

test("descrição SEO separa o ano com ponto médio quando a versão termina em número solto", () => {
  assert.match(vehicleSeoDescription({ ...civic, version: "Sport Pack 3" }), /Sport Pack 3 · 2015/);
  assert.match(vehicleSeoDescription({ ...civic, version: "Tech Road 2" }), /Tech Road 2 · 2015/);
  assert.doesNotMatch(vehicleSeoDescription(civic), /LXR · 2015/);
});

test("descrição SEO inclui km, câmbio limpo e Combinamos o atendimento pelo WhatsApp até em versões longas", () => {
  const civicDesc = vehicleSeoDescription({ ...civic, transmission: "Automático 5 marchas 155cv" });
  assert.match(civicDesc, /106\.000 km/);
  assert.match(civicDesc, /Automático/);
  assert.match(civicDesc, /Combinamos o atendimento pelo WhatsApp\./);
  assert.doesNotMatch(civicDesc, /marchas|155cv|loja digital|loja física|pontos de venda|hora marcada/i);
  assert.ok(civicDesc.length <= 160, civicDesc);

  const dusterDesc = vehicleSeoDescription({
    brand: "Renault",
    model: "Duster",
    version: "Dynamique 2.0 Tech Road 2",
    year: 2014,
    price: 54900,
    km: 101000,
    transmission: "Automático",
  });
  assert.match(dusterDesc, /Renault Duster Dynamique 2\.0 Tech Road 2 · 2014/);
  assert.match(dusterDesc, /101\.000 km/);
  assert.match(dusterDesc, /Automático/);
  assert.match(dusterDesc, /Combinamos o atendimento pelo WhatsApp\./);
  assert.ok(dusterDesc.length <= 160, `${dusterDesc} (${dusterDesc.length})`);
});

test("buildVehicleFichaMetadata define canonical, og:image e twitter:image HTTPS absolutos com dimensões e fallback 1200x630", () => {
  const sample = {
    id: "cmtestficha00000000000001",
    brand: "Honda",
    model: "Civic",
    version: "LXR 2.0",
    yearModel: 2015,
    price: 74900,
    km: 106000,
    transmission: "Automático",
    color: "Prata",
    status: "disponivel",
    photos: [{ url: "http://cdn.example/civic-capa.jpg" }],
  };

  const meta = buildVehicleFichaMetadata(sample);
  assert.match(String(meta.title), /Honda Civic LXR 2015 por R\$\s*74\.900/);
  assert.match(String(meta.description), /106\.000 km/);
  assert.match(String(meta.description), /Combinamos o atendimento pelo WhatsApp\./);
  assert.ok(String(meta.alternates?.canonical).startsWith("/estoque/honda-civic-"));
  assert.equal(meta.robots, undefined);

  const ogImages = meta.openGraph?.images as Array<{
    url: string;
    width: number;
    height: number;
    type: string;
    alt: string;
  }>;
  assert.equal(ogImages.length, 1);
  assert.equal(ogImages[0].url, "https://cdn.example/civic-capa.jpg");
  assert.equal(ogImages[0].width, 1200);
  assert.equal(ogImages[0].height, 800);
  assert.equal(ogImages[0].type, "image/jpeg");

  const twitterImages = meta.twitter?.images as Array<{ url: string; alt: string }>;
  assert.equal(twitterImages[0].url, "https://cdn.example/civic-capa.jpg");

  const withoutPhotos = buildVehicleFichaMetadata({ ...sample, photos: [] });
  const fallbackImages = withoutPhotos.openGraph?.images as Array<{
    url: string;
    width: number;
    height: number;
    type: string;
  }>;
  assert.equal(fallbackImages[0].url, "https://www.suagaragem.net/og.png");
  assert.equal(fallbackImages[0].width, 1200);
  assert.equal(fallbackImages[0].height, 630);
  assert.equal(fallbackImages[0].type, "image/png");

  const soldMeta = buildVehicleFichaMetadata({ ...sample, status: "vendido" });
  assert.deepEqual(soldMeta.robots, { index: false, follow: true });
  assert.doesNotMatch(String(soldMeta.title), /R\$|74\.900/);
  assert.doesNotMatch(String(soldMeta.description), /R\$|74\.900/);
});
