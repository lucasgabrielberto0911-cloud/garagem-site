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
  extractPlateCandidate,
  findBlackDealerPlateBoxes,
  findMercosulStripeBoxes,
  isHeadlightOrCornerZone,
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
  assert.ok(hit.left + hit.width > 295, `right ${hit.left + hit.width}`);
  assert.ok(hit.top < 458, `top ${hit.top}`);
  assert.ok(hit.top + hit.height > 484, `bottom ${hit.top + hit.height} deve cobrir AUTOMÓVEIS`);
  assert.ok(hit.width < 220, `width ${hit.width}`);
  assert.ok(hit.height < 90, `height ${hit.height}`);
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
  assert.ok(afterStd < beforeStd * 0.55, `blur fraco: ${beforeStd} → ${afterStd}`);
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

