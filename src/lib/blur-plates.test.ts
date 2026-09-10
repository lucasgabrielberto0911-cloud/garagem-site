import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import {
  extractPlateCandidate,
  findMercosulStripeBoxes,
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
