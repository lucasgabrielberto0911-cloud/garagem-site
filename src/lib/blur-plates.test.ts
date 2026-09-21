import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import sharp from "sharp";
import {
  applyBlurRegions,
  dealerBoxesFromImage,
  dealerPlateBoxesFromText,
  disambiguateCarPlates,
  expandToGrayPlateBox,
  extractPlateCandidate,
  findBlackDealerPlateBoxes,
  findGrayPlateBoxes,
  findGrayPlatesInImage,
  findMercosulPlatesInImage,
  findMercosulStripeBoxes,
  isHeadlightOrCornerZone,
  isUnlikelyPlateGeometry,
  looksLikeAnalogGaugeAround,
  looksLikeBodyPanelFalsePositive,
  looksLikeConfirmedDealerPlate,
  looksLikeGrayPlatePatch,
  looksLikeMercosulPlatePatch,
  plateBoxesFromText,
  textLooksLikeDealerPlate,
  textLooksLikePlate,
  textsLookLikeDashboard,
} from "./blur-plates";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

test("reconhece placa antiga, Mercosul e faixa BRASIL", () => {
  assert.equal(textLooksLikePlate("ABC1234"), true);
  assert.equal(textLooksLikePlate("ABC1D23"), true);
  assert.equal(textLooksLikePlate("BR ABC1D23"), true);
  assert.equal(textLooksLikePlate("BRASIL ABC1D23"), true);
  assert.equal(extractPlateCandidate("BRASILABC1D23"), "ABC1D23");
  assert.equal(extractPlateCandidate("ESABC1D23"), "ABC1D23");
  assert.equal(textLooksLikePlate("ABS1234"), false);
  assert.equal(textLooksLikePlate("ABS 1234 km/h"), false);
  assert.equal(textLooksLikePlate("ECO1234"), false);
});

test("placa com troca típica de OCR ainda conta", () => {
  assert.equal(textLooksLikePlate("AB01D23"), true);
  assert.equal(textLooksLikePlate("A2C1D23"), false);
});

test("emblema da marca na frente não é painel", () => {
  assert.equal(textsLookLikeDashboard(["HONDA"]), false);
  assert.equal(textsLookLikeDashboard(["HONDA", "HR-V"]), false);
  assert.equal(textsLookLikeDashboard(["ABS", "KMH"]), true);
  assert.equal(textsLookLikeDashboard(["ODO", "12", "34", "56"]), true);
  assert.equal(textsLookLikeDashboard(["PGM-FI", "80", "100", "120"]), true);
  assert.equal(textLooksLikePlate("PGM1234"), false);
});

test("texto de placa com confiança de frente (~59%) vira caixa", () => {
  const boxes = plateBoxesFromText(
    [
      {
        text: "ABC1D23",
        type: "WORD",
        confidence: 59,
        box: { left: 200, top: 540, width: 65, height: 41 },
      },
    ],
    1280,
    960,
  );
  assert.equal(boxes.length, 1);
  assert.ok(boxes[0].width >= 65);
  assert.ok(boxes[0].height >= 41);
});

test("palavra solta com confiança baixa e sem formato de placa some", () => {
  const boxes = plateBoxesFromText(
    [
      {
        text: "HR-V",
        type: "WORD",
        confidence: 59,
        box: { left: 200, top: 540, width: 65, height: 20 },
      },
    ],
    1280,
    960,
  );
  assert.equal(boxes.length, 0);
});

test("linha BRASIL + placa vira uma caixa só", () => {
  const boxes = plateBoxesFromText(
    [
      {
        text: "BRASIL ABC1D23",
        type: "LINE",
        confidence: 64,
        box: { left: 190, top: 530, width: 80, height: 48 },
      },
    ],
    1280,
    960,
  );
  assert.equal(boxes.length, 1);
});

test("faixa azul Mercosul no para-choque vira caixa de placa", async () => {
  const width = 320;
  const height = 200;
  const plate = { left: 40, top: 120, width: 72, height: 28 };
  const image = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 40, g: 40, b: 40 },
    },
  })
    .composite([
      {
        input: await sharp({
          create: {
            width: plate.width,
            height: 8,
            channels: 3,
            background: { r: 30, g: 55, b: 140 },
          },
        })
          .png()
          .toBuffer(),
        left: plate.left,
        top: plate.top,
      },
      {
        input: await sharp({
          create: {
            width: plate.width,
            height: 20,
            channels: 3,
            background: { r: 190, g: 190, b: 185 },
          },
        })
          .png()
          .toBuffer(),
        left: plate.left,
        top: plate.top + 8,
      },
    ])
    .jpeg()
    .toBuffer();

  const boxes = await findMercosulStripeBoxes(image, {
    left: 0,
    top: 80,
    width,
    height: 120,
  });
  assert.ok(boxes.length >= 1, "esperava achar a faixa Mercosul");
  const hit = boxes[0];
  assert.ok(hit.left < plate.left + 12);
  assert.ok(hit.top < plate.top + 12);
  assert.ok(hit.width >= 40);
  assert.ok(hit.height >= 10);
});

test("isHeadlightOrCornerZone rejeita faróis, milhas e capô, mas aceita placa central", () => {
  const imgWidth = 400;
  const imgHeight = 266;
  const car = { left: 0, top: 0, width: 400, height: 266 };

  // Placa central no para-choque
  const realPlate = { left: 135, top: 128, width: 123, height: 36 };
  assert.equal(isHeadlightOrCornerZone(realPlate, car, imgWidth, imgHeight), false);

  // Farol esquerdo (canto superior esquerdo)
  const leftHeadlight = { left: 25, top: 70, width: 70, height: 40 };
  assert.equal(isHeadlightOrCornerZone(leftHeadlight, car, imgWidth, imgHeight), true);

  // Farol direito (canto superior direito)
  const rightHeadlight = { left: 320, top: 75, width: 60, height: 45 };
  assert.equal(isHeadlightOrCornerZone(rightHeadlight, car, imgWidth, imgHeight), true);

  // Farol de milha no canto lateral inferior
  const fogLight = { left: 340, top: 180, width: 40, height: 30 };
  assert.equal(isHeadlightOrCornerZone(fogLight, car, imgWidth, imgHeight), true);

  // Grade superior / logotipo no capô
  const hoodLogo = { left: 180, top: 40, width: 40, height: 30 };
  assert.equal(isHeadlightOrCornerZone(hoodLogo, car, imgWidth, imgHeight), true);
});

