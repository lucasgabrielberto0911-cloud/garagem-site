import { chromium } from "playwright";
const BASE = process.env.BASE || "http://127.0.0.1:3471";
const OUT = process.env.OUT || "/tmp/admin-audit-antes";
const b = await chromium.launch();
for (const [vw, vh, mob] of [[360, 640, true], [1280, 700, false]]) {
  const ctx = await b.newContext({ viewport: { width: vw, height: vh }, isMobile: mob, hasTouch: mob, serviceWorkers: "block" });
  const p = await ctx.newPage();
  await p.goto(BASE + "/admin/login"); await p.fill('input[name="email"]', "auditoria@teste.local"); await p.fill('input[name="password"]', "Auditoria#2026");
  await Promise.all([p.waitForURL((u) => !u.pathname.includes("/login")), p.keyboard.press("Enter")]);
  const check = async (label) => {
    await p.waitForTimeout(600);
    const r = await p.evaluate(() => {
      const dlg = [...document.querySelectorAll('[role=dialog],dialog[open],[aria-modal=true]')].filter((d) => d.getBoundingClientRect().height > 0);
      const out = dlg.map((d) => { const r = d.getBoundingClientRect(); const sc = [d, ...d.querySelectorAll("*")].find((e) => /(auto|scroll)/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight + 2); const inner = [...d.querySelectorAll("button,a,input")].filter((e) => e.getBoundingClientRect().height > 0); const maxB = inner.length ? Math.max(...inner.map((e) => e.getBoundingClientRect().bottom)) : 0; return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height), scrollable: !!sc, lastControlBottom: Math.round(maxB), vh: innerHeight, unreachable: maxB > innerHeight + 2 && !sc }; });
      return { dialogs: out, bodyLock: getComputedStyle(document.body).overflow, htmlLock: getComputedStyle(document.documentElement).overflow };
    });
    console.log(`${vw} ${label}: ${JSON.stringify(r)}`);
    await p.screenshot({ path: `${OUT}/modal_${vw}_${label}.png` });
  };
  const tryClick = async (sel, label) => { const l = p.locator(sel).first(); if (!(await l.count())) { console.log(`${vw} ${label}: não achou ${sel}`); return false; } await l.click({ timeout: 5000 }).catch((e) => console.log(`${vw} ${label}: clique falhou ${String(e).slice(0, 80)}`)); await check(label); await p.keyboard.press("Escape"); await p.waitForTimeout(300); return true; };
  await p.goto(BASE + "/admin"); await p.waitForLoadState("networkidle").catch(() => {});
  if (mob) await tryClick('nav button:has-text("Mais")', "menu-mais");
  await tryClick('button[aria-label*="usca"]', "busca");
  await tryClick('button[aria-label*="otifica"], button[aria-label*="viso"]', "avisos");
  await p.goto(BASE + "/admin/veiculos"); await p.waitForLoadState("networkidle").catch(() => {});
  await tryClick('button:has-text("Filtros")', "filtros");
  await tryClick('button[aria-label*="ais ações"], button[aria-label*="ções"]', "acoes-carro");
  await tryClick('button:has-text("Marcar como vendido")', "marcar-vendido");
  const href = await p.locator('a[href^="/admin/veiculos/c"]').first().getAttribute("href");
  await p.goto(BASE + href); await p.waitForLoadState("networkidle").catch(() => {});
  await tryClick('button:has-text("Kit")', "kit");
  await tryClick('button[aria-label*="ções"], button:has-text("Mais")', "acoes-ficha");
  await ctx.close();
}
await b.close();
