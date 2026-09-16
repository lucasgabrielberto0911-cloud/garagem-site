import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CHAT_LAYOUT,
  chatBoxInsideViewport,
  chatMobileKeyboardCovered,
  chatOpenOccupiedHeight,
  chatOpenPanelBox,
} from "./chat-mobile-viewport";

test("sem teclado o inset é zero e o chat não entra em modo teclado", () => {
  const result = chatMobileKeyboardCovered({
    innerHeight: 844,
    viewportHeight: 844,
    viewportOffsetTop: 0,
  });
  assert.equal(result.covered, 0);
  assert.equal(result.keyboardOpen, false);
});

test("teclado iOS típico (~336px) marca o modo teclado", () => {
  const result = chatMobileKeyboardCovered({
    innerHeight: 844,
    viewportHeight: 508,
    viewportOffsetTop: 0,
  });
  assert.equal(result.covered, 336);
  assert.equal(result.keyboardOpen, true);
});

test("offsetTop do visualViewport entra no cálculo (Safari)", () => {
  const result = chatMobileKeyboardCovered({
    innerHeight: 844,
    viewportHeight: 500,
    viewportOffsetTop: 40,
  });
  assert.equal(result.covered, 304);
  assert.equal(result.keyboardOpen, true);
});

test("recorte pequeno da barra do browser não dispara o modo teclado", () => {
  const result = chatMobileKeyboardCovered({
    innerHeight: 844,
    viewportHeight: 800,
    viewportOffsetTop: 0,
  });
  assert.equal(result.covered, 44);
  assert.equal(result.keyboardOpen, false);
});

test("legacy desktop: painel + FAB + folga do WhatsApp vaza em janela baixa (print Lucas)", () => {
  const viewportHeight = 700;
  const occupied = chatOpenOccupiedHeight({
    viewportHeight,
    topInset: 0,
    bottomInset: CHAT_LAYOUT.closedDesktopBottomPx,
    launcherBelowPanel: true,
    panelReserve: CHAT_LAYOUT.legacyPanelReservePx,
  });
  assert.ok(
    occupied > viewportHeight,
    `esperado overflow, ocupou ${occupied}px em ${viewportHeight}px`,
  );
});

test("painel aberto no desktop baixo cabe no viewport sem FAB solto", () => {
  const viewportWidth = 1180;
  const viewportHeight = 700;
  const box = chatOpenPanelBox({
    viewportWidth,
    viewportHeight,
    desktop: true,
  });
  assert.equal(
    chatOpenOccupiedHeight({
      viewportHeight,
      topInset: CHAT_LAYOUT.openDesktopInsetPx.top,
      bottomInset: CHAT_LAYOUT.openDesktopInsetPx.bottom,
      launcherBelowPanel: false,
    }),
    viewportHeight,
  );
  assert.equal(chatBoxInsideViewport(box, viewportWidth, viewportHeight), true);
  assert.ok(box.top >= CHAT_LAYOUT.openDesktopInsetPx.top);
  assert.ok(box.height <= CHAT_LAYOUT.panelMaxPx);
});

test("painel aberto no mobile/ficha preenche o inset e não vaza", () => {
  const viewportWidth = 390;
  const viewportHeight = 844;
  const box = chatOpenPanelBox({
    viewportWidth,
    viewportHeight,
    desktop: false,
  });
  assert.equal(chatBoxInsideViewport(box, viewportWidth, viewportHeight), true);
  assert.equal(box.top, CHAT_LAYOUT.openMobileInsetPx.top);
  assert.equal(box.bottom, CHAT_LAYOUT.openMobileInsetPx.bottom);
});

test("desktop alto: card de 680px, não estica a tela inteira", () => {
  const box = chatOpenPanelBox({
    viewportWidth: 1440,
    viewportHeight: 900,
    desktop: true,
  });
  assert.equal(box.height, CHAT_LAYOUT.panelMaxPx);
  assert.equal(box.width, CHAT_LAYOUT.panelWidthPx);
  assert.equal(chatBoxInsideViewport(box, 1440, 900), true);
});