test("disambiguateCarPlates elimina faróis e escolhe a placa centralizada", () => {
  const imgWidth = 800;
  const imgHeight = 600;
  const car = { left: 50, top: 80, width: 700, height: 480 };

  // Caso 1: Apenas 1 candidato que é na verdade um farol -> deve ser descartado
  const headlightOnly = [{ left: 80, top: 150, width: 100, height: 40 }];
  const filteredHeadlight = disambiguateCarPlates(headlightOnly, [car], imgWidth, imgHeight);
  assert.equal(filteredHeadlight.length, 0);

  // Caso 2: Placa real + falso positivo no farol + falso positivo na milha
  const mixedCandidates = [
    { left: 80, top: 150, width: 100, height: 40 }, // farol esquerdo
    { left: 320, top: 350, width: 160, height: 50 }, // placa real central
    { left: 680, top: 420, width: 60, height: 35 },  // milha direita
  ];
  const disambiguated = disambiguateCarPlates(mixedCandidates, [car], imgWidth, imgHeight);
  assert.equal(disambiguated.length, 1);
  assert.equal(disambiguated[0].left, 320);

  // Caso 3: Dois candidatos no para-choque -> escolhe o mais próximo do centro do carro
  const carCenter = car.left + car.width / 2; // 400
  const centerCandidate = { left: 340, top: 360, width: 120, height: 40 }; // centro = 400
  const offCenterCandidate = { left: 220, top: 360, width: 120, height: 40 }; // centro = 280
  const chosen = disambiguateCarPlates(
    [offCenterCandidate, centerCandidate],
    [car],
    imgWidth,
    imgHeight,
  );
  assert.equal(chosen.length, 1);
  assert.equal(chosen[0].left, 340);
});

test("findMercosulStripeBoxes rejeita reflexo escuro de grade e corpo sem luma", async () => {
  const width = 320;
  const height = 200;

  // Imagem com falso positivo: tom acinzentado/azulado da grade plástica (r:45, g:65, b:69)
  // e corpo escuro abaixo (r:30, g:30, b:30)
  const fakeGrillImage = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 35, g: 35, b: 35 },
    },
  })
    .composite([
      {
        input: await sharp({
          create: {
            width: 80,
            height: 10,
            channels: 3,
            background: { r: 45, g: 65, b: 69 },
          },
        })
          .png()
          .toBuffer(),
        left: 120,
        top: 100,
      },
      {
        input: await sharp({
          create: {
            width: 80,
            height: 25,
            channels: 3,
            background: { r: 25, g: 25, b: 25 },
          },
        })
          .png()
          .toBuffer(),
        left: 120,
        top: 110,
      },
    ])
    .jpeg()
    .toBuffer();

  const boxes = await findMercosulStripeBoxes(fakeGrillImage, {
    left: 0,
    top: 80,
    width,
    height: 120,
  });
  assert.equal(boxes.length, 0, "não deve detectar grade/farol escuro como placa");
});

test("reconhece placa preta Forte e ignora forte no meio de outra palavra", () => {
  assert.equal(textLooksLikeDealerPlate("FORTE"), true);
  assert.equal(textLooksLikeDealerPlate("forte"), true);
  assert.equal(textLooksLikeDealerPlate("FORTE AUTOMÓVEIS"), true);
  assert.equal(textLooksLikeDealerPlate("Forte Automoveis"), true);
  assert.equal(textLooksLikeDealerPlate("F0RTE"), true);
  assert.equal(textLooksLikeDealerPlate("AUTOMÓVEIS"), true);
  assert.equal(textLooksLikeDealerPlate("CONFORTE"), false);
  assert.equal(textLooksLikeDealerPlate("ABC1D23"), false);
  assert.equal(textLooksLikePlate("FORTE"), false);
  assert.equal(textLooksLikePlate("FORTE AUTOMÓVEIS"), false);
});

test("FORTE + AUTOMÓVEIS no para-choque vira uma caixa de loja, sem virar placa Mercosul", () => {
  const pieces = [
    {
      text: "FORTE",
      type: "WORD",
      confidence: 92,
      box: { left: 230, top: 458, width: 58, height: 18 },
    },
    {
      text: "AUTOMÓVEIS",
      type: "WORD",
      confidence: 74,
      box: { left: 232, top: 478, width: 62, height: 8 },
    },
    {
      text: "ABC1D23",
      type: "WORD",
      confidence: 88,
      box: { left: 520, top: 540, width: 70, height: 28 },
    },
  ];
  const plates = plateBoxesFromText(pieces, 1280, 720);
  const dealers = dealerPlateBoxesFromText(pieces, 1280, 720);
  assert.equal(plates.length, 1, "Mercosul/texto de placa continua no caminho antigo");
  assert.ok(plates[0].left > 480, "caixa da placa oficial não é a Forte");
  assert.equal(dealers.length, 1);
  assert.ok(dealers[0].left < 230, "padding cobre o logo à esquerda");
  assert.ok(dealers[0].width > 58);
  assert.ok(dealers[0].top + dealers[0].height > 486, "padding cobre AUTOMÓVEIS");
});

async function syntheticBlackDealerPlate() {
  const width = 320;
  const height = 200;
  const plate = { left: 40, top: 120, width: 88, height: 30 };
  const image = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 230, g: 230, b: 228 },
    },
  })
    .composite([
      {
        input: await sharp({
          create: {
            width: plate.width,
            height: plate.height,
            channels: 3,
            background: { r: 18, g: 18, b: 18 },
          },
        })
          .png()
          .toBuffer(),
        left: plate.left,
        top: plate.top,
      },
      {
        input: await sharp({
          create: {
            width: 46,
            height: 10,
            channels: 3,
            background: { r: 235, g: 235, b: 235 },
          },
        })
          .png()
          .toBuffer(),
        left: plate.left + 28,
        top: plate.top + 6,
      },
      {
        input: await sharp({
          create: {
            width: 38,
            height: 5,
            channels: 3,
            background: { r: 230, g: 230, b: 230 },
          },
        })
          .png()
          .toBuffer(),
        left: plate.left + 32,
        top: plate.top + 19,
      },
    ])
    .jpeg()
    .toBuffer();
  return { width, height, plate, image };
}

