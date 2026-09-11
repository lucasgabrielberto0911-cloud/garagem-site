import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import {
  disambiguateCarPlates,
  extractPlateCandidate,
  findMercosulStripeBoxes,
  isHeadlightOrCornerZone,
  plateBoxesFromText,
  textLooksLikePlate,
  textsLookLikeDashboard,
} from "./blur-plates";

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

