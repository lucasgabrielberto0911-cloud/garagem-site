import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CHAT_LAYOUT,
  chatBoxInsideViewport,
  chatBoxesOverlap,
  chatClosedLauncherBox,
  chatClosedLauncherVisible,
  chatKeyboardShellStyle,
  chatMobileKeyboardCovered,
  chatOpenOccupiedHeight,
  chatOpenPanelBox,
  chatWhatsAppFloatBox,
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

test("shell do teclado cabe no visualViewport (iPhone)", () => {
  const frame = chatKeyboardShellStyle({
    viewportHeight: 508,
    viewportOffsetTop: 0,
  });
  assert.equal(frame.top, 4);
  assert.equal(frame.height, 500);
  assert.equal(frame.left, null);
  assert.ok(frame.top + frame.height <= 508);
});

test("offsetTop do Safari entra no top do shell (teclado + chrome)", () => {
  const frame = chatKeyboardShellStyle({
    viewportHeight: 500,
    viewportOffsetTop: 40,
  });
  assert.equal(frame.top, 44);
  assert.equal(frame.height, 492);
  assert.ok(frame.top + frame.height <= 40 + 500);
});

test("iPad landscape (≥1024) também encaixa o composer acima do teclado", () => {
  const innerHeight = 820;
  const viewportHeight = 480;
  const viewportOffsetTop = 36;
  const covered = chatMobileKeyboardCovered({
    innerHeight,
    viewportHeight,
    viewportOffsetTop,
  });
  assert.equal(covered.keyboardOpen, true);
  const frame = chatKeyboardShellStyle({
    viewportHeight,
    viewportOffsetTop,
    viewportWidth: 1180,
  });
  assert.ok(frame.height >= 220);
  assert.ok(frame.top + frame.height <= viewportOffsetTop + viewportHeight);
  assert.equal(frame.left, null, "sem offsetLeft o card desktop mantém a largura");
});

test("offsetLeft do visualViewport (iPad split / pan) desloca o shell", () => {
  const frame = chatKeyboardShellStyle({
    viewportHeight: 500,
    viewportOffsetTop: 20,
    viewportWidth: 390,
    viewportOffsetLeft: 24,
  });
  assert.equal(frame.left, 28);
  assert.equal(frame.width, 382);
});

test("viewport minúsculo não deixa o composer com altura zero", () => {
  const frame = chatKeyboardShellStyle({
    viewportHeight: 80,
    viewportOffsetTop: 0,
  });
  assert.equal(frame.height, 220);
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
    bottomInset: CHAT_LAYOUT.legacyClosedDesktopBottomPx,
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

test("FAB fechado some na ficha e no mobile com consent, não com chips", () => {
  assert.equal(
    chatClosedLauncherVisible({ desktop: false, ficha: true, chips: false }),
    false,
  );
  assert.equal(
    chatClosedLauncherVisible({ desktop: true, ficha: true, chips: false }),
    false,
  );
  assert.equal(
    chatClosedLauncherVisible({ desktop: false, ficha: false, chips: true }),
    true,
  );
  assert.equal(
    chatClosedLauncherVisible({
      desktop: false,
      ficha: false,
      chips: false,
      consent: true,
    }),
    false,
  );
  assert.equal(
    chatClosedLauncherVisible({ desktop: true, ficha: false, chips: true }),
    true,
  );
});

test("FAB fechado no desktop fica ao lado do WhatsApp, não empilhado no meio", () => {
  const viewportWidth = 1440;
  const viewportHeight = 900;
  const fab = chatClosedLauncherBox({
    viewportWidth,
    viewportHeight,
    desktop: true,
    ficha: false,
    chips: false,
  });
  assert.ok(fab);
  const wa = chatWhatsAppFloatBox(viewportWidth, viewportHeight);
  assert.equal(chatBoxInsideViewport(fab, viewportWidth, viewportHeight), true);
  assert.equal(fab.bottom, CHAT_LAYOUT.closedDesktopBottomPx);
  assert.equal(fab.bottom, wa.bottom);
  assert.ok(fab.right > wa.right);
  assert.equal(chatBoxesOverlap(fab, wa), false);
  assert.ok(
    fab.bottom < CHAT_LAYOUT.legacyClosedDesktopBottomPx,
    "não usa mais o empilhamento de 6.25rem",
  );
});

test("FAB fechado no mobile (com chips) fica acima da nav, dentro da aba", () => {
  const viewportWidth = 390;
  const viewportHeight = 844;
  const fab = chatClosedLauncherBox({
    viewportWidth,
    viewportHeight,
    desktop: false,
    ficha: false,
    chips: true,
  });
  assert.ok(fab);
  assert.equal(chatBoxInsideViewport(fab, viewportWidth, viewportHeight), true);
  assert.equal(fab.bottom, CHAT_LAYOUT.closedMobileNavBottomPx);
  assert.ok(fab.bottom < CHAT_LAYOUT.legacyClosedFichaStickyBottomPx);
});

test("FAB fechado no mobile não cobre o botão verde do WhatsApp na nav", () => {
  const viewportWidth = 390;
  const viewportHeight = 844;
  const fab = chatClosedLauncherBox({
    viewportWidth,
    viewportHeight,
    desktop: false,
    ficha: false,
    chips: true,
  });
  assert.ok(fab);
  const waSize = 56;
  const navHeight = 56;
  const waProtrusion = 12;
  const waBottom = navHeight + waProtrusion - waSize;
  const waLeft = (viewportWidth - waSize) / 2;
  const wa = {
    width: waSize,
    height: waSize,
    left: waLeft,
    right: viewportWidth - waLeft - waSize,
    bottom: waBottom,
    top: viewportHeight - waBottom - waSize,
  };
  assert.equal(chatBoxesOverlap(fab, wa), false);
  assert.ok(
    fab.bottom - (wa.bottom + wa.height) >= 8,
    "folga vertical acima do círculo do WhatsApp",
  );
});

test("ficha não renderiza caixa do FAB fechado (entrada in-page)", () => {
  assert.equal(
    chatClosedLauncherBox({
      viewportWidth: 390,
      viewportHeight: 844,
      desktop: false,
      ficha: true,
      chips: false,
    }),
    null,
  );
  assert.equal(
    chatClosedLauncherBox({
      viewportWidth: 1440,
      viewportHeight: 900,
      desktop: true,
      ficha: true,
      chips: false,
    }),
    null,
  );
});