test("retângulo preto com texto branco no para-choque vira caixa de loja", async () => {
  const { plate, image } = await syntheticBlackDealerPlate();
  const boxes = await findBlackDealerPlateBoxes(image, {
    left: 0,
    top: 80,
    width: 320,
    height: 120,
  });
  assert.ok(boxes.length >= 1, "esperava achar a placa preta da loja");
  const hit = boxes[0];
  assert.ok(hit.left < plate.left + 12);
  assert.ok(hit.top < plate.top + 10);
  assert.ok(hit.width >= 50);
  assert.ok(hit.height >= 16);
  assert.ok(hit.left + hit.width > plate.left + 50);
});

test("faixa azul Mercosul não é classificada como placa preta de loja", async () => {
  const width = 320;
  const height = 200;
  const plate = { left: 40, top: 120, width: 72, height: 28 };
  const image = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 40, g: 40, b: 40 },
    },
  })
    .composite([
      {
        input: await sharp({
          create: {
            width: plate.width,
            height: 8,
            channels: 3,
            background: { r: 30, g: 55, b: 140 },
          },
        })
          .png()
          .toBuffer(),
        left: plate.left,
        top: plate.top,
      },
      {
        input: await sharp({
          create: {
            width: plate.width,
            height: 20,
            channels: 3,
            background: { r: 190, g: 190, b: 185 },
          },
        })
          .png()
          .toBuffer(),
        left: plate.left,
        top: plate.top + 8,
      },
    ])
    .jpeg()
    .toBuffer();

  const mercosul = await findMercosulStripeBoxes(image, {
    left: 0,
    top: 80,
    width,
    height: 120,
  });
  assert.ok(mercosul.length >= 1, "Mercosul continua sendo detectada");

  const dealers = await findBlackDealerPlateBoxes(image, {
    left: 0,
    top: 80,
    width,
    height: 120,
  });
  assert.equal(dealers.length, 0, "placa Mercosul branca não é placa preta de loja");
});

test("foto real da Forte: detector visual cobre a placa preta no recorte do para-choque", async () => {
  const image = await readFile(join(FIXTURES, "forte-black-dealer-plate.jpg"));
  const boxes = await findBlackDealerPlateBoxes(image, {
    left: 180,
    top: 430,
    width: 160,
    height: 80,
  });
  assert.ok(boxes.length >= 1, "esperava a placa preta FORTE na foto do Mobi");
  const hit = boxes[0];
  // Núcleo da placa na fixture 1280×720: ~203,452,102×35
  assert.ok(hit.left < 220, `left ${hit.left}`);
  assert.ok(hit.left + hit.width > 290, `right ${hit.left + hit.width}`);
  assert.ok(hit.top < 460, `top ${hit.top}`);
  assert.ok(hit.top + hit.height > 465, `bottom ${hit.top + hit.height}`);
  assert.ok(hit.width < 160, `width ${hit.width} não deve engolir o para-choque`);
  assert.ok(hit.height < 70, `height ${hit.height}`);
});

test("foto real da Forte: OCR FORTE expande e cobre logo + AUTOMÓVEIS", async () => {
  const image = await readFile(join(FIXTURES, "forte-black-dealer-plate.jpg"));
  const meta = await sharp(image).metadata();
  const width = meta.width ?? 1280;
  const height = meta.height ?? 720;
  const dealers = await dealerBoxesFromImage(
    image,
    [
      {
        text: "FORTE",
        type: "WORD",
        confidence: 94,
        box: { left: 230, top: 458, width: 58, height: 18 },
      },
      {
        text: "AUTOMÓVEIS",
        type: "WORD",
        confidence: 71,
        box: { left: 232, top: 478, width: 62, height: 8 },
      },
    ],
    width,
    height,
  );
  assert.equal(dealers.length, 1);
  const hit = dealers[0];
  assert.ok(hit.left < 215, `left ${hit.left} deve cobrir o logo`);
  assert.ok(hit.left > 185, `left ${hit.left} não deve comer o para-choque`);
  assert.ok(hit.left + hit.width > 295, `right ${hit.left + hit.width}`);
  assert.ok(hit.top < 458, `top ${hit.top}`);
  assert.ok(hit.top + hit.height > 484, `bottom ${hit.top + hit.height} deve cobrir AUTOMÓVEIS`);
  assert.ok(hit.width < 140, `width ${hit.width} deve ficar justa na plaquinha`);
  assert.ok(hit.height < 56, `height ${hit.height} não deve pintar a saia`);
});

test("blur da placa Forte na foto real reduz o contraste do texto", async () => {
  const image = await readFile(join(FIXTURES, "forte-black-dealer-plate.jpg"));
  const plate = { left: 200, top: 450, width: 108, height: 38, allowDark: true };
  // Núcleo das letras FORTE — a borda placa/para-choque continua nítida.
  const core = { left: 228, top: 458, width: 58, height: 16 };
  const beforeBuf = await sharp(image).extract(core).png().toBuffer();
  const blurred = await applyBlurRegions(image, [plate]);
  const afterBuf = await sharp(blurred).extract(core).png().toBuffer();
  const before = await sharp(beforeBuf).stats();
  const after = await sharp(afterBuf).stats();
  const beforeStd =
    (before.channels[0].stdev + before.channels[1].stdev + before.channels[2].stdev) / 3;
  const afterStd =
    (after.channels[0].stdev + after.channels[1].stdev + after.channels[2].stdev) / 3;
  assert.ok(beforeStd > 35, `contraste original baixo demais: ${beforeStd}`);
  assert.ok(afterStd < beforeStd * 0.32, `blur fraco: ${beforeStd} → ${afterStd}`);
});

test("círculo/quadrado (portinhola, calota) não vira geometria de placa", () => {
  assert.equal(isUnlikelyPlateGeometry({ left: 80, top: 20, width: 70, height: 70 }), true);
  assert.equal(isUnlikelyPlateGeometry({ left: 200, top: 450, width: 102, height: 35 }), false);
  assert.equal(isUnlikelyPlateGeometry({ left: 135, top: 128, width: 123, height: 36 }), false);
});

test("fixture da portinhola/caixa de roda: sem placa e sem retângulo de loja", async () => {
  const image = await readFile(join(FIXTURES, "fuel-door-wheel-arch.png"));
  const meta = await sharp(image).metadata();
  const width = meta.width ?? 292;
  const height = meta.height ?? 201;
  const whole = { left: 0, top: 0, width, height };

  assert.equal(plateBoxesFromText([], width, height).length, 0);
  assert.equal((await dealerBoxesFromImage(image, [], width, height)).length, 0);
  assert.equal((await findMercosulStripeBoxes(image, whole)).length, 0);
  assert.equal((await findGrayPlateBoxes(image, whole)).length, 0);
  assert.equal((await findGrayPlatesInImage(image, width, height)).length, 0);
  assert.equal(
    (await findMercosulPlatesInImage(image, width, height)).length,
    0,
    "varredura Mercosul não deve achar placa na portinhola",
  );

  const dealers = await findBlackDealerPlateBoxes(image, whole);
  assert.equal(
    dealers.length,
    0,
    `friso da caixa de roda não é placa Forte: ${JSON.stringify(dealers)}`,
  );

  const windows = [
    { left: 0, top: 0, width, height },
    { left: 51, top: 0, width: 146, height: 101 },
    { left: 40, top: 50, width: 200, height: 80 },
    { left: 70, top: 8, width: 70, height: 70 },
    { left: 81, top: 71, width: 112, height: 27 },
  ];
  for (const region of windows) {
    const found = await findBlackDealerPlateBoxes(image, region);
    assert.equal(
      found.length,
      0,
      `região ${JSON.stringify(region)} não deve ter placa preta: ${JSON.stringify(found)}`,
    );
  }

  assert.equal(
    await looksLikeBodyPanelFalsePositive(image, { left: 70, top: 8, width: 70, height: 70 }),
    true,
    "portinhola circular é falso positivo",
  );
  assert.equal(
    await looksLikeMercosulPlatePatch(image, { left: 70, top: 8, width: 70, height: 70 }),
    false,
    "portinhola não tem faixa azul Mercosul",
  );
  assert.equal(
    await looksLikeBodyPanelFalsePositive(image, { left: 81, top: 71, width: 112, height: 27 }),
    true,
    "friso da caixa de roda é falso positivo",
  );
});

test("OCR FORTE solto na portinhola não inventa placa de loja no friso", async () => {
  const image = await readFile(join(FIXTURES, "fuel-door-wheel-arch.png"));
  const meta = await sharp(image).metadata();
  const width = meta.width ?? 292;
  const height = meta.height ?? 201;
  const dealers = await dealerBoxesFromImage(
    image,
    [
      {
        text: "FORTE",
        type: "WORD",
        confidence: 88,
        box: { left: 90, top: 20, width: 40, height: 16 },
      },
    ],
    width,
    height,
  );
  assert.equal(
    dealers.length,
    0,
    `OCR sem placa preta real não deve borrar a lateral: ${JSON.stringify(dealers)}`,
  );
});

test("placa Forte real não é classificada como painel/friso", async () => {
  const image = await readFile(join(FIXTURES, "forte-black-dealer-plate.jpg"));
  const plate = { left: 203, top: 452, width: 102, height: 35 };
  assert.equal(await looksLikeBodyPanelFalsePositive(image, plate), false);
  assert.equal(await looksLikeConfirmedDealerPlate(image, plate), true);
});

test("AUTOMÓVEIS sozinho na Forte real ainda acha o retângulo preto", async () => {
  const image = await readFile(join(FIXTURES, "forte-black-dealer-plate.jpg"));
  const meta = await sharp(image).metadata();
  const width = meta.width ?? 1280;
  const height = meta.height ?? 720;
  const dealers = await dealerBoxesFromImage(
    image,
    [
      {
        text: "AUTOMÓVEIS",
        type: "WORD",
        confidence: 80,
        box: { left: 232, top: 478, width: 62, height: 8 },
      },
    ],
    width,
    height,
  );
  assert.equal(dealers.length, 1, `esperava a placa visual: ${JSON.stringify(dealers)}`);
  const hit = dealers[0];
  assert.ok(hit.left < 215, `left ${hit.left}`);
  assert.ok(hit.left + hit.width > 290, `right ${hit.left + hit.width}`);
  assert.ok(hit.top < 458, `top ${hit.top} deve subir até o FORTE`);
  assert.ok(hit.top + hit.height > 480, `bottom ${hit.top + hit.height}`);
  assert.ok(hit.width < 140, `width ${hit.width}`);
  assert.ok(hit.height > 28, `height ${hit.height} deve cobrir as duas linhas`);
});

const CIVIC_STRAY = { left: 63, top: 118, width: 89, height: 26 };
const CIVIC_PLAQUE = { left: 176, top: 148, width: 80, height: 22 };
const CIVIC_CHROME = { left: 183, top: 115, width: 39, height: 25 };

function boxOverlaps(
  hit: { left: number; top: number; width: number; height: number },
  core: { left: number; top: number; width: number; height: number },
) {
  return (
    hit.left < core.left + core.width &&
    hit.left + hit.width > core.left &&
    hit.top < core.top + core.height &&
    hit.top + hit.height > core.top
  );
}

async function civicWithSyntheticForte() {
  const civic = await readFile(join(FIXTURES, "forte-civic-front-false-box.png"));
  const plate = { left: 172, top: 142, width: 84, height: 28 };
  const image = await sharp(civic)
    .composite([
      {
        input: await sharp({
          create: {
            width: plate.width,
            height: plate.height,
            channels: 3,
            background: { r: 16, g: 16, b: 16 },
          },
        })
          .png()
          .toBuffer(),
        left: plate.left,
        top: plate.top,
      },
      {
        input: await sharp({
          create: {
            width: 44,
            height: 9,
            channels: 3,
            background: { r: 236, g: 236, b: 236 },
          },
        })
          .png()
          .toBuffer(),
        left: plate.left + 26,
        top: plate.top + 5,
      },
      {
        input: await sharp({
          create: {
            width: 36,
            height: 5,
            channels: 3,
            background: { r: 228, g: 228, b: 228 },
          },
        })
          .png()
          .toBuffer(),
        left: plate.left + 30,
        top: plate.top + 17,
      },
    ])
    .jpeg()
    .toBuffer();
  return { image, plate };
}

test("Civic da Lucas: cromado/farol não vira Mercosul nem placa preta", async () => {
  const image = await readFile(join(FIXTURES, "forte-civic-front-false-box.png"));
  const meta = await sharp(image).metadata();
  const width = meta.width ?? 376;
  const height = meta.height ?? 187;
  const whole = { left: 0, top: 0, width, height };

  assert.equal(
    (await findMercosulStripeBoxes(image, whole)).length,
    0,
    "cromado do para-choque não é faixa Mercosul",
  );
  assert.equal((await findMercosulPlatesInImage(image, width, height)).length, 0);
  assert.equal((await findGrayPlateBoxes(image, whole)).length, 0);
  assert.equal((await findGrayPlatesInImage(image, width, height)).length, 0);
  assert.equal((await findBlackDealerPlateBoxes(image, whole)).length, 0);
  assert.equal((await dealerBoxesFromImage(image, [], width, height)).length, 0);
  assert.equal(await looksLikeMercosulPlatePatch(image, CIVIC_CHROME), false);
  assert.equal(await looksLikeGrayPlatePatch(image, CIVIC_CHROME), false);
  assert.equal(
    await looksLikeBodyPanelFalsePositive(image, CIVIC_STRAY),
    true,
    "caixa extra no farol/para-choque é falso positivo",
  );
  assert.equal(await looksLikeConfirmedDealerPlate(image, CIVIC_STRAY), false);
  assert.equal(await looksLikeConfirmedDealerPlate(image, CIVIC_PLAQUE), false);
});

test("Civic da Lucas: OCR FORTE/AUTOMÓVEIS no farol não inventa 2ª caixa", async () => {
  const image = await readFile(join(FIXTURES, "forte-civic-front-false-box.png"));
  const meta = await sharp(image).metadata();
  const width = meta.width ?? 376;
  const height = meta.height ?? 187;

  const strayForte = await dealerBoxesFromImage(
    image,
    [
      {
        text: "FORTE",
        type: "WORD",
        confidence: 80,
        box: { left: 96, top: 122, width: 40, height: 12 },
      },
    ],
    width,
    height,
  );
  assert.equal(
    strayForte.length,
    0,
    `FORTE no farol não deve borrar o para-choque: ${JSON.stringify(strayForte)}`,
  );

  const strayAuto = await dealerBoxesFromImage(
    image,
    [
      {
        text: "AUTOMÓVEIS",
        type: "WORD",
        confidence: 70,
        box: { left: 96, top: 126, width: 50, height: 8 },
      },
    ],
    width,
    height,
  );
  assert.equal(
    strayAuto.length,
    0,
    `AUTOMÓVEIS no farol não deve virar caixa: ${JSON.stringify(strayAuto)}`,
  );

  const centerPlusStray = await dealerBoxesFromImage(
    image,
    [
      {
        text: "FORTE",
        type: "WORD",
        confidence: 92,
        box: { left: 186, top: 150, width: 48, height: 12 },
      },
      {
        text: "AUTOMÓVEIS",
        type: "WORD",
        confidence: 74,
        box: { left: 188, top: 162, width: 52, height: 7 },
      },
      {
        text: "FORTE",
        type: "WORD",
        confidence: 72,
        box: { left: 96, top: 122, width: 40, height: 12 },
      },
    ],
    width,
    height,
  );
  assert.equal(
    centerPlusStray.length,
    0,
    `smear sem letra + farol não viram Forte: ${JSON.stringify(centerPlusStray)}`,
  );
  for (const hit of centerPlusStray) {
    assert.equal(
      boxOverlaps(hit, CIVIC_STRAY) && !boxOverlaps(hit, CIVIC_PLAQUE),
      false,
      `caixa ${JSON.stringify(hit)} pintou o farol`,
    );
  }
});

test("Civic da Lucas: Forte confirmada fica justa na plaquinha, sem a caixa do farol", async () => {
  const { image, plate } = await civicWithSyntheticForte();
  const meta = await sharp(image).metadata();
  const width = meta.width ?? 376;
  const height = meta.height ?? 187;
  const dealers = await dealerBoxesFromImage(
    image,
    [
      {
        text: "FORTE",
        type: "WORD",
        confidence: 93,
        box: { left: plate.left + 26, top: plate.top + 5, width: 44, height: 9 },
      },
      {
        text: "AUTOMÓVEIS",
        type: "WORD",
        confidence: 76,
        box: { left: plate.left + 30, top: plate.top + 17, width: 36, height: 5 },
      },
    ],
    width,
    height,
  );
  assert.equal(dealers.length, 1, `esperava 1 Forte: ${JSON.stringify(dealers)}`);
  const hit = dealers[0];
  assert.ok(boxOverlaps(hit, plate), `caixa ${JSON.stringify(hit)} não cobre a plaquinha`);
  assert.ok(hit.left + 4 >= plate.left - 12, `left ${hit.left} abriu demais`);
  assert.ok(hit.width < 130, `width ${hit.width} pintou o para-choque`);
  assert.ok(hit.height < 48, `height ${hit.height}`);
  assert.equal(
    boxOverlaps(hit, CIVIC_STRAY),
    false,
    `caixa justa não pode cobrir o farol: ${JSON.stringify(hit)}`,
  );
  assert.equal((await findMercosulStripeBoxes(image, { left: 0, top: 0, width, height })).length, 0);

  const core = {
    left: plate.left + 16,
    top: plate.top + 3,
    width: 58,
    height: 16,
  };
  const beforeBuf = await sharp(image).extract(core).png().toBuffer();
  const blurred = await applyBlurRegions(image, [{ ...hit, allowDark: true }]);
  const afterBuf = await sharp(blurred).extract(core).png().toBuffer();
  const before = await sharp(beforeBuf).stats();
  const after = await sharp(afterBuf).stats();
  const beforeContrast =
    (before.channels[0].stdev + before.channels[1].stdev + before.channels[2].stdev) / 3;
  const afterContrast =
    (after.channels[0].stdev + after.channels[1].stdev + after.channels[2].stdev) / 3;
  assert.ok(beforeContrast > 25, `contraste original baixo: ${beforeContrast}`);
  assert.ok(
    afterContrast < beforeContrast * 0.35,
    `smear fraco na Civic: ${beforeContrast} → ${afterContrast}`,
  );
});

test("OCR Forte + imagem sintética não apaga a caixa Mercosul", async () => {
  const { image, width, height } = await syntheticBlackDealerPlate();
  const pieces = [
    {
      text: "FORTE",
      type: "WORD",
      confidence: 90,
      box: { left: 68, top: 126, width: 40, height: 12 },
    },
    {
      text: "ABC1D23",
      type: "WORD",
      confidence: 86,
      box: { left: 200, top: 40, width: 70, height: 28 },
    },
  ];
  const plates = plateBoxesFromText(pieces, width, height);
  const dealers = await dealerBoxesFromImage(image, pieces, width, height);
  assert.equal(plates.length, 1);
  assert.ok(dealers.length >= 1);
  assert.ok(
    plates[0].left > 160,
    "placa Mercosul/oficial permanece no canto oposto",
  );
});

test("foto da Biz (traseira): placa Mercosul de moto vira caixa e não é portinhola", async () => {
  const image = await readFile(join(FIXTURES, "moto-mercosul-biz-rear.jpg"));
  const meta = await sharp(image).metadata();
  const width = meta.width ?? 400;
  const height = meta.height ?? 164;
  const core = { left: 212, top: 130, width: 32, height: 26 };

  const boxes = await findMercosulPlatesInImage(image, width, height);
  assert.ok(boxes.length >= 1, `esperava a placa da Biz: ${JSON.stringify(boxes)}`);
  const hit = boxes[0];
  assert.ok(boxOverlaps(hit, core), `caixa ${JSON.stringify(hit)} não cobre SGD 9E87`);
  assert.ok(hit.width <= 56, `width ${hit.width} não deve engolir o para-lama`);
  assert.ok(hit.height <= 44, `height ${hit.height} grande demais para a placa`);
  assert.ok(hit.top >= 122, `top ${hit.top} subiu demais acima da faixa azul`);
  assert.ok(hit.top + hit.height >= 155, `bottom ${hit.top + hit.height} não cobre 9E87`);
  assert.ok(hit.top + hit.height <= 164);
  assert.equal(await looksLikeMercosulPlatePatch(image, hit), true);
  assert.equal(await looksLikeGrayPlatePatch(image, hit), false);
  assert.equal((await findGrayPlatesInImage(image, width, height)).length, 0);
  assert.equal(await looksLikeAnalogGaugeAround(image, hit), false);
  assert.equal(
    await looksLikeBodyPanelFalsePositive(image, hit),
    false,
    "placa de moto Mercosul não é falso positivo de portinhola",
  );
});

test("foto da Biz (3/4): placa Mercosul menor e mais alta também é detectada", async () => {
  const image = await readFile(join(FIXTURES, "moto-mercosul-biz-side.jpg"));
  const meta = await sharp(image).metadata();
  const width = meta.width ?? 396;
  const height = meta.height ?? 164;
  const core = { left: 224, top: 108, width: 28, height: 32 };

  const boxes = await findMercosulPlatesInImage(image, width, height);
  assert.ok(boxes.length >= 1, `esperava a placa no 3/4: ${JSON.stringify(boxes)}`);
  const hit = boxes[0];
  assert.ok(boxOverlaps(hit, core), `caixa ${JSON.stringify(hit)} não cobre a placa`);
  assert.ok(hit.width <= 48, `width ${hit.width}`);
  assert.ok(hit.height <= 50, `height ${hit.height} não deve cobrir o para-lama`);
  assert.ok(hit.top >= 98, `top ${hit.top}`);
  assert.ok(hit.top + hit.height >= 136);
  assert.ok(hit.top + hit.height <= 150, `bottom ${hit.top + hit.height} desceu no para-lama`);
  assert.equal(await looksLikeMercosulPlatePatch(image, hit), true);
  assert.equal(await looksLikeAnalogGaugeAround(image, hit), false);
  assert.equal(await looksLikeBodyPanelFalsePositive(image, hit), false);
});

test("OCR em duas linhas (SGD + 9E87) vira caixa de placa de moto", () => {
  const boxes = plateBoxesFromText(
    [
      {
        text: "BRASIL",
        type: "WORD",
        confidence: 90,
        box: { left: 218, top: 122, width: 32, height: 8 },
      },
      {
        text: "SGD",
        type: "WORD",
        confidence: 88,
        box: { left: 220, top: 132, width: 28, height: 12 },
      },
      {
        text: "9E87",
        type: "WORD",
        confidence: 86,
        box: { left: 218, top: 144, width: 32, height: 12 },
      },
    ],
    400,
    164,
  );
  assert.equal(boxes.length, 1, `esperava união das duas linhas: ${JSON.stringify(boxes)}`);
  const hit = boxes[0];
  assert.ok(hit.left < 220, `left ${hit.left} deve incluir a faixa BRASIL`);
  assert.ok(hit.top < 132, `top ${hit.top} deve cobrir BRASIL`);
  assert.ok(hit.top + hit.height > 156, `bottom ${hit.top + hit.height} deve cobrir 9E87`);
  assert.ok(hit.width < 80);
});

test("blur da placa Mercosul da Biz deixa os caracteres ilegíveis", async () => {
  const image = await readFile(join(FIXTURES, "moto-mercosul-biz-rear.jpg"));
  const meta = await sharp(image).metadata();
  const boxes = await findMercosulPlatesInImage(
    image,
    meta.width ?? 400,
    meta.height ?? 164,
  );
  assert.ok(boxes.length >= 1);
  const core = { left: 214, top: 134, width: 28, height: 22 };
  const above = { left: 214, top: 116, width: 28, height: 8 };
  const beforeBuf = await sharp(image).extract(core).png().toBuffer();
  const blurred = await applyBlurRegions(image, boxes);
  const afterBuf = await sharp(blurred).extract(core).png().toBuffer();
  const before = await sharp(beforeBuf).stats();
  const after = await sharp(afterBuf).stats();
  const beforeStd =
    (before.channels[0].stdev + before.channels[1].stdev + before.channels[2].stdev) / 3;
  const afterStd =
    (after.channels[0].stdev + after.channels[1].stdev + after.channels[2].stdev) / 3;
  assert.ok(beforeStd > 30, `contraste original baixo demais: ${beforeStd}`);
  assert.ok(afterStd < beforeStd * 0.45, `blur fraco: ${beforeStd} → ${afterStd}`);

  const aboveBefore = await sharp(
    await sharp(image).extract(above).png().toBuffer(),
  ).stats();
  const aboveAfter = await sharp(
    await sharp(blurred).extract(above).png().toBuffer(),
  ).stats();
  const aboveBeforeStd =
    (aboveBefore.channels[0].stdev +
      aboveBefore.channels[1].stdev +
      aboveBefore.channels[2].stdev) /
    3;
  const aboveAfterStd =
    (aboveAfter.channels[0].stdev +
      aboveAfter.channels[1].stdev +
      aboveAfter.channels[2].stdev) /
    3;
  assert.ok(
    aboveAfterStd > aboveBeforeStd * 0.7,
    `blur subiu no para-lama: ${aboveBeforeStd} → ${aboveAfterStd}`,
  );
});

test("blur da Biz em 3/4 não come o para-lama abaixo da placa", async () => {
  const image = await readFile(join(FIXTURES, "moto-mercosul-biz-side.jpg"));
  const meta = await sharp(image).metadata();
  const boxes = await findMercosulPlatesInImage(
    image,
    meta.width ?? 396,
    meta.height ?? 164,
  );
  assert.ok(boxes.length >= 1);
  const fender = { left: 222, top: 148, width: 24, height: 10 };
  const before = await sharp(
    await sharp(image).extract(fender).png().toBuffer(),
  ).stats();
  const blurred = await applyBlurRegions(image, boxes);
  const after = await sharp(
    await sharp(blurred).extract(fender).png().toBuffer(),
  ).stats();
  const beforeStd =
    (before.channels[0].stdev + before.channels[1].stdev + before.channels[2].stdev) / 3;
  const afterStd =
    (after.channels[0].stdev + after.channels[1].stdev + after.channels[2].stdev) / 3;
  assert.ok(
    afterStd > beforeStd * 0.7,
    `para-lama borrado: ${beforeStd} → ${afterStd}; caixa ${JSON.stringify(boxes[0])}`,
  );
});

test("painel Honda (relógio): fixture não vira Mercosul nem Forte", async () => {
  const image = await readFile(join(FIXTURES, "honda-moto-cluster-false-box.png"));
  const meta = await sharp(image).metadata();
  const width = meta.width ?? 246;
  const height = meta.height ?? 284;
  const whole = { left: 0, top: 0, width, height };
  const formerHit = { left: 0, top: 54, width: 44, height: 30 };
  const smear = { left: 64, top: 76, width: 69, height: 51 };
  const gauge = { left: 8, top: 18, width: 140, height: 150 };
  const visor = { left: 0, top: 56, width: 41, height: 17 };

  assert.equal(plateBoxesFromText([], width, height).length, 0);
  assert.equal((await dealerBoxesFromImage(image, [], width, height)).length, 0);
  assert.equal(
    (await findMercosulStripeBoxes(image, whole)).length,
    0,
    "visor/relógio não é faixa Mercosul",
  );
  assert.equal(
    (await findMercosulPlatesInImage(image, width, height)).length,
    0,
    "varredura Mercosul no painel deve ser zero",
  );
  assert.equal((await findGrayPlateBoxes(image, whole)).length, 0);
  assert.equal((await findGrayPlatesInImage(image, width, height)).length, 0);
  assert.equal((await findBlackDealerPlateBoxes(image, whole)).length, 0);

  const windows = [whole, formerHit, smear, gauge, visor];
  for (const region of windows) {
    const found = await findMercosulStripeBoxes(image, region);
    assert.equal(
      found.length,
      0,
      `região ${JSON.stringify(region)} não deve ter Mercosul: ${JSON.stringify(found)}`,
    );
    const dealers = await findBlackDealerPlateBoxes(image, region);
    assert.equal(
      dealers.length,
      0,
      `região ${JSON.stringify(region)} não deve ter Forte: ${JSON.stringify(dealers)}`,
    );
  }

  assert.equal(await looksLikeAnalogGaugeAround(image, formerHit), true);
  assert.equal(await looksLikeAnalogGaugeAround(image, smear), true);
  assert.equal(await looksLikeAnalogGaugeAround(image, gauge), true);
  assert.equal(await looksLikeMercosulPlatePatch(image, formerHit), false);
  assert.equal(await looksLikeMercosulPlatePatch(image, smear), false);
  assert.equal(await looksLikeMercosulPlatePatch(image, gauge), false);
  assert.equal(await looksLikeBodyPanelFalsePositive(image, formerHit), true);
  assert.equal(await looksLikeBodyPanelFalsePositive(image, smear), true);
});

test("OCR do painel Honda (PGM-FI + km/h) não empilha placa", () => {
  const boxes = plateBoxesFromText(
    [
      {
        text: "HONDA",
        type: "WORD",
        confidence: 90,
        box: { left: 40, top: 200, width: 40, height: 16 },
      },
      {
        text: "PGM-FI",
        type: "WORD",
        confidence: 72,
        box: { left: 70, top: 168, width: 48, height: 12 },
      },
      {
        text: "80",
        type: "WORD",
        confidence: 86,
        box: { left: 44, top: 34, width: 22, height: 16 },
      },
      {
        text: "100",
        type: "WORD",
        confidence: 84,
        box: { left: 78, top: 28, width: 26, height: 16 },
      },
      {
        text: "120",
        type: "WORD",
        confidence: 80,
        box: { left: 104, top: 62, width: 26, height: 16 },
      },
      {
        text: "km/h",
        type: "WORD",
        confidence: 68,
        box: { left: 54, top: 136, width: 28, height: 10 },
      },
    ],
    246,
    284,
  );
  assert.equal(boxes.length, 0, `números do relógio não são placa: ${JSON.stringify(boxes)}`);
  assert.equal(
    textsLookLikeDashboard(["HONDA", "PGM-FI", "80", "100", "120", "km/h"]),
    true,
  );
});

test("placa no rabo da moto não é descartada como canto de carro", () => {
  const imgWidth = 400;
  const imgHeight = 266;
  const car = { left: 0, top: 0, width: 400, height: 266 };
  const moto = { left: 280, top: 80, width: 120, height: 160 };
  const tailPlate = { left: 340, top: 180, width: 36, height: 32 };

  assert.equal(
    isHeadlightOrCornerZone(tailPlate, car, imgWidth, imgHeight),
    true,
    "no envelope de carro a cauda cairia na regra de canto",
  );
  const withoutMoto = disambiguateCarPlates([tailPlate], [car], imgWidth, imgHeight);
  assert.equal(withoutMoto.length, 0);

  const withMoto = disambiguateCarPlates(
    [tailPlate],
    [car],
    imgWidth,
    imgHeight,
    [moto],
  );
  assert.equal(withMoto.length, 1);
  assert.equal(withMoto[0].left, 340);
});

const GRAY_CIVIC_CORE = { left: 157, top: 142, width: 82, height: 24 };

async function syntheticGrayCarPlate() {
  const width = 320;
  const height = 200;
  const plate = { left: 118, top: 142, width: 84, height: 26 };
  const svg = Buffer.from(`<svg width="${plate.width}" height="${plate.height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${plate.width}" height="${plate.height}" fill="#A8A8A0"/>
    <rect x="1" y="1" width="${plate.width - 2}" height="${plate.height - 2}" fill="none" stroke="#3F3F3A" stroke-width="1.4"/>
    <text x="${plate.width / 2}" y="8" text-anchor="middle" font-family="Liberation Sans, DejaVu Sans, sans-serif" font-size="6" fill="#1A1A1A">VITORIA - ES</text>
    <text x="${plate.width / 2}" y="22" text-anchor="middle" font-family="Liberation Sans, DejaVu Sans, sans-serif" font-weight="700" font-size="13" fill="#111111">QWE1234</text>
  </svg>`);
  const image = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 36, g: 36, b: 38 },
    },
  })
    .composite([{ input: await sharp(svg).png().toBuffer(), left: plate.left, top: plate.top }])
    .jpeg()
    .toBuffer();
  return { width, height, plate, image };
}

test("placa cinza sintética no para-choque vira caixa e não é Mercosul", async () => {
  const { plate, image, width, height } = await syntheticGrayCarPlate();
  const whole = { left: 0, top: 0, width, height };
  const boxes = await findGrayPlateBoxes(image, whole);
  assert.ok(boxes.length >= 1, `esperava a placa cinza: ${JSON.stringify(boxes)}`);
  const hit = boxes[0];
  assert.ok(boxOverlaps(hit, plate), `caixa ${JSON.stringify(hit)} não cobre ABC/QWE1234`);
  assert.ok(hit.width < 120, `width ${hit.width} pintou o para-choque`);
  assert.ok(hit.height < 40, `height ${hit.height}`);
  assert.equal(await looksLikeGrayPlatePatch(image, hit), true);
  assert.equal(await looksLikeMercosulPlatePatch(image, hit), false);
  assert.equal(await looksLikeBodyPanelFalsePositive(image, hit), false);
  assert.equal((await findMercosulStripeBoxes(image, whole)).length, 0);
});

test("Civic com placa cinza: detector cobre ABC1234 e o cromado continua limpo", async () => {
  const image = await readFile(join(FIXTURES, "gray-br-plate-civic.png"));
  const meta = await sharp(image).metadata();
  const width = meta.width ?? 376;
  const height = meta.height ?? 187;
  const whole = { left: 0, top: 0, width, height };

  const boxes = await findGrayPlatesInImage(image, width, height);
  assert.ok(boxes.length >= 1, `esperava a placa cinza do Civic: ${JSON.stringify(boxes)}`);
  const hit = boxes[0];
  assert.ok(
    boxOverlaps(hit, GRAY_CIVIC_CORE),
    `caixa ${JSON.stringify(hit)} não cobre ABC1234`,
  );
  assert.ok(hit.left < 160, `left ${hit.left}`);
  assert.ok(hit.left + hit.width > 230, `right ${hit.left + hit.width}`);
  assert.ok(hit.top < 146, `top ${hit.top}`);
  assert.ok(hit.top + hit.height > 160, `bottom ${hit.top + hit.height}`);
  assert.ok(hit.width < 130, `width ${hit.width} não deve comer o para-choque`);
  assert.ok(hit.height < 48, `height ${hit.height}`);
  const headlightCore = { left: 70, top: 80, width: 48, height: 36 };
  assert.equal(
    boxOverlaps(hit, headlightCore),
    false,
    "não pode pintar o farol",
  );
  assert.equal(await looksLikeGrayPlatePatch(image, GRAY_CIVIC_CORE), true);
  assert.equal(await looksLikeMercosulPlatePatch(image, GRAY_CIVIC_CORE), false);
  assert.equal(await looksLikeBodyPanelFalsePositive(image, GRAY_CIVIC_CORE), false);
  assert.equal((await findMercosulStripeBoxes(image, whole)).length, 0);
  assert.equal((await findMercosulPlatesInImage(image, width, height)).length, 0);
  assert.equal((await findBlackDealerPlateBoxes(image, whole)).length, 0);
});

test("semente minúscula na borda direita da placa cinza cobre o retângulo inteiro", async () => {
  const image = await readFile(join(FIXTURES, "gray-br-plate-civic.png"));
  const speck = { left: 226, top: 150, width: 12, height: 10 };
  const grown = await expandToGrayPlateBox(image, speck, 376, 187);
  assert.ok(
    boxOverlaps(grown, GRAY_CIVIC_CORE),
    `expansão ${JSON.stringify(grown)} não cobriu a placa`,
  );
  assert.ok(grown.left <= 160, `left ${grown.left} não voltou até o A`);
  assert.ok(grown.left + grown.width >= 230, `right ${grown.left + grown.width}`);
  assert.ok(grown.width >= 70, `width ${grown.width}`);
  assert.ok(grown.width < 120);
  assert.equal(await looksLikeGrayPlatePatch(image, grown), true);
  assert.equal(boxOverlaps(grown, CIVIC_STRAY), false);
});

test("blur da placa cinza do Civic deixa ABC1234 ilegível e o farol nítido", async () => {
  const image = await readFile(join(FIXTURES, "gray-br-plate-civic.png"));
  const meta = await sharp(image).metadata();
  const boxes = await findGrayPlatesInImage(
    image,
    meta.width ?? 376,
    meta.height ?? 187,
  );
  assert.ok(boxes.length >= 1);
  const core = { left: 168, top: 154, width: 56, height: 10 };
  const headlight = { left: 70, top: 88, width: 36, height: 22 };
  const beforeBuf = await sharp(image).extract(core).png().toBuffer();
  const blurred = await applyBlurRegions(image, boxes);
  const afterBuf = await sharp(blurred).extract(core).png().toBuffer();
  const before = await sharp(beforeBuf).stats();
  const after = await sharp(afterBuf).stats();
  const beforeStd =
    (before.channels[0].stdev + before.channels[1].stdev + before.channels[2].stdev) / 3;
  const afterStd =
    (after.channels[0].stdev + after.channels[1].stdev + after.channels[2].stdev) / 3;
  assert.ok(beforeStd > 25, `contraste original baixo: ${beforeStd}`);
  assert.ok(
    afterStd < beforeStd * 0.45,
    `blur fraco na placa cinza: ${beforeStd} → ${afterStd}`,
  );

  const lightBefore = await sharp(
    await sharp(image).extract(headlight).png().toBuffer(),
  ).stats();
  const lightAfter = await sharp(
    await sharp(blurred).extract(headlight).png().toBuffer(),
  ).stats();
  const lightBeforeStd =
    (lightBefore.channels[0].stdev +
      lightBefore.channels[1].stdev +
      lightBefore.channels[2].stdev) /
    3;
  const lightAfterStd =
    (lightAfter.channels[0].stdev +
      lightAfter.channels[1].stdev +
      lightAfter.channels[2].stdev) /
    3;
  assert.ok(
    lightAfterStd > lightBeforeStd * 0.7,
    `blur vazou no farol: ${lightBeforeStd} → ${lightAfterStd}`,
  );
});


